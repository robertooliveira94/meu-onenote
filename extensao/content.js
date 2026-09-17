// Roda em toda página (menos o próprio app, ver manifest.json). Duas
// direções: sugerir preencher quando a página tem um campo de senha e o
// cofre já tem uma entrada pro site; e oferecer salvar quando um formulário
// com senha é enviado.

const CHAVE_PENDENTE = "pendenteSalvar";
const VALIDADE_PENDENTE_MS = 2 * 60 * 1000;

function enviarMensagem(mensagem) {
  return new Promise((resolver) => chrome.runtime.sendMessage(mensagem, resolver));
}

/** O input de usuário mais provável dentro do mesmo formulário do campo de senha. */
function acharCampoUsuario(campoSenha) {
  const formulario = campoSenha.closest("form");
  const escopo = formulario ?? document;
  const porAutocomplete = escopo.querySelector('input[autocomplete="username"]');
  if (porAutocomplete) return porAutocomplete;
  const candidatos = [...escopo.querySelectorAll('input[type="text"], input[type="email"], input:not([type])')].filter(
    (campo) => campo.offsetParent !== null,
  );
  // O mais próximo do campo de senha na ordem do DOM, antes dele — é o padrão em quase todo formulário de login.
  const posicao = candidatos.filter((campo) => campo.compareDocumentPosition(campoSenha) & Node.DOCUMENT_POSITION_FOLLOWING);
  return posicao.at(-1) ?? candidatos[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Banner (shadow DOM — isolado do CSS da página) */
/* ------------------------------------------------------------------ */

function criarBanner() {
  const hospedeiro = document.createElement("div");
  hospedeiro.style.all = "initial";
  const raiz = hospedeiro.attachShadow({ mode: "closed" });
  raiz.innerHTML = `
    <style>
      .caixa {
        position: fixed; top: 16px; right: 16px; z-index: 2147483647;
        width: 300px; padding: 14px; border-radius: 12px;
        background: #151d2b; color: #e9eef6;
        box-shadow: 0 8px 24px rgba(0,0,0,.35);
        font: 13px/1.4 -apple-system, system-ui, sans-serif;
      }
      .titulo { display: flex; align-items: center; gap: 8px; font-weight: 700; margin-bottom: 4px; }
      .titulo svg { flex-shrink: 0; }
      .corpo { color: #9fadc0; margin-bottom: 10px; }
      .linha { display: flex; gap: 8px; }
      button {
        font: inherit; border: none; border-radius: 8px; padding: 7px 12px;
        cursor: pointer; font-weight: 600;
      }
      .primario { background: #0EA47C; color: #fff; }
      .secundario { background: transparent; color: #9fadc0; }
      .secundario:hover { color: #e9eef6; }
    </style>
    <div class="caixa" part="caixa">
      <div class="titulo">
        <svg width="16" height="16" viewBox="0 0 48 48"><circle cx="19" cy="24" r="8" fill="none" stroke="#0EA47C" stroke-width="4"/><rect x="25" y="22" width="15" height="4.2" rx="2.1" fill="#0EA47C"/><rect x="34" y="26.2" width="4.2" height="6" rx="1.4" fill="#0EA47C"/></svg>
        <span data-papel="titulo">Salvar esta senha?</span>
      </div>
      <div class="corpo" data-papel="corpo"></div>
      <div class="linha">
        <button class="primario" data-papel="confirmar">Salvar</button>
        <button class="secundario" data-papel="cancelar">Agora não</button>
      </div>
    </div>
  `;
  document.documentElement.appendChild(hospedeiro);
  return {
    elemento: hospedeiro,
    titulo: raiz.querySelector('[data-papel="titulo"]'),
    corpo: raiz.querySelector('[data-papel="corpo"]'),
    confirmar: raiz.querySelector('[data-papel="confirmar"]'),
    cancelar: raiz.querySelector('[data-papel="cancelar"]'),
  };
}

function mostrarSalvarSenha(dados) {
  const banner = criarBanner();
  banner.corpo.textContent = dados.usuario ? `${dados.usuario} · ${new URL(dados.url).hostname}` : new URL(dados.url).hostname;
  banner.confirmar.addEventListener("click", async () => {
    banner.confirmar.textContent = "Salvando…";
    banner.confirmar.disabled = true;
    const resposta = await enviarMensagem({ tipo: "salvar", dados });
    if (resposta?.trancado) {
      banner.titulo.textContent = "O cofre está trancado";
      banner.corpo.textContent = "Abra o app e destranque pra salvar esta senha.";
      banner.confirmar.textContent = "Abrir o app";
      banner.confirmar.disabled = false;
      banner.confirmar.onclick = () => {
        enviarMensagem({ tipo: "abrir-app" });
        banner.elemento.remove();
      };
    } else if (resposta?.ok) {
      banner.titulo.textContent = resposta.atualizada ? "Senha atualizada" : "Senha salva";
      banner.corpo.textContent = "";
      setTimeout(() => banner.elemento.remove(), 1600);
    } else {
      banner.titulo.textContent = "Não deu para salvar";
      banner.corpo.textContent = resposta?.erro === "offline" ? "O app não está aberto no navegador." : "Tenta de novo mais tarde.";
    }
  });
  banner.cancelar.addEventListener("click", () => banner.elemento.remove());
  setTimeout(() => banner.elemento.isConnected && banner.elemento.remove(), 15_000);
}

/* ------------------------------------------------------------------ */
/* Captura: um formulário de senha foi enviado                         */
/* ------------------------------------------------------------------ */

function aoEnviarFormulario(evento) {
  const campoSenha = evento.target.querySelector('input[type="password"]');
  if (!campoSenha || !campoSenha.value) return;
  const campoUsuario = acharCampoUsuario(campoSenha);
  const dados = { url: location.href, usuario: campoUsuario?.value ?? "", senha: campoSenha.value, titulo: document.title };
  // Guarda pra depois: a maioria dos logins navega pra outra página antes
  // da pessoa ver qualquer coisa, então o banner só aparece na página
  // seguinte, no mesmo domínio — como o próprio Chrome faz.
  chrome.storage.local.set({ [CHAVE_PENDENTE]: { ...dados, quando: Date.now() } });
}

function observarFormularios() {
  document.addEventListener("submit", aoEnviarFormulario, true);
}

async function conferirPendente() {
  const guardado = await chrome.storage.local.get(CHAVE_PENDENTE);
  const pendente = guardado[CHAVE_PENDENTE];
  if (!pendente || Date.now() - pendente.quando > VALIDADE_PENDENTE_MS) return;
  let mesmoDominio = false;
  try {
    mesmoDominio = new URL(pendente.url).hostname.replace(/^www\./, "") === new URL(location.href).hostname.replace(/^www\./, "");
  } catch {
    // URL inválida — não mostra.
  }
  await chrome.storage.local.remove(CHAVE_PENDENTE);
  if (mesmoDominio) mostrarSalvarSenha(pendente);
}

/* ------------------------------------------------------------------ */
/* Autopreenchimento: sugere uma credencial salva                      */
/* ------------------------------------------------------------------ */

async function sugerirAutopreenchimento() {
  const campoSenha = document.querySelector('input[type="password"]');
  if (!campoSenha) return;
  const resposta = await enviarMensagem({ tipo: "buscar", url: location.href });
  const credenciais = resposta?.credenciais ?? [];
  if (credenciais.length === 0) return;

  const campoUsuario = acharCampoUsuario(campoSenha);
  const dica = document.createElement("div");
  dica.style.all = "initial";
  const raiz = dica.attachShadow({ mode: "closed" });
  const credencial = credenciais[0];
  raiz.innerHTML = `
    <style>
      button {
        position: fixed; z-index: 2147483647; font: 12.5px -apple-system, system-ui, sans-serif;
        background: #151d2b; color: #e9eef6; border: 1px solid #0EA47C; border-radius: 8px;
        padding: 6px 10px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,.3);
      }
    </style>
    <button>🔑 Preencher com ${credencial.usuario || credencial.titulo}</button>
  `;
  const botao = raiz.querySelector("button");
  function posicionar() {
    const retangulo = campoSenha.getBoundingClientRect();
    botao.style.top = `${retangulo.bottom + 4}px`;
    botao.style.left = `${retangulo.left}px`;
  }
  posicionar();
  window.addEventListener("scroll", posicionar, true);
  document.documentElement.appendChild(dica);

  botao.addEventListener("click", () => {
    if (campoUsuario) {
      campoUsuario.value = credencial.usuario;
      campoUsuario.dispatchEvent(new Event("input", { bubbles: true }));
    }
    campoSenha.value = credencial.senha;
    campoSenha.dispatchEvent(new Event("input", { bubbles: true }));
    window.removeEventListener("scroll", posicionar, true);
    dica.remove();
  });
  // Clicar fora do campo de senha e da própria dica esconde a sugestão.
  document.addEventListener("click", (evento) => {
    if (evento.target !== campoSenha && evento.composedPath()[0] !== botao) {
      window.removeEventListener("scroll", posicionar, true);
      dica.remove();
    }
  });
}

observarFormularios();
conferirPendente();
sugerirAutopreenchimento();
