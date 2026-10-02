const campo = document.getElementById("urlBase");
const botao = document.getElementById("salvar");
const aviso = document.getElementById("salvo");
const campoSincronizar = document.getElementById("sincronizarFavoritos");
const botaoSincronizar = document.getElementById("sincronizarAgora");
const statusSincronizacao = document.getElementById("statusSincronizacao");

chrome.storage.local.get(["urlBase", "sincronizarFavoritos", "sincronizadoEm"], ({ urlBase, sincronizarFavoritos, sincronizadoEm }) => {
  campo.value = urlBase || "http://localhost:3100";
  campoSincronizar.checked = sincronizarFavoritos !== false;
  botaoSincronizar.disabled = !campoSincronizar.checked;
  if (sincronizadoEm) statusSincronizacao.textContent = `Última sincronização: ${new Date(sincronizadoEm).toLocaleString()}`;
});

campoSincronizar.addEventListener("change", () => {
  botaoSincronizar.disabled = !campoSincronizar.checked;
});

botao.addEventListener("click", async () => {
  const valor = campo.value.trim().replace(/\/$/, "") || "http://localhost:3100";
  await chrome.storage.local.set({ urlBase: valor, sincronizarFavoritos: campoSincronizar.checked });
  aviso.hidden = false;
  setTimeout(() => (aviso.hidden = true), 1800);
  if (campoSincronizar.checked) sincronizarAgora();
});

async function sincronizarAgora() {
  botaoSincronizar.disabled = true;
  statusSincronizacao.textContent = "Sincronizando…";
  const resposta = await chrome.runtime.sendMessage({ tipo: "sincronizar-favoritos" });
  botaoSincronizar.disabled = false;
  statusSincronizacao.textContent = resposta?.ok
    ? `${resposta.total ?? 0} links sincronizados agora.`
    : resposta?.erro === "offline"
      ? "O app não está aberto. A cópia atual foi mantida."
      : resposta?.erro || "Não foi possível sincronizar.";
}

botaoSincronizar.addEventListener("click", sincronizarAgora);
