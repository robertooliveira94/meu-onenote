const campo = document.getElementById("urlBase");
const botao = document.getElementById("salvar");
const aviso = document.getElementById("salvo");

chrome.storage.local.get("urlBase", ({ urlBase }) => {
  campo.value = urlBase || "http://localhost:3100";
});

botao.addEventListener("click", async () => {
  const valor = campo.value.trim().replace(/\/$/, "") || "http://localhost:3100";
  await chrome.storage.local.set({ urlBase: valor });
  aviso.hidden = false;
  setTimeout(() => (aviso.hidden = true), 1800);
});
