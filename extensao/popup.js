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
