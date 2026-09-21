"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Registro central de atalhos de teclado.
 *
 * Antes, cada tela pendurava o próprio `keydown` na janela (Ctrl+K na coluna
 * de seções, Ctrl+S no editor…) e nada era descobrível. Aqui há um ouvinte
 * só, e cada tela registra os seus atalhos com uma descrição — o que deixa a
 * folha de atalhos (`?`) listar exatamente o que vale na tela atual, sem
 * manter uma lista à parte que envelhece.
 *
 * Combo é uma string curta: `"n"`, `"?"`, `"["`, `"ctrl+k"`, `"alt+2"`,
 * `"ctrl+shift+f"`. Tecla solta (sem ctrl/alt/meta) não dispara enquanto a
 * pessoa digita num campo, a não ser que o atalho diga `mesmoEmCampo`.
 * Quando duas telas registram o mesmo combo, a última montada vence — assim
 * uma tela sobrepõe o padrão do hub enquanto está aberta e devolve ao sair.
 */
export type Atalho = {
  combo: string;
  descricao: string;
  /** Agrupa na folha de atalhos: "Hub", "Anotações", "Kanban", "Senhas", "Links". */
  grupo: string;
  acao: (evento: KeyboardEvent) => void;
  /** Dispara mesmo com o foco num campo de texto (Ctrl+S no editor, por exemplo). */
  mesmoEmCampo?: boolean;
};

type Registro = Atalho & { id: number };

/**
 * Dois contextos de propósito: quem só registra (todo componente com
 * `useAtalho`) assina o de ações, que nunca muda; quem lê a lista (a folha
 * e a paleta) assina o de lista. Com um contexto só, cada registro — e o
 * cofre re-registra "n" a cada troca de grupo, porque a descrição leva o
 * nome do grupo — re-renderizava todo componente que tinha um atalho.
 */
const AcoesContexto = createContext<{
  registrar: (atalho: Atalho) => () => void;
  /** Dispara o atalho que vence pra este combo, como se a tecla tivesse sido apertada. */
  executar: (combo: string) => void;
} | null>(null);

const ListaContexto = createContext<Registro[]>([]);

/** "ctrl+shift+f" → forma canônica, com modificadores em ordem fixa. */
function normalizar(combo: string): string {
  const partes = combo.toLowerCase().split("+").map((parte) => parte.trim());
  const tecla = partes[partes.length - 1];
  const mods = new Set(partes.slice(0, -1));
  return [mods.has("ctrl") ? "ctrl" : "", mods.has("alt") ? "alt" : "", mods.has("shift") ? "shift" : "", tecla]
    .filter(Boolean)
    .join("+");
}

/** O combo que um evento de teclado representa, na mesma forma canônica. */
function comboDoEvento(evento: KeyboardEvent): string {
  const tecla = evento.key.length === 1 ? evento.key.toLowerCase() : evento.key.toLowerCase();
  return [
    evento.ctrlKey || evento.metaKey ? "ctrl" : "",
    evento.altKey ? "alt" : "",
    // Numa tecla de um caractere sozinha, o próprio caractere carrega o
    // shift ("?" já é Shift+/ e "N" é Shift+n), então marcá-lo de novo
    // quebraria esses combos. Com Ctrl ou Alt junto não: Ctrl+Shift+F chega
    // como a letra "F" e, sem esta marca, seria indistinguível de Ctrl+F.
    evento.shiftKey && (evento.key.length > 1 || evento.ctrlKey || evento.metaKey || evento.altKey)
      ? "shift"
      : "",
    tecla,
  ]
    .filter(Boolean)
    .join("+");
}

function emCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  if (alvo.isContentEditable) return true;
  const tag = alvo.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function AtalhosProvedor({ children }: { children: React.ReactNode }) {
  const [lista, definirLista] = useState<Registro[]>([]);
  const proximoId = useRef(1);
  // O ouvinte lê daqui, não do estado — pra não ser recriado a cada registro.
  const atual = useRef<Registro[]>([]);
  atual.current = lista;

  const registrar = useCallback((atalho: Atalho) => {
    const id = proximoId.current++;
    definirLista((antes) => [...antes, { ...atalho, id, combo: normalizar(atalho.combo) }]);
    return () => definirLista((antes) => antes.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.repeat) return;
      const combo = comboDoEvento(evento);
      // O último registrado vence: uma tela sobrepõe o padrão do hub.
      const candidatos = atual.current.filter((item) => item.combo === combo);
      const escolhido = candidatos[candidatos.length - 1];
      if (!escolhido) return;
      const temModificador = combo.includes("ctrl+") || combo.includes("alt+");
      if (!temModificador && !escolhido.mesmoEmCampo && emCampoDeTexto(evento.target)) return;
      // Diálogo ou menu aberto engole tecla solta: o Esc deles e a digitação
      // dentro deles não podem disparar "n" ou "?" por baixo.
      if (!temModificador && !escolhido.mesmoEmCampo && document.querySelector("[role=dialog], [role=menu]")) return;
      evento.preventDefault();
      escolhido.acao(evento);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const executar = useCallback((combo: string) => {
    const alvo = normalizar(combo);
    const candidatos = atual.current.filter((item) => item.combo === alvo);
    candidatos[candidatos.length - 1]?.acao(new KeyboardEvent("keydown", { key: alvo }));
  }, []);

  const acoes = useMemo(() => ({ registrar, executar }), [registrar, executar]);
  return (
    <AcoesContexto.Provider value={acoes}>
      <ListaContexto.Provider value={lista}>{children}</ListaContexto.Provider>
    </AcoesContexto.Provider>
  );
}

/** Roda um atalho por fora do teclado — é como a paleta de comandos oferece as mesmas ações. */
export function useExecutarAtalho(): (combo: string) => void {
  const contexto = useContext(AcoesContexto);
  return contexto?.executar ?? (() => {});
}

/**
 * Registra um atalho enquanto o componente estiver montado. `acao` é lida
 * pela referência mais recente, então pode fechar sobre estado sem precisar
 * entrar na lista de dependências.
 */
export function useAtalho(
  combo: string,
  opcoes: Omit<Atalho, "combo" | "acao"> & {
    acao: Atalho["acao"];
    /** `false` desliga o atalho (e tira da folha) sem quebrar a ordem dos hooks. */
    ativo?: boolean;
  },
): void {
  const registrar = useContext(AcoesContexto)?.registrar;
  const acaoRef = useRef(opcoes.acao);
  acaoRef.current = opcoes.acao;
  const { descricao, grupo, mesmoEmCampo, ativo = true } = opcoes;

  useEffect(() => {
    if (!registrar || !ativo) return;
    return registrar({
      combo,
      descricao,
      grupo,
      mesmoEmCampo,
      acao: (evento) => acaoRef.current(evento),
    });
  }, [registrar, combo, descricao, grupo, mesmoEmCampo, ativo]);
}

/** Os atalhos ativos agora, agrupados na ordem em que os grupos apareceram — é o que a folha mostra. */
export function useListaDeAtalhos(): { grupo: string; atalhos: { combo: string; descricao: string }[] }[] {
  const lista = useContext(ListaContexto);
  const grupos: { grupo: string; atalhos: { combo: string; descricao: string }[] }[] = [];
  // Mesmo combo registrado duas vezes: só o que vence (o último) aparece.
  const vistos = new Set<string>();
  for (const item of [...lista].reverse()) {
    if (vistos.has(item.combo)) continue;
    vistos.add(item.combo);
    let grupo = grupos.find((g) => g.grupo === item.grupo);
    if (!grupo) {
      grupo = { grupo: item.grupo, atalhos: [] };
      grupos.push(grupo);
    }
    grupo.atalhos.unshift({ combo: item.combo, descricao: item.descricao });
  }
  const ordem = ["Hub", "Anotações", "Kanban", "Senhas", "Links", "Compras", "Saúde"];
  return grupos.sort((a, b) => ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo));
}

/** "ctrl+k" → ["Ctrl", "K"] — pra desenhar em <kbd>. */
export function partesDoCombo(combo: string): string[] {
  const nomes: Record<string, string> = { ctrl: "Ctrl", alt: "Alt", shift: "Shift", escape: "Esc", arrowup: "↑", arrowdown: "↓" };
  return combo.split("+").map((parte) => nomes[parte] ?? (parte.length === 1 ? parte.toUpperCase() : parte));
}
