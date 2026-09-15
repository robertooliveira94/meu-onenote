"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { acaoTarefasComPrazoVencendo } from "@/app/acoes-kanban";
import type { TarefaComPrazo } from "@/lib/kanban";
import { urlDoQuadro } from "@/lib/rotas";

/**
 * Avisos de prazo do Kanban, atravessando o hub inteiro: de dentro de Links
 * ou Senhas a pessoa fica sabendo que uma tarefa atrasou, sem abrir quadro
 * por quadro.
 *
 * Duas camadas, ambas alimentadas pela mesma varredura do índice:
 * - um ponto no ícone do Kanban no trilho quando há tarefa atrasada (sempre);
 * - uma notificação do navegador, só se a pessoa ligar em Preferências —
 *   uma por dia por conjunto de tarefas, pra não repetir a cada recarregar.
 */

export type AvisosDePrazo = { atrasadas: TarefaComPrazo[]; vencemHoje: TarefaComPrazo[] };

const VAZIO: AvisosDePrazo = { atrasadas: [], vencemHoje: [] };
const INTERVALO_VARREDURA = 30 * 60 * 1000;
const CHAVE_PREFERENCIA = "avisar-prazos";
const CHAVE_AVISADOS = "prazos-avisados";
const EVENTO_PREFERENCIA = "avisar-prazos-mudou";

/** Data local de hoje em AAAA-MM-DD — o prazo das tarefas é guardado sem hora, então o fuso é o da pessoa. */
export function hojeLocalISO(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function lerPreferencia(): boolean {
  try {
    return localStorage.getItem(CHAVE_PREFERENCIA) === "1";
  } catch {
    return false;
  }
}

/**
 * A preferência "Avisar prazos do Kanban". Ligar pede a permissão de
 * notificação ao navegador (que só aceita o pedido vindo de um clique);
 * se a pessoa negar, a preferência não liga.
 */
export function useAvisarPrazos() {
  const [ligado, definirLigado] = useState(false);
  const [suportado, definirSuportado] = useState(true);

  useEffect(() => {
    definirSuportado(typeof Notification !== "undefined");
    definirLigado(lerPreferencia() && typeof Notification !== "undefined" && Notification.permission === "granted");
  }, []);

  const alternar = useCallback(async () => {
    const proximo = !ligado;
    if (proximo) {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") return;
    }
    try {
      localStorage.setItem(CHAVE_PREFERENCIA, proximo ? "1" : "0");
    } catch {
      // Sem armazenamento: vale só para esta sessão.
    }
    definirLigado(proximo);
    window.dispatchEvent(new Event(EVENTO_PREFERENCIA));
  }, [ligado]);

  return { ligado, suportado, alternar };
}

type Avisados = { data: string; caminhos: string[] };

function lerAvisados(): Avisados {
  try {
    const bruto = localStorage.getItem(CHAVE_AVISADOS);
    if (bruto) {
      const lido = JSON.parse(bruto) as Partial<Avisados>;
      if (typeof lido.data === "string" && Array.isArray(lido.caminhos)) {
        return { data: lido.data, caminhos: lido.caminhos.filter((item) => typeof item === "string") };
      }
    }
  } catch {
    // Ignora e recomeça.
  }
  return { data: "", caminhos: [] };
}

function guardarAvisados(avisados: Avisados): void {
  try {
    localStorage.setItem(CHAVE_AVISADOS, JSON.stringify(avisados));
  } catch {
    // Sem armazenamento: pode repetir o aviso na próxima carga.
  }
}

function tituloDoAviso(avisos: AvisosDePrazo): string {
  const partes: string[] = [];
  const n = avisos.atrasadas.length;
  const h = avisos.vencemHoje.length;
  if (n) partes.push(n === 1 ? "1 tarefa atrasada" : `${n} tarefas atrasadas`);
  if (h) partes.push(h === 1 ? "1 vence hoje" : `${h} vencem hoje`);
  return partes.join(" · ");
}

/**
 * Varre o índice ao montar, a cada 30 min, ao voltar pra aba e a cada
 * navegação (é só uma leitura do índice), e devolve o que está atrasado ou
 * vence hoje. Quando a preferência está ligada, dispara a notificação —
 * uma vez por dia para cada conjunto de tarefas.
 */
export function useAvisosDePrazo(): AvisosDePrazo {
  const [avisos, definirAvisos] = useState<AvisosDePrazo>(VAZIO);
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const roteadorRef = useRef(roteador);
  roteadorRef.current = roteador;

  const notificar = useCallback((novos: AvisosDePrazo) => {
    if (!lerPreferencia()) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const todas = [...novos.atrasadas, ...novos.vencemHoje];
    if (!todas.length) return;

    const hoje = hojeLocalISO();
    const avisados = lerAvisados();
    const jaAvisados = new Set(avisados.data === hoje ? avisados.caminhos : []);
    if (todas.every((tarefa) => jaAvisados.has(tarefa.caminho))) return;

    const corpo = todas
      .slice(0, 5)
      .map((tarefa) => `${tarefa.titulo} — ${tarefa.quadro}`)
      .join("\n");
    const primeira = todas[0];
    try {
      const notificacao = new Notification(tituloDoAviso(novos), { body: corpo, tag: "prazos-kanban" });
      notificacao.onclick = () => {
        window.focus();
        roteadorRef.current.push(urlDoQuadro(primeira.quadro));
        notificacao.close();
      };
    } catch {
      // Alguns navegadores só aceitam Notification via service worker; sem ele, fica só o ponto no trilho.
      return;
    }
    guardarAvisados({ data: hoje, caminhos: [...new Set([...jaAvisados, ...todas.map((t) => t.caminho)])] });
  }, []);

  const varrer = useCallback(async () => {
    try {
      const novos = await acaoTarefasComPrazoVencendo(hojeLocalISO());
      definirAvisos(novos);
      notificar(novos);
    } catch {
      // Servidor fora ou índice indisponível: mantém o último estado.
    }
  }, [notificar]);

  // Ao montar e a cada navegação — mover uma tarefa pra "Feito" apaga o ponto
  // assim que a pessoa troca de tela, sem esperar a próxima varredura.
  useEffect(() => {
    void varrer();
  }, [varrer, caminhoAtual]);

  useEffect(() => {
    const cronometro = window.setInterval(() => void varrer(), INTERVALO_VARREDURA);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void varrer();
    };
    const aoMudarPreferencia = () => void varrer();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener(EVENTO_PREFERENCIA, aoMudarPreferencia);
    return () => {
      window.clearInterval(cronometro);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener(EVENTO_PREFERENCIA, aoMudarPreferencia);
    };
  }, [varrer]);

  return avisos;
}
