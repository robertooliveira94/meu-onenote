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
const painelSenhas = document.getElementById("painelSenhas");
const painelLinks = document.getElementById("painelLinks");
const quadroLinks = document.getElementById("quadroLinks");
const linksCarregando = document.getElementById("linksCarregando");

function mostrarAba(aba) {
  const éLinks = aba === "links";
  abaSenhas.classList.toggle("ativa", !éLinks);
  abaLinks.classList.toggle("ativa", éLinks);
  painelSenhas.classList.toggle("ativo", !éLinks);
  painelLinks.classList.toggle("ativo", éLinks);
  if (éLinks && !quadroLinks.src) carregarLinks();
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
