const bolinha = document.getElementById("bolinha");
const texto = document.getElementById("texto");
const botaoAbrir = document.getElementById("abrir");
const formDestrancar = document.getElementById("formDestrancar");
const senhaMestra = document.getElementById("senhaMestra");
const manterCofreAberto = document.getElementById("manterCofreAberto");
const botaoDestrancar = document.getElementById("destrancar");
const cofreAberto = document.getElementById("cofreAberto");
const buscarSenhas = document.getElementById("buscarSenhas");
const listaSenhas = document.getElementById("listaSenhas");
const mensagemCofre = document.getElementById("mensagemCofre");
const botaoNovaSenha = document.getElementById("novaSenha");
const botaoTrancarCofre = document.getElementById("trancarCofre");
const formNovaSenha = document.getElementById("formNovaSenha");
const grupoNovaSenha = document.getElementById("grupoNovaSenha");
const tituloNovaSenha = document.getElementById("tituloNovaSenha");
const usuarioNovaSenha = document.getElementById("usuarioNovaSenha");
const senhaNovaSenha = document.getElementById("senhaNovaSenha");
const urlNovaSenha = document.getElementById("urlNovaSenha");
const botaoGerarSenha = document.getElementById("gerarSenha");
const botaoCancelarNovaSenha = document.getElementById("cancelarNovaSenha");
const botaoSalvarNovaSenha = document.getElementById("salvarNovaSenha");
const versaoExtensao = document.getElementById("versaoExtensao");

versaoExtensao.textContent = `v${chrome.runtime.getManifest().version}`;

let arvoreCofre = null;
let baseDoApp = "http://localhost:3100";
const gruposRecolhidos = new Set();

function enviarMensagem(mensagem) {
  return new Promise((resolver) =>
    chrome.runtime.sendMessage(mensagem, (resposta) => {
      if (chrome.runtime.lastError) {
        resolver(undefined);
        return;
      }
      resolver(resposta);
    }),
  );
}

function mostrarMensagemCofre(mensagem, erro = false) {
  mensagemCofre.textContent = mensagem || "";
  mensagemCofre.classList.toggle("erro", erro);
}

function normalizar(textoOriginal) {
  return String(textoOriginal || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function totalDoGrupo(grupo) {
  return grupo.entradas.length + grupo.grupos.reduce((total, subgrupo) => total + totalDoGrupo(subgrupo), 0);
}

function gruposEmLista(grupo, profundidade = 0) {
  return [
    { id: grupo.id, nome: `${"  ".repeat(profundidade)}${grupo.nome || "Geral"}` },
    ...grupo.grupos.flatMap((subgrupo) => gruposEmLista(subgrupo, profundidade + 1)),
  ];
}

function preencherGrupos() {
  grupoNovaSenha.replaceChildren();
  if (!arvoreCofre) return;
  for (const grupo of gruposEmLista(arvoreCofre)) {
    const opcao = document.createElement("option");
    opcao.value = grupo.id;
    opcao.textContent = grupo.nome;
    grupoNovaSenha.append(opcao);
  }
}

function grupoFiltrado(grupo, termo) {
  if (!termo) return grupo;
  if (normalizar(grupo.nome).includes(termo)) return grupo;
  const entradas = grupo.entradas.filter((entrada) =>
    normalizar(`${entrada.titulo} ${entrada.usuario} ${entrada.url}`).includes(termo),
  );
  const grupos = grupo.grupos.map((subgrupo) => grupoFiltrado(subgrupo, termo)).filter(Boolean);
  return entradas.length || grupos.length ? { ...grupo, entradas, grupos } : null;
}

function botaoLinha(rotulo, titulo, aoClicar) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "botao-linha";
  botao.textContent = rotulo;
  botao.title = titulo;
  botao.setAttribute("aria-label", titulo);
  botao.addEventListener("click", aoClicar);
  return botao;
}

async function registrarAcesso(id) {
  await enviarMensagem({ tipo: "registrar-acesso-senha", id });
}

async function copiarDado(valor, rotulo, id) {
  if (!valor) {
    mostrarMensagemCofre(`${rotulo} está vazio.`, true);
    return;
  }
  try {
    await navigator.clipboard.writeText(valor);
    mostrarMensagemCofre(`${rotulo} copiado. A área de transferência será limpa em 20 segundos.`);
    void registrarAcesso(id);
    setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 20_000);
  } catch {
    mostrarMensagemCofre("O Chrome não permitiu copiar.", true);
  }
}

function criarLinhaSenha(entrada, profundidade) {
  const linha = document.createElement("div");
  linha.className = "linha-senha";
  linha.style.paddingLeft = `${14 + profundidade * 14}px`;

  const icone = document.createElement("span");
  icone.className = "icone-senha";
  if (entrada.temFavicon) {
    const imagem = document.createElement("img");
    imagem.src = `${baseDoApp}/senhas/favicon/${encodeURIComponent(entrada.id)}`;
    imagem.alt = "";
    imagem.addEventListener("error", () => {
      imagem.remove();
      icone.textContent = "🔑";
    });
    icone.append(imagem);
  } else {
    icone.textContent = "🔑";
  }
  linha.append(icone);

  const dados = document.createElement("span");
  dados.className = "dados-senha";
  const titulo = document.createElement("span");
  titulo.className = "titulo-senha";
  titulo.textContent = entrada.titulo || "Sem título";
  const usuario = document.createElement("span");
  usuario.className = "usuario-senha";
  usuario.textContent = entrada.usuario || entrada.url || "Sem usuário";
  dados.append(titulo, usuario);
  linha.append(dados);

  linha.append(
    botaoLinha("U", "Copiar usuário", () => void copiarDado(entrada.usuario, "Usuário", entrada.id)),
    botaoLinha("••", "Copiar senha", () => void copiarDado(entrada.senha, "Senha", entrada.id)),
  );
  if (entrada.url) {
    linha.append(
      botaoLinha("↗", "Abrir site nesta aba", async () => {
        void registrarAcesso(entrada.id);
        await enviarMensagem({ tipo: "abrir-link-na-aba", url: entrada.url });
        window.close();
      }),
    );
  }
  return linha;
}

function criarGrupoSenha(grupo, profundidade, pesquisando) {
  const secao = document.createElement("section");
  secao.className = "grupo-senha";
  const recolhido = !pesquisando && gruposRecolhidos.has(grupo.id);
  const cabecalho = document.createElement("button");
  cabecalho.type = "button";
  cabecalho.style.paddingLeft = `${8 + profundidade * 14}px`;
  cabecalho.setAttribute("aria-expanded", String(!recolhido));

  const seta = document.createElement("span");
  seta.textContent = recolhido ? "›" : "⌄";
  const pasta = document.createElement("span");
  pasta.textContent = "📁";
  const nome = document.createElement("span");
  nome.className = "grupo-nome";
  nome.textContent = grupo.nome || "Geral";
  const total = document.createElement("span");
  total.className = "grupo-total";
  total.textContent = String(totalDoGrupo(grupo));
  cabecalho.append(seta, pasta, nome, total);
  cabecalho.addEventListener("click", () => {
    if (gruposRecolhidos.has(grupo.id)) gruposRecolhidos.delete(grupo.id);
    else gruposRecolhidos.add(grupo.id);
    renderizarSenhas();
  });
  secao.append(cabecalho);

  if (!recolhido) {
    for (const entrada of grupo.entradas) secao.append(criarLinhaSenha(entrada, profundidade));
    for (const subgrupo of grupo.grupos) secao.append(criarGrupoSenha(subgrupo, profundidade + 1, pesquisando));
  }
  return secao;
}

function renderizarSenhas() {
  listaSenhas.replaceChildren();
  if (!arvoreCofre) return;
  const termo = normalizar(buscarSenhas.value.trim());
  const arvoreVisivel = grupoFiltrado(arvoreCofre, termo);
  if (!arvoreVisivel || totalDoGrupo(arvoreVisivel) === 0) {
    const vazio = document.createElement("p");
    vazio.className = "vazio-cofre";
    vazio.textContent = termo ? "Nenhuma senha encontrada." : "O cofre ainda não tem senhas.";
    listaSenhas.append(vazio);
    return;
  }
  listaSenhas.append(criarGrupoSenha(arvoreVisivel, 0, !!termo));
}

function mostrarCofre(arvore, minutosRestantes = null) {
  arvoreCofre = arvore;
  formDestrancar.hidden = true;
  formNovaSenha.hidden = true;
  cofreAberto.hidden = false;
  bolinha.className = "bolinha aberto";
  texto.textContent = minutosRestantes ? `Cofre aberto · ${minutosRestantes} min restantes` : "Cofre destrancado";
  preencherGrupos();
  renderizarSenhas();
}

function pedirSenha(mensagem = "Cofre trancado") {
  arvoreCofre = null;
  cofreAberto.hidden = true;
  formNovaSenha.hidden = true;
  formDestrancar.hidden = false;
  bolinha.className = "bolinha trancado";
  texto.textContent = mensagem;
}

async function inicializarCofre() {
  const { urlBase, minutosCofreExtensao } = await chrome.storage.local.get(["urlBase", "minutosCofreExtensao"]);
  baseDoApp = (urlBase || "http://localhost:3100").replace(/\/$/, "");
  const preferencia = String(minutosCofreExtensao || 15);
  if ([...manterCofreAberto.options].some((opcao) => opcao.value === preferencia)) {
    manterCofreAberto.value = preferencia;
  }
  const status = await enviarMensagem({ tipo: "status" });
  if (!status || status.erro === "offline") {
    bolinha.className = "bolinha offline";
    texto.textContent = "O app não está aberto";
    mostrarMensagemCofre("Abra o aplicativo para usar o cofre.", true);
    return;
  }
  if (!status.existe) {
    pedirSenha("O cofre ainda não existe");
    formDestrancar.hidden = true;
    mostrarMensagemCofre("Crie o primeiro cofre no aplicativo completo.");
    return;
  }
  if (status.autorizado) {
    const resposta = await enviarMensagem({ tipo: "listar-senhas" });
    if (resposta?.ok && resposta.arvore) {
      mostrarCofre(resposta.arvore, status.minutosRestantes);
      return;
    }
  }
  pedirSenha(status.destrancado ? "Confirme a senha mestra" : "Cofre trancado");
  if (status.destrancado) {
    mostrarMensagemCofre(
      status.tokenPresente
        ? "A autorização temporária foi encontrada, mas o aplicativo a recusou."
        : "A autorização temporária não foi encontrada no Chrome.",
      true,
    );
  }
}

formDestrancar.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const segredo = senhaMestra.value;
  const minutos = Number(manterCofreAberto.value) || 15;
  senhaMestra.value = "";
  botaoDestrancar.disabled = true;
  mostrarMensagemCofre("Destrancando…");
  await chrome.storage.local.set({ minutosCofreExtensao: minutos });
  const resposta = await enviarMensagem({ tipo: "destrancar-cofre", senhaMestra: segredo, minutos });
  botaoDestrancar.disabled = false;
  if (!resposta?.ok || !resposta.arvore) {
    mostrarMensagemCofre(resposta?.erro || "Não deu para destrancar.", true);
    senhaMestra.focus();
    return;
  }
  mostrarMensagemCofre("");
  mostrarCofre(resposta.arvore, resposta.minutos || minutos);
});

buscarSenhas.addEventListener("input", renderizarSenhas);

botaoNovaSenha.addEventListener("click", () => {
  preencherGrupos();
  cofreAberto.hidden = true;
  formNovaSenha.hidden = false;
  tituloNovaSenha.focus();
  mostrarMensagemCofre("");
});

botaoCancelarNovaSenha.addEventListener("click", () => {
  formNovaSenha.reset();
  senhaNovaSenha.type = "password";
  formNovaSenha.hidden = true;
  cofreAberto.hidden = false;
  mostrarMensagemCofre("");
});

botaoGerarSenha.addEventListener("click", () => {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_+=?";
  const numeros = crypto.getRandomValues(new Uint32Array(20));
  senhaNovaSenha.value = Array.from(numeros, (numero) => alfabeto[numero % alfabeto.length]).join("");
  senhaNovaSenha.type = "text";
  senhaNovaSenha.focus();
  senhaNovaSenha.select();
});

formNovaSenha.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  botaoSalvarNovaSenha.disabled = true;
  mostrarMensagemCofre("Guardando…");
  const resposta = await enviarMensagem({
    tipo: "criar-senha",
    dados: {
      grupoId: grupoNovaSenha.value,
      titulo: tituloNovaSenha.value,
      usuario: usuarioNovaSenha.value,
      senha: senhaNovaSenha.value,
      url: urlNovaSenha.value,
    },
  });
  botaoSalvarNovaSenha.disabled = false;
  if (!resposta?.ok || !resposta.arvore) {
    if (resposta?.naoAutorizado) pedirSenha("Autorização expirada");
    mostrarMensagemCofre(resposta?.erro || "Não deu para guardar.", true);
    return;
  }
  formNovaSenha.reset();
  senhaNovaSenha.type = "password";
  mostrarCofre(resposta.arvore);
  mostrarMensagemCofre("Senha criada.");
});

botaoTrancarCofre.addEventListener("click", async () => {
  await enviarMensagem({ tipo: "trancar-cofre" });
  buscarSenhas.value = "";
  pedirSenha("Cofre trancado");
  mostrarMensagemCofre("O cofre foi trancado.");
});

void inicializarCofre();

botaoAbrir.addEventListener("click", () => {
  chrome.runtime.sendMessage({ tipo: "abrir-app" });
  window.close();
});

// Links é a entrada principal da extensão. Os demais iframes continuam
// carregando sob demanda, apenas quando suas abas forem abertas.
const abaSenhas = document.getElementById("abaSenhas");
const abaLinks = document.getElementById("abaLinks");
const abaCompras = document.getElementById("abaCompras");
const painelSenhas = document.getElementById("painelSenhas");
const painelLinks = document.getElementById("painelLinks");
const painelCompras = document.getElementById("painelCompras");
const quadroLinks = document.getElementById("quadroLinks");
const quadroCompras = document.getElementById("quadroCompras");
const linksCarregando = document.getElementById("linksCarregando");
const comprasCarregando = document.getElementById("comprasCarregando");

function mostrarAba(aba) {
  abaSenhas.classList.toggle("ativa", aba === "senhas");
  abaLinks.classList.toggle("ativa", aba === "links");
  abaCompras.classList.toggle("ativa", aba === "compras");
  painelSenhas.classList.toggle("ativo", aba === "senhas");
  painelLinks.classList.toggle("ativo", aba === "links");
  painelCompras.classList.toggle("ativo", aba === "compras");
  if (aba === "links" && !quadroLinks.src) carregarLinks();
  if (aba === "compras" && !quadroCompras.src) carregarCompras();
}

// "Salvar produto": a página do app faz o formulário; daqui vai só a URL e
// o título da aba aberta (`activeTab` libera isso no clique no ícone).
async function carregarCompras() {
  const { urlBase } = await chrome.storage.local.get("urlBase");
  const base = urlBase || "http://localhost:3100";
  try {
    const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = aba?.url && /^https?:/.test(aba.url) ? aba.url : "";
    const titulo = aba?.title || "";
    const resposta = await fetch(base, { method: "HEAD" });
    if (!resposta.ok) throw new Error();
    quadroCompras.src = `${base}/salvar-produto?url=${encodeURIComponent(url)}&titulo=${encodeURIComponent(titulo)}`;
    quadroCompras.hidden = false;
    comprasCarregando.hidden = true;
  } catch {
    comprasCarregando.textContent = "O app não está aberto.";
  }
}

async function carregarLinks() {
  const { urlBase } = await chrome.storage.local.get("urlBase");
  const base = urlBase || "http://localhost:3100";
  try {
    const resposta = await fetch(base, { method: "HEAD" });
    if (!resposta.ok) throw new Error();
    quadroLinks.src = `${base}/links-popup`;
    quadroLinks.hidden = false;
    linksCarregando.hidden = true;
    chrome.runtime.sendMessage({ tipo: "sincronizar-favoritos" });
  } catch {
    linksCarregando.textContent = "O app não está aberto.";
  }
}

window.addEventListener("message", async (evento) => {
  if (evento.source !== quadroLinks.contentWindow || evento.data?.tipo !== "meu-bloco-abrir-link") return;
  const { urlBase } = await chrome.storage.local.get("urlBase");
  const origemPermitida = new URL(urlBase || "http://localhost:3100").origin;
  if (evento.origin !== origemPermitida) return;
  await chrome.runtime.sendMessage({ tipo: "abrir-link-na-aba", url: evento.data.url });
  window.close();
});

abaSenhas.addEventListener("click", () => mostrarAba("senhas"));
abaLinks.addEventListener("click", () => mostrarAba("links"));
abaCompras.addEventListener("click", () => mostrarAba("compras"));

mostrarAba("links");
