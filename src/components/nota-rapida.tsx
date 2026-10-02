"use client";

import { Check, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { acaoDescartarNotaRapida, acaoMoverNotaRapida, acaoRenomear } from "@/app/acoes";
import { CANAL_NOTA_RAPIDA, publicarMudancaNasNotas } from "@/lib/eventos-notas";
import { urlDaNotaRapida } from "@/lib/rotas";
import type { Caderno, Nota } from "@/lib/tipos";

type EstadoSalvamento = "salvo" | "pendente" | "salvando" | "erro";
const ESPERA_SALVAMENTO_RAPIDO = 350;

export function NotaRapida({ nota, cadernos }: { nota: Nota; cadernos: Caderno[] }) {
  const roteador = useRouter();
  const [caminho, definirCaminho] = useState(nota.caminho);
  const [titulo, definirTitulo] = useState(nota.titulo);
  const [conteudo, definirConteudo] = useState(nota.conteudo);
  const [estado, definirEstado] = useState<EstadoSalvamento>("salvo");
  const [erro, definirErro] = useState<string | null>(null);
  const [descartada, definirDescartada] = useState(false);
  const caminhoAtual = useRef(nota.caminho);
  const conteudoAtual = useRef(nota.conteudo);
  const conteudoGravado = useRef(nota.conteudo);
  const fila = useRef<Promise<boolean>>(Promise.resolve(true));

  const salvar = useCallback((texto = conteudoAtual.current): Promise<boolean> => {
    if (texto === conteudoGravado.current) return fila.current;
    definirEstado("salvando");
    const alvo = caminhoAtual.current;
    fila.current = fila.current.then(async () => {
      try {
        const resposta = await fetch("/api/notas/salvar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ caminho: alvo, conteudo: texto }),
        });
        if (!resposta.ok) throw new Error("Não deu para salvar");
        conteudoGravado.current = texto;
        definirEstado(conteudoAtual.current === texto ? "salvo" : "pendente");
        publicarMudancaNasNotas(alvo);
        return true;
      } catch {
        definirEstado("erro");
        return false;
      }
    });
    return fila.current;
  }, []);

  useEffect(() => {
    if (conteudo === conteudoGravado.current) return;
    definirEstado("pendente");
    const espera = window.setTimeout(() => void salvar(conteudo), ESPERA_SALVAMENTO_RAPIDO);
    return () => window.clearTimeout(espera);
  }, [conteudo, salvar]);

  // `sendBeacon` continua enviando quando a janela já está fechando; é a
  // última proteção para as teclas digitadas depois do debounce.
  useEffect(() => {
    const salvarAoOcultar = () => {
      if (document.visibilityState !== "hidden" || conteudoAtual.current === conteudoGravado.current) return;
      const corpo = new Blob(
        [JSON.stringify({ caminho: caminhoAtual.current, conteudo: conteudoAtual.current })],
        { type: "application/json" },
      );
      navigator.sendBeacon("/api/notas/salvar", corpo);
    };
    const salvarAoFechar = () => {
      if (conteudoAtual.current === conteudoGravado.current) return;
      const corpo = new Blob(
        [JSON.stringify({ caminho: caminhoAtual.current, conteudo: conteudoAtual.current })],
        { type: "application/json" },
      );
      navigator.sendBeacon("/api/notas/salvar", corpo);
    };
    document.addEventListener("visibilitychange", salvarAoOcultar);
    window.addEventListener("pagehide", salvarAoFechar);
    return () => {
      document.removeEventListener("visibilitychange", salvarAoOcultar);
      window.removeEventListener("pagehide", salvarAoFechar);
    };
  }, []);

  // O lançador pergunta antes de criar outra página. Uma janela só se oferece
  // para reuso enquanto o corpo continua vazio.
  useEffect(() => {
    let canal: BroadcastChannel | null = null;
    try {
      canal = new BroadcastChannel(CANAL_NOTA_RAPIDA);
      canal.onmessage = (evento: MessageEvent<{ tipo?: string; token?: string }>) => {
        if (evento.data.tipo !== "procurar-nota-vazia" || conteudoAtual.current.trim()) return;
        canal?.postMessage({ tipo: "nota-vazia-disponivel", token: evento.data.token });
        window.focus();
      };
    } catch {
      canal = null;
    }
    return () => canal?.close();
  }, []);

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (!(evento.ctrlKey || evento.metaKey) || evento.key.toLowerCase() !== "s") return;
      evento.preventDefault();
      void salvar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [salvar]);

  async function renomear() {
    const novo = titulo.trim();
    if (!novo || novo === nota.titulo) return;
    if (!(await salvar())) return;
    const anterior = caminhoAtual.current;
    const resposta = await acaoRenomear(anterior, novo);
    if (!resposta.ok || !resposta.mensagem) {
      definirErro(resposta.ok ? "Não deu para renomear." : resposta.erro);
      return;
    }
    caminhoAtual.current = resposta.mensagem;
    definirCaminho(resposta.mensagem);
    definirTitulo(novo);
    publicarMudancaNasNotas(resposta.mensagem);
    roteador.replace(urlDaNotaRapida(resposta.mensagem));
  }

  async function mover(destino: string) {
    if (!(await salvar())) return;
    definirErro(null);
    const resposta = await acaoMoverNotaRapida(caminhoAtual.current, destino);
    if (!resposta.ok || !resposta.mensagem) {
      definirErro(resposta.ok ? "Não deu para mover a nota." : resposta.erro);
      return;
    }
    caminhoAtual.current = resposta.mensagem;
    definirCaminho(resposta.mensagem);
    publicarMudancaNasNotas(resposta.mensagem);
    roteador.replace(urlDaNotaRapida(resposta.mensagem));
  }

  async function descartar() {
    if (conteudoAtual.current.trim()) return;
    const resposta = await acaoDescartarNotaRapida(caminhoAtual.current);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    publicarMudancaNasNotas(caminhoAtual.current);
    definirDescartada(true);
    window.close();
  }

  if (descartada) {
    return (
      <main className="flex h-screen items-center justify-center bg-papel p-5 text-center">
        <div>
          <Check size={22} className="mx-auto mb-2 text-[var(--realce)]" />
          <p className="text-[13px] font-medium">Nota vazia movida para a lixeira.</p>
          <button type="button" className="mt-2 text-[12px] text-tinta-2 underline" onClick={() => window.close()}>
            Fechar janela
          </button>
        </div>
      </main>
    );
  }

  const destinoAtual = caminho.split("/").slice(0, -1).join("/");
  const vazia = !conteudo.trim();

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-papel">
      <header className="shrink-0 border-b border-linha bg-superficie px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            value={titulo}
            onChange={(evento) => definirTitulo(evento.target.value)}
            onBlur={() => void renomear()}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") evento.currentTarget.blur();
            }}
            aria-label="Título da nota"
            className="min-w-0 flex-1 border-b border-transparent bg-transparent text-[15px] font-bold tracking-[-0.01em] focus:border-[var(--realce)] focus:outline-none"
          />
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-tinta-3">
            {estado === "salvando" ? <Loader2 size={11} className="animate-spin" /> : estado === "salvo" ? <Check size={11} /> : null}
            {estado === "salvo" ? "salvo" : estado === "salvando" ? "salvando" : estado === "erro" ? "erro ao salvar" : "não salvo"}
          </span>
          {vazia ? (
            <button
              type="button"
              onClick={() => void descartar()}
              title="Descartar nota vazia (vai para a lixeira)"
              className="inline-flex size-7 items-center justify-center rounded-lg text-tinta-3 hover:bg-[color-mix(in_srgb,var(--perigo)_10%,transparent)] hover:text-perigo"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11.5px] text-tinta-2">
          <span className="shrink-0">Guardar em</span>
          <select
            value={destinoAtual}
            onChange={(evento) => void mover(evento.target.value)}
            className="h-7 min-w-0 flex-1 rounded-md border border-linha bg-superficie-alta px-2 focus:border-[var(--realce)] focus:outline-none"
          >
            {cadernos.map((caderno) => (
              <optgroup key={caderno.caminho} label={caderno.nome}>
                {caderno.secoes.map((secao) => (
                  <option key={secao.caminho} value={secao.caminho}>{secao.nome}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {erro ? <p className="mt-1.5 text-[11.5px] text-perigo" role="alert">{erro}</p> : null}
      </header>

      <textarea
        autoFocus
        defaultValue={conteudo}
        onChange={(evento) => {
          conteudoAtual.current = evento.target.value;
          definirConteudo(evento.target.value);
        }}
        spellCheck
        aria-label="Conteúdo da nota rápida"
        placeholder="Comece a escrever…"
        className="editor-texto min-h-0 flex-1 resize-none bg-papel px-5 py-4 text-[14px] leading-relaxed placeholder:text-tinta-3 focus:outline-none"
      />
    </main>
  );
}
