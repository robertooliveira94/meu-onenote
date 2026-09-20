const bolinha = document.getElementById("bolinha");
const texto = document.getElementById("texto");
const botaoAbrir = document.getElementById("abrir");

chrome.runtime.sendMessage({ tipo: "status" }, (resposta) => {
  if (resposta?.erro === "offline" || resposta === undefined) {
    bolinha.className = "bolinha offline";
    texto.textContent = "O app não está aberto";
  } else if (resposta.destrancado) {
    bolinha.className = "bolinha aberto";
    texto.textContent = "Cofre destrancado";
  } else {
    bolinha.className = "bolinha trancado";
    texto.textContent = "Cofre trancado";
  }
});

botaoAbrir.addEventListener("click", () => {
  chrome.runtime.sendMessage({ tipo: "abrir-app" });
  window.close();
});

// Abas Senhas/Links — o iframe dos links só carrega na primeira vez que a
// aba é aberta, pra não bater no app toda vez que alguém só quer ver o
// status do cofre.
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
  } catch {
    linksCarregando.textContent = "O app não está aberto.";
  }
}

abaSenhas.addEventListener("click", () => mostrarAba("senhas"));
abaLinks.addEventListener("click", () => mostrarAba("links"));
abaCompras.addEventListener("click", () => mostrarAba("compras"));
