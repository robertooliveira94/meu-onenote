// Service worker: faz as chamadas ao app local em nome do content script.
// Um service worker de extensão com host_permissions não esbarra em CORS
// como uma página comum esbarraria — por isso as requisições passam por
// aqui, e não direto do content script.

const URL_PADRAO = "http://localhost:3100";
const NOME_PASTA_FAVORITOS = "Meu Bloco";
const ALARME_SINCRONIZACAO = "sincronizar-favoritos-meu-bloco";
const CHAVES_TOKEN_COFRE = ["tokenCofre", "tokenCofreExpiraEm"];

async function obterBase() {
  const { urlBase } = await chrome.storage.local.get("urlBase");
  return urlBase || URL_PADRAO;
}

async function chamar(caminho, opcoes) {
  const base = await obterBase();
  try {
    const resposta = await fetch(base + caminho, opcoes);
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) return { ok: false, status: resposta.status, ...dados };
    return dados;
  } catch {
    return { ok: false, erro: "offline" };
  }
}

async function tokenDoCofre() {
  const { tokenCofre, tokenCofreExpiraEm } = await chrome.storage.local.get(CHAVES_TOKEN_COFRE);
  if (!tokenCofre || !Number.isFinite(tokenCofreExpiraEm) || Date.now() >= tokenCofreExpiraEm) {
    await limparTokenDoCofre();
    return null;
  }
  return tokenCofre;
}

async function guardarTokenDoCofre(token, minutos) {
  await chrome.storage.local.set({
    tokenCofre: token,
    tokenCofreExpiraEm: Date.now() + minutos * 60_000,
  });
  // Remove a cópia usada pelas versões 1.4.0–1.4.2.
  await chrome.storage.session.remove("tokenCofre");
}

async function limparTokenDoCofre() {
  await Promise.all([
    chrome.storage.local.remove(CHAVES_TOKEN_COFRE),
    chrome.storage.session.remove("tokenCofre"),
  ]);
}

async function chamarCofre(caminho, opcoes = {}) {
  const token = await tokenDoCofre();
  const headers = new Headers(opcoes.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const resposta = await chamar(caminho, { ...opcoes, headers });
  if (resposta?.naoAutorizado) await limparTokenDoCofre();
  return resposta;
}

function urlHttpValida(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function obterNoDoChrome(id) {
  if (!id) return null;
  try {
    const [no] = await chrome.bookmarks.get(id);
    return no || null;
  } catch {
    return null;
  }
}

async function garantirPosicao(id, parentId, index) {
  const no = await obterNoDoChrome(id);
  if (!no || (no.parentId === parentId && no.index === index)) return;
  await chrome.bookmarks.move(id, { parentId, index });
}

async function encontrarBarraDeFavoritos() {
  const [raiz] = await chrome.bookmarks.getTree();
  return raiz.children?.find((no) => no.folderType === "bookmarks-bar") ?? raiz.children?.[0] ?? null;
}

async function garantirPastaRaiz(mapa) {
  const barra = await encontrarBarraDeFavoritos();
  if (!barra) throw new Error("A barra de favoritos do Chrome não foi encontrada.");

  let pasta = await obterNoDoChrome(mapa.raiz);
  if (pasta && !pasta.url && pasta.parentId !== barra.id) {
    pasta = await chrome.bookmarks.move(pasta.id, { parentId: barra.id });
  } else if (!pasta || pasta.url) {
    // Não adota uma pasta só porque tem o mesmo nome: ela pode pertencer ao
    // usuário. Sem o ID gerenciado salvo, é mais seguro criar outra.
    pasta = null;
  }
  if (!pasta) pasta = await chrome.bookmarks.create({ parentId: barra.id, title: NOME_PASTA_FAVORITOS });
  if (pasta.title !== NOME_PASTA_FAVORITOS) await chrome.bookmarks.update(pasta.id, { title: NOME_PASTA_FAVORITOS });
  mapa.raiz = pasta.id;
  return pasta.id;
}

async function garantirPasta(appId, titulo, parentId, index, mapa) {
  let no = await obterNoDoChrome(mapa.pastas[appId]);
  if (!no || no.url) {
    no = await chrome.bookmarks.create({ parentId, index, title: titulo });
    mapa.pastas[appId] = no.id;
  } else {
    if (no.title !== titulo) await chrome.bookmarks.update(no.id, { title: titulo });
    await garantirPosicao(no.id, parentId, index);
  }
  return no.id;
}

async function garantirLink(link, parentId, index, mapa) {
  let no = await obterNoDoChrome(mapa.links[link.id]);
  if (!no || !no.url) {
    no = await chrome.bookmarks.create({ parentId, index, title: link.titulo, url: link.url });
    mapa.links[link.id] = no.id;
  } else {
    if (no.title !== link.titulo || no.url !== link.url) {
      await chrome.bookmarks.update(no.id, { title: link.titulo, url: link.url });
    }
    await garantirPosicao(no.id, parentId, index);
  }
}

async function sincronizarConteudoDaPasta(pasta, parentId, mapa, pastasAtivas, linksAtivos) {
  let index = 0;
  for (const link of pasta.links) {
    linksAtivos.add(link.id);
    await garantirLink(link, parentId, index, mapa);
    index += 1;
  }
  for (const subpasta of pasta.pastas) {
    pastasAtivas.add(subpasta.id);
    const idPastaChrome = await garantirPasta(subpasta.id, subpasta.nome, parentId, index, mapa);
    index += 1;
    await sincronizarConteudoDaPasta(subpasta, idPastaChrome, mapa, pastasAtivas, linksAtivos);
  }
}

async function limparItensGerenciadosRemovidos(mapa, pastasAtivas, linksAtivos) {
  for (const [appId, chromeId] of Object.entries(mapa.links)) {
    if (linksAtivos.has(appId)) continue;
    if (await obterNoDoChrome(chromeId)) await chrome.bookmarks.remove(chromeId).catch(() => undefined);
    delete mapa.links[appId];
  }

  // Filhos primeiro. Uma pasta que contenha itens adicionados manualmente pelo
  // usuário é preservada, mesmo que tenha sido removida do app.
  for (const [appId, chromeId] of Object.entries(mapa.pastas).reverse()) {
    if (pastasAtivas.has(appId)) continue;
    const filhos = await chrome.bookmarks.getChildren(chromeId).catch(() => null);
    if (filhos?.length === 0) await chrome.bookmarks.remove(chromeId).catch(() => undefined);
    delete mapa.pastas[appId];
  }
}

async function executarSincronizacaoFavoritosChrome() {
  const configuracao = await chrome.storage.local.get(["sincronizarFavoritos", "mapaFavoritosChrome"]);
  if (configuracao.sincronizarFavoritos === false) return { ok: true, desativado: true };

  const resposta = await chamar("/api/links");
  if (!resposta?.arvore) return resposta?.erro ? { ok: false, erro: resposta.erro } : { ok: false, erro: "Resposta inválida do app." };

  const mapa = configuracao.mapaFavoritosChrome ?? { raiz: null, pastas: {}, links: {} };
  mapa.pastas ??= {};
  mapa.links ??= {};
  const raizChrome = await garantirPastaRaiz(mapa);
  const pastasAtivas = new Set();
  const linksAtivos = new Set();
  await sincronizarConteudoDaPasta(resposta.arvore, raizChrome, mapa, pastasAtivas, linksAtivos);
  await limparItensGerenciadosRemovidos(mapa, pastasAtivas, linksAtivos);

  const sincronizadoEm = new Date().toISOString();
  await chrome.storage.local.set({ mapaFavoritosChrome: mapa, arvoreLinksCache: resposta.arvore, sincronizadoEm });
  return { ok: true, total: linksAtivos.size, sincronizadoEm };
}

let sincronizacaoEmCurso = null;

function sincronizarFavoritosChrome() {
  if (sincronizacaoEmCurso) return sincronizacaoEmCurso;
  sincronizacaoEmCurso = executarSincronizacaoFavoritosChrome()
    .catch((erro) => ({ ok: false, erro: erro instanceof Error ? erro.message : "Não foi possível sincronizar." }))
    .finally(() => {
      sincronizacaoEmCurso = null;
    });
  return sincronizacaoEmCurso;
}

async function abrirNaAbaAtual(url) {
  if (!urlHttpValida(url)) return { ok: false, erro: "URL inválida." };
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.id) return { ok: false, erro: "Nenhuma aba ativa." };
  await chrome.tabs.update(aba.id, { url });
  return { ok: true };
}

chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  (async () => {
    if (mensagem.tipo === "status") {
      const tokenPresente = !!(await tokenDoCofre());
      const status = await chamarCofre("/senhas/extensao/status");
      responder({ ...status, tokenPresente });
    } else if (mensagem.tipo === "buscar") {
      responder(await chamar(`/senhas/extensao/buscar?url=${encodeURIComponent(mensagem.url)}`));
    } else if (mensagem.tipo === "salvar") {
      responder(
        await chamar("/senhas/extensao/salvar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mensagem.dados),
        }),
      );
    } else if (mensagem.tipo === "destrancar-cofre") {
      const resposta = await chamar("/senhas/extensao/destrancar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senhaMestra: mensagem.senhaMestra, minutos: mensagem.minutos }),
      });
      if (resposta?.ok && resposta.token) {
        const tokenRecebido = resposta.token;
        await guardarTokenDoCofre(tokenRecebido, resposta.minutos || mensagem.minutos || 15);
        delete resposta.token;
        const tokenConfirmado = await tokenDoCofre();
        if (tokenConfirmado !== tokenRecebido) {
          responder({ ok: false, erro: "O Chrome não conseguiu preservar a autorização temporária." });
          return;
        }
        const verificacao = await chamarCofre("/senhas/extensao/status");
        if (!verificacao?.autorizado) {
          await limparTokenDoCofre();
          responder({ ok: false, erro: "O aplicativo não confirmou a autorização temporária." });
          return;
        }
      }
      responder(resposta);
    } else if (mensagem.tipo === "listar-senhas") {
      responder(await chamarCofre("/senhas/extensao/cofre"));
    } else if (mensagem.tipo === "criar-senha") {
      responder(
        await chamarCofre("/senhas/extensao/cofre", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "criar", ...mensagem.dados }),
        }),
      );
    } else if (mensagem.tipo === "registrar-acesso-senha") {
      responder(
        await chamarCofre("/senhas/extensao/cofre", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "acesso", id: mensagem.id }),
        }),
      );
    } else if (mensagem.tipo === "trancar-cofre") {
      const resposta = await chamarCofre("/senhas/extensao/cofre", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "trancar" }),
      });
      await limparTokenDoCofre();
      responder(resposta);
    } else if (mensagem.tipo === "abrir-app") {
      const base = await obterBase();
      chrome.tabs.create({ url: `${base}/senhas` });
      responder({ ok: true });
    } else if (mensagem.tipo === "abrir-link-na-aba") {
      responder(await abrirNaAbaAtual(mensagem.url));
    } else if (mensagem.tipo === "sincronizar-favoritos") {
      responder(await sincronizarFavoritosChrome());
    }
  })();
  return true; // resposta assíncrona
});

chrome.runtime.onInstalled.addListener(() => {
  void limparTokenDoCofre();
  chrome.alarms.create(ALARME_SINCRONIZACAO, { periodInMinutes: 5 });
  sincronizarFavoritosChrome();
});

chrome.runtime.onStartup.addListener(() => {
  void limparTokenDoCofre();
  chrome.alarms.create(ALARME_SINCRONIZACAO, { periodInMinutes: 5 });
  sincronizarFavoritosChrome();
});

chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name === ALARME_SINCRONIZACAO) sincronizarFavoritosChrome();
});
