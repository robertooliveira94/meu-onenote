// Service worker: faz as chamadas ao app local em nome do content script.
// Um service worker de extensão com host_permissions não esbarra em CORS
// como uma página comum esbarraria — por isso as requisições passam por
// aqui, e não direto do content script.

const URL_PADRAO = "http://localhost:3100";

async function obterBase() {
  const { urlBase } = await chrome.storage.local.get("urlBase");
  return urlBase || URL_PADRAO;
}

async function chamar(caminho, opcoes) {
  const base = await obterBase();
  try {
    const resposta = await fetch(base + caminho, opcoes);
    if (!resposta.ok && resposta.status !== 200) {
      return { ok: false, erro: `O app respondeu ${resposta.status}.` };
    }
    return await resposta.json();
  } catch {
    return { ok: false, erro: "offline" };
  }
}

chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  (async () => {
    if (mensagem.tipo === "status") {
      responder(await chamar("/senhas/extensao/status"));
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
    } else if (mensagem.tipo === "abrir-app") {
      const base = await obterBase();
      chrome.tabs.create({ url: `${base}/senhas` });
      responder({ ok: true });
    }
  })();
  return true; // resposta assíncrona
});
