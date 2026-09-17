const quadro = document.getElementById("quadro");
const offline = document.getElementById("offline");

const URL_PADRAO = "http://localhost:3100";

async function iniciar() {
  const { urlBase } = await chrome.storage.local.get("urlBase");
  const base = urlBase || URL_PADRAO;

  try {
    // Só pra saber se o app está de pé antes de tentar o iframe — um app
    // fechado deixaria o iframe preso na tela de erro do próprio Chrome.
    const resposta = await fetch(base, { method: "HEAD" });
    if (!resposta.ok) throw new Error();
    quadro.src = `${base}/links-popup`;
    quadro.style.display = "block";
    offline.style.display = "none";
  } catch {
    quadro.style.display = "none";
    offline.style.display = "block";
  }
}

iniciar();
