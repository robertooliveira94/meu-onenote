"use client";

import clsx from "clsx";
import {
  BellRing,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FolderPlus,
  HeartPulse,
  History,
  Link2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  Stethoscope,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  acaoApagarDeVezDaLixeiraSaude,
  acaoAtualizarEspecialidade,
  acaoAtualizarEvento,
  acaoAtualizarLocal,
  acaoAtualizarProfissional,
  acaoCriarEspecialidade,
  acaoCriarEvento,
  acaoCriarLocal,
  acaoCriarProfissional,
  acaoExcluirEspecialidade,
  acaoExcluirEvento,
  acaoExcluirLocal,
  acaoExcluirProfissional,
  acaoEsvaziarLixeiraSaude,
  acaoListarLixeiraSaude,
  acaoMudarStatusEvento,
  acaoRemoverAnexo,
  acaoReordenarEspecialidades,
  acaoRestaurarDaLixeiraSaude,
  type RespostaSaude,
} from "@/app/acoes-saude";
import { useAtalho } from "@/lib/atalhos";
import { CORES_CADERNO, ICONES_DISPONIVEIS } from "@/lib/cores";
import type { CamposEvento, CamposLocal, CamposProfissional, ExtrasEvento, ItemLixeiraSaude } from "@/lib/saude-app";
import {
  ROTULO_STATUS,
  ROTULO_TIPO,
  TIPOS_EVENTO,
  alertasDeSaude,
  formatarDataSaude,
  formatarTamanho,
  hojeIso,
  ordenarEventos,
  rotuloDoMes,
  statusDisponiveis,
  type AlertaSaude,
} from "@/lib/saude-comum";
import type {
  DadosSaude,
  EspecialidadeSaude,
  EventoSaude,
  LocalSaude,
  ProfissionalSaude,
  StatusEventoSaude,
  TipoEventoSaude,
} from "@/lib/tipos";

import { DialogoConfirmar, DialogoConfirmarComTexto, DialogoCor, DialogoIcone, DialogoNome, DialogoNovoCaderno } from "./dialogos";
import { Aviso, Botao, BotaoIcone, Campo, Dialogo, ItemMenu, Menu, Rotulo, SeparadorMenu, Vazio } from "./ui";
import { VisualizadorMarkdown } from "./visualizador-markdown";

type Selecao =
  | { tipo: "proximos" }
  | { tipo: "linha" }
  | { tipo: "especialidade"; id: string }
  | { tipo: "locais" }
  | { tipo: "profissionais" }
  | { tipo: "lixeira" };

/** As visões em que clicar num registro abre o painel de detalhe ao lado. */
function mostraDetalhe(selecao: Selecao | null): boolean {
  return selecao?.tipo === "proximos" || selecao?.tipo === "linha" || selecao?.tipo === "especialidade";
}

const CLASSE_SELECT =
  "h-9.5 w-full rounded-lg border border-linha bg-superficie-alta px-3 text-[13px] text-tinta focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none";

const CLASSE_TEXTAREA =
  "w-full resize-none rounded-lg border border-linha bg-superficie-alta px-3 py-2 text-[13px] text-tinta transition-shadow placeholder:text-tinta-3 focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none";

const COR_STATUS: Record<StatusEventoSaude, string> = {
  solicitado: "#F5822C",
  agendado: "#2D7FF9",
  "aguardando-resultado": "#7C5CFC",
  realizado: "#0EA47C",
  cancelado: "#7C93A8",
};

function Selo({ texto, cor }: { texto: string; cor: string }) {
  return (
    <span
      className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium whitespace-nowrap"
      style={{ color: `color-mix(in srgb, ${cor} 82%, var(--tinta))`, background: `color-mix(in srgb, ${cor} 14%, transparent)` }}
    >
      {texto}
    </span>
  );
}

/**
 * A app de Saúde: coluna com as especialidades (e os cadastros de apoio no
 * rodapé), a lista de eventos da especialidade aberta no meio e o detalhe
 * do evento à direita — o mesmo esqueleto de Senhas. Estado local
 * otimista: cada ação devolve os dados inteiros.
 */
export function AppSaude({ dadosIniciais }: { dadosIniciais: DadosSaude }) {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const [dados, definirDados] = useState(dadosIniciais);
  // Com registros, abre em Próximos (é o que se olha antes de ligar pra
  // clínica); sem nenhum, na primeira especialidade; sem nenhuma, o vazio.
  const [selecao, definirSelecao] = useState<Selecao | null>(
    dadosIniciais.eventos.length
      ? { tipo: "proximos" }
      : dadosIniciais.especialidades[0]
        ? { tipo: "especialidade", id: dadosIniciais.especialidades[0].id }
        : null,
  );
  // Especialidade pré-escolhida ao abrir "novo registro" fora de uma especialidade (Próximos, "está na hora").
  const [especialidadeParaNovo, definirEspecialidadeParaNovo] = useState<string | null>(null);
  const [eventoAtivoId, definirEventoAtivoId] = useState<string | null>(null);
  const [eventoEmEdicao, definirEventoEmEdicao] = useState<EventoSaude | "novo" | null>(null);
  const [excluindoEvento, definirExcluindoEvento] = useState<EventoSaude | null>(null);
  const [acaoEspecialidade, definirAcaoEspecialidade] = useState<
    { tipo: "nova" } | { tipo: "renomear" | "icone" | "cor" | "alerta" | "excluir"; especialidade: EspecialidadeSaude } | null
  >(null);

  // `?evento=<id>` (resultado da busca global) abre o evento já na chegada.
  const eventoNaUrl = parametros.get("evento");
  useEffect(() => {
    if (!eventoNaUrl) return;
    const evento = dados.eventos.find((item) => item.id === eventoNaUrl);
    if (evento) {
      definirSelecao({ tipo: "especialidade", id: evento.especialidadeId });
      definirEventoAtivoId(evento.id);
    }
    roteador.replace("/saude");
    // Só na chegada com parâmetro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoNaUrl, roteador]);

  const aplicar = useCallback((resposta: RespostaSaude): boolean => {
    if (resposta.ok) {
      definirDados(resposta.dados);
      return true;
    }
    alert(resposta.erro);
    return false;
  }, []);

  const especialidadeAtiva =
    selecao?.tipo === "especialidade" ? (dados.especialidades.find((item) => item.id === selecao.id) ?? null) : null;

  // Especialidade sumiu (excluída): cai na primeira que sobrou.
  useEffect(() => {
    if (selecao?.tipo === "especialidade" && !especialidadeAtiva) {
      const primeira = dados.especialidades[0];
      definirSelecao(primeira ? { tipo: "especialidade", id: primeira.id } : null);
    }
  }, [selecao, especialidadeAtiva, dados.especialidades]);

  const eventosDaEspecialidade = useMemo(
    () => (especialidadeAtiva ? ordenarEventos(dados.eventos.filter((evento) => evento.especialidadeId === especialidadeAtiva.id)) : []),
    [dados.eventos, especialidadeAtiva],
  );
  const eventoAtivo = eventoAtivoId ? (dados.eventos.find((item) => item.id === eventoAtivoId) ?? null) : null;

  useEffect(() => {
    if (eventoAtivoId && !eventoAtivo) definirEventoAtivoId(null);
  }, [eventoAtivoId, eventoAtivo]);

  useAtalho("n", {
    grupo: "Saúde",
    descricao: "Novo registro",
    ativo: dados.especialidades.length > 0 && mostraDetalhe(selecao),
    acao: () => definirEventoEmEdicao("novo"),
  });

  const alertas = useMemo(() => alertasDeSaude(dados), [dados]);
  const hoje = hojeIso();
  const proximos = useMemo(() => {
    const agendados = dados.eventos
      .filter((evento) => evento.status === "agendado" && evento.data !== null)
      .sort((a, b) => a.data!.localeCompare(b.data!) || (a.hora ?? "").localeCompare(b.hora ?? ""));
    const aguardando = ordenarEventos(dados.eventos.filter((evento) => evento.status === "aguardando-resultado"));
    const solicitados = ordenarEventos(dados.eventos.filter((evento) => evento.status === "solicitado"));
    return { agendados, aguardando, solicitados };
  }, [dados.eventos]);
  const totalProximos = alertas.length + proximos.agendados.length + proximos.aguardando.length + proximos.solicitados.length;

  const abrirNovo = useCallback((especialidadeId?: string) => {
    definirEspecialidadeParaNovo(especialidadeId ?? null);
    definirEventoEmEdicao("novo");
  }, []);

  const irParaEvento = useCallback(
    (id: string) => {
      const alvo = dados.eventos.find((item) => item.id === id);
      if (!alvo) return;
      if (!mostraDetalhe(selecao)) definirSelecao({ tipo: "especialidade", id: alvo.especialidadeId });
      definirEventoAtivoId(id);
    },
    [dados.eventos, selecao],
  );

  const contagemPorEspecialidade = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const evento of dados.eventos) mapa.set(evento.especialidadeId, (mapa.get(evento.especialidadeId) ?? 0) + 1);
    return mapa;
  }, [dados.eventos]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-linha bg-superficie px-5 py-2.5">
        <HeartPulse size={15} className="shrink-0 text-tinta-3" />
        <h1 className="shrink-0 text-[13px] font-bold tracking-[-0.02em]">Saúde</h1>
        <span className="text-[11.5px] text-tinta-3">
          {dados.eventos.length ? `${dados.eventos.length} ${dados.eventos.length === 1 ? "registro" : "registros"}` : ""}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <ColunaSaude
          dados={dados}
          selecao={selecao}
          contagem={contagemPorEspecialidade}
          totalProximos={totalProximos}
          temAlerta={alertas.length > 0}
          onSelecionar={(nova) => {
            definirSelecao(nova);
            definirEventoAtivoId(null);
          }}
          onNovaEspecialidade={() => definirAcaoEspecialidade({ tipo: "nova" })}
          onAgirEspecialidade={(tipo, especialidade) => definirAcaoEspecialidade({ tipo, especialidade })}
          onReordenar={async (ordem) => aplicar(await acaoReordenarEspecialidades(ordem))}
        />

        {selecao?.tipo === "locais" ? (
          <CadastroLocais dados={dados} aplicar={aplicar} />
        ) : selecao?.tipo === "profissionais" ? (
          <CadastroProfissionais dados={dados} aplicar={aplicar} />
        ) : selecao?.tipo === "lixeira" ? (
          <LixeiraSaude aplicar={aplicar} />
        ) : selecao?.tipo === "proximos" ? (
          <VisaoProximos
            dados={dados}
            alertas={alertas}
            agendados={proximos.agendados}
            aguardando={proximos.aguardando}
            solicitados={proximos.solicitados}
            hoje={hoje}
            eventoAtivoId={eventoAtivoId}
            onSelecionar={definirEventoAtivoId}
            onNovo={abrirNovo}
            onConfigurarAlerta={(especialidade) => definirAcaoEspecialidade({ tipo: "alerta", especialidade })}
          />
        ) : selecao?.tipo === "linha" ? (
          <VisaoLinhaDoTempo dados={dados} eventoAtivoId={eventoAtivoId} onSelecionar={definirEventoAtivoId} onNovo={() => abrirNovo()} />
        ) : especialidadeAtiva ? (
          <ListaEventos
            especialidade={especialidadeAtiva}
            eventos={eventosDaEspecialidade}
            dados={dados}
            eventoAtivoId={eventoAtivoId}
            onSelecionar={definirEventoAtivoId}
            onNovo={() => abrirNovo(especialidadeAtiva.id)}
            onAgirEspecialidade={(tipo) => definirAcaoEspecialidade({ tipo, especialidade: especialidadeAtiva })}
          />
        ) : (
          <div className="flex min-w-0 flex-1 items-center justify-center">
            <Vazio
              icone={<Stethoscope size={22} />}
              titulo="Comece por uma especialidade"
              descricao="Cardiologia, dentista, oftalmologia — do jeito que você pensa. Cada uma vira uma linha do tempo de consultas, exames, procedimentos e vacinas."
            >
              <Botao variante="primario" onClick={() => definirAcaoEspecialidade({ tipo: "nova" })}>
                <Plus size={13} />
                Nova especialidade
              </Botao>
            </Vazio>
          </div>
        )}
        {eventoAtivo && mostraDetalhe(selecao) ? (
          <DetalheEvento
            evento={eventoAtivo}
            dados={dados}
            aplicar={aplicar}
            onFechar={() => definirEventoAtivoId(null)}
            onEditar={() => definirEventoEmEdicao(eventoAtivo)}
            onExcluir={() => definirExcluindoEvento(eventoAtivo)}
            onIrPara={irParaEvento}
          />
        ) : null}
      </div>

      {eventoEmEdicao && dados.especialidades.length > 0 ? (
        <DialogoEvento
          evento={eventoEmEdicao === "novo" ? null : eventoEmEdicao}
          especialidadeInicial={especialidadeParaNovo ?? especialidadeAtiva?.id ?? dados.especialidades[0].id}
          dados={dados}
          aoFechar={() => definirEventoEmEdicao(null)}
          aoSalvar={async (id, campos, extras) => {
            if (id) {
              const resposta = await acaoAtualizarEvento(id, campos, extras);
              if (!resposta.ok) return resposta.erro;
              definirDados(resposta.dados);
            } else {
              const resposta = await acaoCriarEvento(campos, extras);
              if (!resposta.ok) return resposta.erro;
              definirDados(resposta.dados);
              definirEventoAtivoId(resposta.id);
            }
            if (selecao?.tipo === "especialidade" && campos.especialidadeId !== selecao.id) {
              definirSelecao({ tipo: "especialidade", id: campos.especialidadeId });
            }
            definirEventoEmEdicao(null);
            return null;
          }}
        />
      ) : null}

      {excluindoEvento ? (
        <DialogoConfirmar
          aberto
          titulo={`Excluir "${excluindoEvento.titulo}"?`}
          descricao={
            excluindoEvento.anexos.length
              ? `Vai para a lixeira com ${excluindoEvento.anexos.length === 1 ? "o anexo" : `os ${excluindoEvento.anexos.length} anexos`} — dá para restaurar depois.`
              : "Vai para a lixeira — dá para restaurar depois."
          }
          textoBotao="Mandar para a lixeira"
          aoFechar={() => definirExcluindoEvento(null)}
          aoConfirmar={async () => {
            const resposta = await acaoExcluirEvento(excluindoEvento.id);
            if (!resposta.ok) return resposta.erro;
            definirDados(resposta.dados);
            definirExcluindoEvento(null);
            return null;
          }}
        />
      ) : null}

      <DialogoNovoCaderno
        aberto={acaoEspecialidade?.tipo === "nova"}
        titulo="Nova especialidade"
        descricao="Do jeito que você pensa: Cardiologia, Dentista, Fisioterapia…"
        rotulo="Nome"
        textoBotao="Criar"
        aoFechar={() => definirAcaoEspecialidade(null)}
        aoConfirmar={async (nome, icone, cor) => {
          const resposta = await acaoCriarEspecialidade(nome, icone ?? undefined, cor ?? undefined);
          if (!resposta.ok) return resposta.erro;
          definirDados(resposta.dados);
          const nova = resposta.dados.especialidades.find((item) => item.nome.toLowerCase() === nome.toLowerCase());
          if (nova) definirSelecao({ tipo: "especialidade", id: nova.id });
          return null;
        }}
      />

      {acaoEspecialidade?.tipo === "renomear" ? (
        <DialogoNome
          aberto
          titulo="Renomear especialidade"
          rotulo="Nome"
          valorInicial={acaoEspecialidade.especialidade.nome}
          textoBotao="Salvar"
          aoFechar={() => definirAcaoEspecialidade(null)}
          aoConfirmar={async (nome) => {
            const resposta = await acaoAtualizarEspecialidade(acaoEspecialidade.especialidade.id, { nome });
            if (!resposta.ok) return resposta.erro;
            definirDados(resposta.dados);
            return null;
          }}
        />
      ) : null}

      <DialogoIcone
        aberto={acaoEspecialidade?.tipo === "icone"}
        icones={ICONES_DISPONIVEIS}
        iconeAtual={acaoEspecialidade?.tipo === "icone" ? acaoEspecialidade.especialidade.icone : ""}
        aoFechar={() => definirAcaoEspecialidade(null)}
        aoEscolher={async (icone) => {
          if (acaoEspecialidade?.tipo !== "icone") return null;
          const resposta = await acaoAtualizarEspecialidade(acaoEspecialidade.especialidade.id, { icone });
          if (!resposta.ok) return resposta.erro;
          definirDados(resposta.dados);
          return null;
        }}
      />

      <DialogoCor
        aberto={acaoEspecialidade?.tipo === "cor"}
        cores={CORES_CADERNO}
        corAtual={acaoEspecialidade?.tipo === "cor" ? acaoEspecialidade.especialidade.cor : ""}
        aoFechar={() => definirAcaoEspecialidade(null)}
        aoEscolher={async (cor) => {
          if (acaoEspecialidade?.tipo !== "cor") return null;
          const resposta = await acaoAtualizarEspecialidade(acaoEspecialidade.especialidade.id, { cor });
          if (!resposta.ok) return resposta.erro;
          definirDados(resposta.dados);
          return null;
        }}
      />

      {acaoEspecialidade?.tipo === "alerta" ? (
        <DialogoAlerta
          especialidade={acaoEspecialidade.especialidade}
          aoFechar={() => definirAcaoEspecialidade(null)}
          aoSalvar={async (meses) => {
            const resposta = await acaoAtualizarEspecialidade(acaoEspecialidade.especialidade.id, { mesesAlerta: meses });
            if (!resposta.ok) return resposta.erro;
            definirDados(resposta.dados);
            definirAcaoEspecialidade(null);
            return null;
          }}
        />
      ) : null}

      {acaoEspecialidade?.tipo === "excluir" ? (
        (contagemPorEspecialidade.get(acaoEspecialidade.especialidade.id) ?? 0) > 0 ? (
          <DialogoConfirmarComTexto
            aberto
            titulo={`Excluir ${acaoEspecialidade.especialidade.nome}?`}
            descricao={`Os ${contagemPorEspecialidade.get(acaoEspecialidade.especialidade.id)} registros dela vão para a lixeira (com os anexos). A especialidade em si não volta.`}
            palavra={acaoEspecialidade.especialidade.nome}
            rotulo={
              <>
                Digite <span className="font-mono text-tinta">{acaoEspecialidade.especialidade.nome}</span> para confirmar
              </>
            }
            textoBotao="Excluir especialidade"
            aoFechar={() => definirAcaoEspecialidade(null)}
            aoConfirmar={async () => {
              const resposta = await acaoExcluirEspecialidade(acaoEspecialidade.especialidade.id);
              if (!resposta.ok) return resposta.erro;
              definirDados(resposta.dados);
              definirAcaoEspecialidade(null);
              return null;
            }}
          />
        ) : (
          <DialogoConfirmar
            aberto
            titulo={`Excluir ${acaoEspecialidade.especialidade.nome}?`}
            descricao="Não tem nenhum registro dentro."
            textoBotao="Excluir"
            aoFechar={() => definirAcaoEspecialidade(null)}
            aoConfirmar={async () => {
              const resposta = await acaoExcluirEspecialidade(acaoEspecialidade.especialidade.id);
              if (!resposta.ok) return resposta.erro;
              definirDados(resposta.dados);
              definirAcaoEspecialidade(null);
              return null;
            }}
          />
        )
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Coluna                                                                   */
/* ---------------------------------------------------------------------- */

function ColunaSaude({
  dados,
  selecao,
  contagem,
  totalProximos,
  temAlerta,
  onSelecionar,
  onNovaEspecialidade,
  onAgirEspecialidade,
  onReordenar,
}: {
  dados: DadosSaude;
  selecao: Selecao | null;
  contagem: Map<string, number>;
  totalProximos: number;
  temAlerta: boolean;
  onSelecionar: (selecao: Selecao) => void;
  onNovaEspecialidade: () => void;
  onAgirEspecialidade: (tipo: "renomear" | "icone" | "cor" | "alerta" | "excluir", especialidade: EspecialidadeSaude) => void;
  onReordenar: (ordem: string[]) => void;
}) {
  function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= dados.especialidades.length) return;
    const ordem = dados.especialidades.map((item) => item.id);
    [ordem[indice], ordem[alvo]] = [ordem[alvo], ordem[indice]];
    onReordenar(ordem);
  }

  return (
    <div className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-linha bg-papel">
      <div className="space-y-0.5 px-2 pt-3">
        <BotaoRodape
          ativo={selecao?.tipo === "proximos"}
          icone={<CalendarClock size={13} />}
          contagem={totalProximos}
          alerta={temAlerta}
          onClick={() => onSelecionar({ tipo: "proximos" })}
        >
          Próximos
        </BotaoRodape>
        <BotaoRodape ativo={selecao?.tipo === "linha"} icone={<History size={13} />} contagem={0} onClick={() => onSelecionar({ tipo: "linha" })}>
          Linha do tempo
        </BotaoRodape>
      </div>
      <div className="flex items-center justify-between px-3.5 pt-4 pb-1.5">
        <p className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Especialidades</p>
        <BotaoIcone rotulo="Nova especialidade" onClick={onNovaEspecialidade} className="size-6">
          <FolderPlus size={13} />
        </BotaoIcone>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {dados.especialidades.length === 0 ? (
          <p className="px-2 py-3 text-[12px] leading-relaxed text-tinta-3">Nenhuma ainda. Crie pelo “+” acima.</p>
        ) : null}
        {dados.especialidades.map((especialidade, indice) => {
          const ativa = selecao?.tipo === "especialidade" && selecao.id === especialidade.id;
          return (
            <div key={especialidade.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => onSelecionar({ tipo: "especialidade", id: especialidade.id })}
                aria-pressed={ativa}
                className={clsx(
                  "linha-nav flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors",
                  ativa ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
                )}
              >
                <span aria-hidden className="shrink-0">
                  {especialidade.icone}
                </span>
                <span className="min-w-0 flex-1 truncate">{especialidade.nome}</span>
                <span className="shrink-0 text-[10.5px] text-tinta-3 tabular-nums group-hover:hidden">
                  {contagem.get(especialidade.id) || ""}
                </span>
              </button>
              <Menu
                gatilho={(abrir) => (
                  <BotaoIcone
                    rotulo={`Opções de ${especialidade.nome}`}
                    onClick={abrir}
                    className="size-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <MoreHorizontal size={13} />
                  </BotaoIcone>
                )}
              >
                {(fechar) => (
                  <>
                    <ItemMenu icone={<Pencil size={14} />} onClick={() => { fechar(); onAgirEspecialidade("renomear", especialidade); }}>
                      Renomear
                    </ItemMenu>
                    <ItemMenu icone={<span className="text-[13px]">{especialidade.icone}</span>} onClick={() => { fechar(); onAgirEspecialidade("icone", especialidade); }}>
                      Ícone
                    </ItemMenu>
                    <ItemMenu
                      icone={<span className="size-3 rounded-full" style={{ background: especialidade.cor }} />}
                      onClick={() => { fechar(); onAgirEspecialidade("cor", especialidade); }}
                    >
                      Cor
                    </ItemMenu>
                    <ItemMenu icone={<BellRing size={14} />} onClick={() => { fechar(); onAgirEspecialidade("alerta", especialidade); }}>
                      {especialidade.mesesAlerta === null ? "Alerta…" : `Alerta: ${especialidade.mesesAlerta} meses`}
                    </ItemMenu>
                    <SeparadorMenu />
                    <ItemMenu icone={<ChevronUp size={14} />} onClick={() => { fechar(); mover(indice, -1); }} disabled={indice === 0}>
                      Subir
                    </ItemMenu>
                    <ItemMenu icone={<ChevronDown size={14} />} onClick={() => { fechar(); mover(indice, 1); }} disabled={indice === dados.especialidades.length - 1}>
                      Descer
                    </ItemMenu>
                    <SeparadorMenu />
                    <ItemMenu icone={<Trash2 size={14} />} perigo onClick={() => { fechar(); onAgirEspecialidade("excluir", especialidade); }}>
                      Excluir
                    </ItemMenu>
                  </>
                )}
              </Menu>
            </div>
          );
        })}
      </div>
      <div className="space-y-0.5 border-t border-linha px-2 py-1.5">
        <BotaoRodape
          ativo={selecao?.tipo === "locais"}
          icone={<Building2 size={13} />}
          contagem={dados.locais.length}
          onClick={() => onSelecionar({ tipo: "locais" })}
        >
          Locais
        </BotaoRodape>
        <BotaoRodape
          ativo={selecao?.tipo === "profissionais"}
          icone={<UserRound size={13} />}
          contagem={dados.profissionais.length}
          onClick={() => onSelecionar({ tipo: "profissionais" })}
        >
          Profissionais
        </BotaoRodape>
        <BotaoRodape ativo={selecao?.tipo === "lixeira"} icone={<Trash2 size={13} />} contagem={0} onClick={() => onSelecionar({ tipo: "lixeira" })}>
          Lixeira
        </BotaoRodape>
      </div>
    </div>
  );
}

function BotaoRodape({
  ativo,
  icone,
  contagem,
  alerta = false,
  onClick,
  children,
}: {
  ativo: boolean;
  icone: React.ReactNode;
  contagem: number;
  /** Bolinha laranja: tem "está na hora" esperando lá dentro. */
  alerta?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={clsx(
        "linha-nav flex w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors",
        ativo ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
      )}
    >
      <span className="shrink-0 text-tinta-3">{icone}</span>
      <span className="flex-1 truncate">{children}</span>
      {alerta ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[#F5822C]" /> : null}
      <span className="text-[10.5px] text-tinta-3 tabular-nums">{contagem || ""}</span>
    </button>
  );
}

/* ---------------------------------------------------------------------- */
/* Lista de eventos                                                         */
/* ---------------------------------------------------------------------- */

function ListaEventos({
  especialidade,
  eventos,
  dados,
  eventoAtivoId,
  onSelecionar,
  onNovo,
  onAgirEspecialidade,
}: {
  especialidade: EspecialidadeSaude;
  eventos: EventoSaude[];
  dados: DadosSaude;
  eventoAtivoId: string | null;
  onSelecionar: (id: string) => void;
  onNovo: () => void;
  onAgirEspecialidade: (tipo: "renomear" | "icone" | "cor" | "alerta" | "excluir") => void;
}) {
  const profissionais = useMemo(() => new Map(dados.profissionais.map((item) => [item.id, item.nome])), [dados.profissionais]);
  const locais = useMemo(() => new Map(dados.locais.map((item) => [item.id, item.nome])), [dados.locais]);

  return (
    <div className="flex min-w-0 flex-1 flex-col" style={{ "--realce": especialidade.cor } as React.CSSProperties}>
      <div className="flex shrink-0 items-center gap-2 border-b border-linha px-5 py-2.5">
        <span aria-hidden className="text-[16px]">
          {especialidade.icone}
        </span>
        <h2 className="min-w-0 truncate text-[14px] font-bold tracking-[-0.02em]">{especialidade.nome}</h2>
        <span className="text-[11.5px] text-tinta-3">{eventos.length ? `${eventos.length} ${eventos.length === 1 ? "registro" : "registros"}` : ""}</span>
        <div className="ml-auto flex items-center gap-1">
          <Menu
            gatilho={(abrir) => (
              <BotaoIcone rotulo="Opções da especialidade" onClick={abrir}>
                <MoreHorizontal size={14} />
              </BotaoIcone>
            )}
          >
            {(fechar) => (
              <>
                <ItemMenu icone={<Pencil size={14} />} onClick={() => { fechar(); onAgirEspecialidade("renomear"); }}>Renomear</ItemMenu>
                <ItemMenu icone={<span className="text-[13px]">{especialidade.icone}</span>} onClick={() => { fechar(); onAgirEspecialidade("icone"); }}>Ícone</ItemMenu>
                <ItemMenu icone={<span className="size-3 rounded-full" style={{ background: especialidade.cor }} />} onClick={() => { fechar(); onAgirEspecialidade("cor"); }}>Cor</ItemMenu>
                <ItemMenu icone={<BellRing size={14} />} onClick={() => { fechar(); onAgirEspecialidade("alerta"); }}>
                  {especialidade.mesesAlerta === null ? "Alerta…" : `Alerta: ${especialidade.mesesAlerta} meses`}
                </ItemMenu>
                <SeparadorMenu />
                <ItemMenu icone={<Trash2 size={14} />} perigo onClick={() => { fechar(); onAgirEspecialidade("excluir"); }}>Excluir</ItemMenu>
              </>
            )}
          </Menu>
          <Botao variante="primario" onClick={onNovo}>
            <Plus size={13} />
            Novo registro
          </Botao>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {eventos.length === 0 ? (
          <Vazio
            icone={<CalendarDays size={22} />}
            titulo={`Nada em ${especialidade.nome} ainda`}
            descricao="Registre a próxima consulta, o exame que pediram, a vacina que tomou — e anexe o laudo quando sair."
          >
            <Botao variante="primario" onClick={onNovo}>
              <Plus size={13} />
              Novo registro
            </Botao>
          </Vazio>
        ) : (
          <div className="space-y-0.5">
            {eventos.map((evento) => (
              <LinhaEvento
                key={evento.id}
                evento={evento}
                profissional={evento.profissionalId ? (profissionais.get(evento.profissionalId) ?? null) : null}
                local={evento.localId ? (locais.get(evento.localId) ?? null) : null}
                ativa={evento.id === eventoAtivoId}
                onSelecionar={onSelecionar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const LinhaEvento = memo(function LinhaEvento({
  evento,
  profissional,
  local,
  especialidade,
  ativa,
  onSelecionar,
}: {
  evento: EventoSaude;
  profissional: string | null;
  local: string | null;
  /** Nas visões que misturam especialidades (Próximos, linha do tempo), a linha diz de qual é. */
  especialidade?: EspecialidadeSaude | null;
  ativa: boolean;
  onSelecionar: (id: string) => void;
}) {
  const passado = evento.data !== null && evento.data < hojeIso();
  return (
    <button
      type="button"
      onClick={() => onSelecionar(evento.id)}
      aria-pressed={ativa}
      className={clsx(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        ativa ? "bg-realce-medio" : "hover:bg-realce-fraco",
      )}
    >
      <span className="w-[5.5rem] shrink-0">
        <span className={clsx("block text-[12.5px] tabular-nums", evento.data ? "text-tinta" : "text-tinta-3 italic")}>
          {formatarDataSaude(evento.data)}
        </span>
        {evento.hora ? <span className="block text-[11px] text-tinta-3 tabular-nums">{evento.hora}</span> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-tinta">{evento.titulo}</span>
          {evento.titulo !== ROTULO_TIPO[evento.tipo] ? (
            <span className="shrink-0 text-[10.5px] text-tinta-3">{ROTULO_TIPO[evento.tipo]}</span>
          ) : null}
        </span>
        {profissional || local || especialidade ? (
          <span className="block truncate text-[11.5px] text-tinta-3">
            {[especialidade ? `${especialidade.icone} ${especialidade.nome}` : null, profissional, local].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
      {evento.anexos.length ? (
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-tinta-3">
          <Paperclip size={11} />
          {evento.anexos.length}
        </span>
      ) : null}
      <Selo texto={ROTULO_STATUS[evento.status]} cor={evento.status === "agendado" && passado ? "#F5822C" : COR_STATUS[evento.status]} />
    </button>
  );
});

/* ---------------------------------------------------------------------- */
/* Detalhe do evento                                                        */
/* ---------------------------------------------------------------------- */

function DetalheEvento({
  evento,
  dados,
  aplicar,
  onFechar,
  onEditar,
  onExcluir,
  onIrPara,
}: {
  evento: EventoSaude;
  dados: DadosSaude;
  aplicar: (resposta: RespostaSaude) => boolean;
  onFechar: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  onIrPara: (id: string) => void;
}) {
  const profissional = evento.profissionalId ? (dados.profissionais.find((item) => item.id === evento.profissionalId) ?? null) : null;
  const local = evento.localId ? (dados.locais.find((item) => item.id === evento.localId) ?? null) : null;
  const pedidoPor = evento.pedidoPorId ? (dados.eventos.find((item) => item.id === evento.pedidoPorId) ?? null) : null;
  const derivados = useMemo(
    () => ordenarEventos(dados.eventos.filter((item) => item.pedidoPorId === evento.id)),
    [dados.eventos, evento.id],
  );
  const seletorDeArquivo = useRef<HTMLInputElement>(null);
  const [enviando, definirEnviando] = useState(false);
  const [erroAnexo, definirErroAnexo] = useState<string | null>(null);
  const [removendoAnexo, definirRemovendoAnexo] = useState<string | null>(null);

  async function anexar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    definirEnviando(true);
    definirErroAnexo(null);
    for (const arquivo of Array.from(arquivos)) {
      const formulario = new FormData();
      formulario.set("evento", evento.id);
      formulario.set("arquivo", arquivo);
      try {
        const resposta = await fetch("/saude/anexo", { method: "POST", body: formulario });
        const corpo = (await resposta.json()) as RespostaSaude;
        if (!corpo.ok) {
          definirErroAnexo(`${arquivo.name}: ${corpo.erro}`);
          break;
        }
        aplicar(corpo);
      } catch {
        definirErroAnexo(`${arquivo.name}: não deu para enviar.`);
        break;
      }
    }
    definirEnviando(false);
  }

  return (
    <aside className="flex w-[26rem] shrink-0 flex-col overflow-hidden border-l border-linha bg-superficie">
      <div className="flex shrink-0 items-start gap-2 border-b border-linha px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Selo texto={ROTULO_TIPO[evento.tipo]} cor="var(--realce)" />
            <select
              value={evento.status}
              onChange={async (e) => aplicar(await acaoMudarStatusEvento(evento.id, e.target.value as StatusEventoSaude))}
              aria-label="Status"
              className="h-6 rounded-md border border-linha bg-superficie-alta px-1.5 text-[11px] text-tinta focus:outline-none"
            >
              {statusDisponiveis(evento.tipo).map((status) => (
                <option key={status} value={status}>
                  {ROTULO_STATUS[status]}
                </option>
              ))}
            </select>
          </div>
          <h3 className="mt-1.5 text-[16px] leading-tight font-bold tracking-[-0.02em]">{evento.titulo}</h3>
          <p className="mt-0.5 text-[12.5px] text-tinta-2">
            {formatarDataSaude(evento.data)}
            {evento.hora ? ` às ${evento.hora}` : ""}
          </p>
        </div>
        <BotaoIcone rotulo="Editar" onClick={onEditar}>
          <Pencil size={14} />
        </BotaoIcone>
        <BotaoIcone rotulo="Excluir" onClick={onExcluir}>
          <Trash2 size={14} />
        </BotaoIcone>
        <BotaoIcone rotulo="Fechar" onClick={onFechar}>
          <X size={14} />
        </BotaoIcone>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {profissional || local ? (
          <dl className="space-y-2 text-[12.5px]">
            {profissional ? (
              <div className="flex gap-2">
                <UserRound size={14} className="mt-0.5 shrink-0 text-tinta-3" />
                <div className="min-w-0">
                  <dd className="text-tinta">{profissional.nome}</dd>
                  {profissional.contato ? <dd className="text-tinta-3">{profissional.contato}</dd> : null}
                </div>
              </div>
            ) : null}
            {local ? (
              <div className="flex gap-2">
                <Building2 size={14} className="mt-0.5 shrink-0 text-tinta-3" />
                <div className="min-w-0">
                  <dd className="text-tinta">{local.nome}</dd>
                  {local.endereco ? <dd className="text-tinta-3">{local.endereco}</dd> : null}
                  {local.telefone ? <dd className="text-tinta-3">{local.telefone}</dd> : null}
                </div>
              </div>
            ) : null}
          </dl>
        ) : null}

        {pedidoPor ? (
          <button type="button" onClick={() => onIrPara(pedidoPor.id)} className="flex items-center gap-1.5 text-[12px] text-tinta-2 hover:text-tinta">
            <Link2 size={12} />
            Pedido em: {pedidoPor.titulo} · {formatarDataSaude(pedidoPor.data)}
          </button>
        ) : null}

        {evento.observacoes ? (
          <div className="text-[13px]">
            <VisualizadorMarkdown conteudo={evento.observacoes} />
          </div>
        ) : null}

        {derivados.length ? (
          <section>
            <p className="mb-1 text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Pedidos nesta consulta</p>
            <div className="space-y-0.5">
              {derivados.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onIrPara(item.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12.5px] hover:bg-realce-fraco"
                >
                  <span className="min-w-0 flex-1 truncate">{item.titulo}</span>
                  <span className="text-[11px] text-tinta-3">{formatarDataSaude(item.data)}</span>
                  <Selo texto={ROTULO_STATUS[item.status]} cor={COR_STATUS[item.status]} />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Anexos</p>
            <input
              ref={seletorDeArquivo}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.heic,.txt,.docx,.xlsx"
              className="hidden"
              onChange={(e) => {
                void anexar(e.target.files);
                e.target.value = "";
              }}
            />
            <Botao variante="sutil" className="h-7 px-2 text-[11.5px]" disabled={enviando} onClick={() => seletorDeArquivo.current?.click()}>
              <Upload size={12} />
              {enviando ? "Enviando…" : "Anexar"}
            </Botao>
          </div>
          {evento.anexos.length === 0 ? (
            <p className="text-[12px] text-tinta-3">Laudo, receita, foto do exame — o que sair daqui.</p>
          ) : (
            <div className="space-y-0.5">
              {evento.anexos.map((anexo) => (
                <div key={anexo.id} className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-realce-fraco">
                  <a
                    href={`/saude/anexo/${evento.id}/${anexo.arquivo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-tinta hover:underline"
                  >
                    <Paperclip size={12} className="shrink-0 text-tinta-3" />
                    <span className="min-w-0 flex-1 truncate">{anexo.nome}</span>
                    <span className="shrink-0 text-[11px] text-tinta-3">{formatarTamanho(anexo.tamanho)}</span>
                    <ExternalLink size={11} className="shrink-0 text-tinta-3" />
                  </a>
                  <BotaoIcone
                    rotulo="Remover anexo"
                    onClick={() => definirRemovendoAnexo(anexo.id)}
                    className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 size={12} />
                  </BotaoIcone>
                </div>
              ))}
            </div>
          )}
          <Aviso>{erroAnexo}</Aviso>
        </section>
      </div>

      {removendoAnexo ? (
        <DialogoConfirmar
          aberto
          titulo="Remover este anexo?"
          descricao="O arquivo é apagado do disco. Não dá para desfazer."
          textoBotao="Remover"
          aoFechar={() => definirRemovendoAnexo(null)}
          aoConfirmar={async () => {
            const resposta = await acaoRemoverAnexo(evento.id, removendoAnexo);
            if (!resposta.ok) return resposta.erro;
            aplicar(resposta);
            definirRemovendoAnexo(null);
            return null;
          }}
        />
      ) : null}
    </aside>
  );
}

/* ---------------------------------------------------------------------- */
/* Diálogo de evento                                                        */
/* ---------------------------------------------------------------------- */

function DialogoEvento({
  evento,
  especialidadeInicial,
  dados,
  aoFechar,
  aoSalvar,
}: {
  evento: EventoSaude | null;
  especialidadeInicial: string;
  dados: DadosSaude;
  aoFechar: () => void;
  aoSalvar: (id: string | null, campos: CamposEvento, extras: ExtrasEvento) => Promise<string | null>;
}) {
  const [tipo, definirTipo] = useState<TipoEventoSaude>(evento?.tipo ?? "consulta");
  const [titulo, definirTitulo] = useState(evento?.titulo ?? "");
  const [especialidadeId, definirEspecialidadeId] = useState(evento?.especialidadeId ?? especialidadeInicial);
  const [data, definirData] = useState(evento?.data ?? "");
  const [hora, definirHora] = useState(evento?.hora ?? "");
  const [profissionalId, definirProfissionalId] = useState<string | null>(evento?.profissionalId ?? null);
  const [localId, definirLocalId] = useState<string | null>(evento?.localId ?? null);
  const [status, definirStatus] = useState<StatusEventoSaude>(evento?.status ?? "agendado");
  const [observacoes, definirObservacoes] = useState(evento?.observacoes ?? "");
  const [retornoEm, definirRetornoEm] = useState("");
  const [pedidos, definirPedidos] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const statusMexido = useRef(!!evento);

  // Título vazio ganha o nome do tipo — "Consulta", "Vacina" — pra não obrigar a inventar um.
  const tituloFinal = titulo.trim() || ROTULO_TIPO[tipo];

  // Data preenchida → agendado; sem data → solicitado. Só enquanto a pessoa não escolheu o status à mão.
  function mudarData(valor: string) {
    definirData(valor);
    if (!statusMexido.current) definirStatus(valor ? "agendado" : "solicitado");
  }

  function mudarTipo(novo: TipoEventoSaude) {
    definirTipo(novo);
    if (novo !== "exame" && status === "aguardando-resultado") definirStatus("realizado");
  }

  function mudarProfissional(id: string | null) {
    definirProfissionalId(id);
    const profissional = id ? dados.profissionais.find((item) => item.id === id) : null;
    if (profissional?.localId && !localId) definirLocalId(profissional.localId);
  }

  const profissionaisDaEspecialidade = dados.profissionais.filter(
    (item) => item.especialidadeId === especialidadeId || item.especialidadeId === null || item.id === profissionalId,
  );

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    definirSalvando(true);
    const falha = await aoSalvar(
      evento?.id ?? null,
      {
        tipo,
        especialidadeId,
        titulo: tituloFinal,
        data: data || null,
        hora: hora || null,
        profissionalId,
        localId,
        status,
        observacoes,
      },
      {
        retornoEm: tipo === "consulta" ? retornoEm || null : null,
        pedidos: tipo === "consulta" ? pedidos.split("\n").map((linha) => linha.trim()).filter(Boolean) : [],
      },
    );
    definirSalvando(false);
    if (falha) definirErro(falha);
  }

  return (
    <Dialogo titulo={evento ? "Editar registro" : "Novo registro"} aberto aoFechar={aoFechar} largura="max-w-xl" realcado>
      <form onSubmit={enviar} className="space-y-3">
        <div className="flex gap-1 rounded-lg border border-linha p-0.5">
          {TIPOS_EVENTO.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => mudarTipo(opcao)}
              aria-pressed={tipo === opcao}
              className={clsx(
                "flex-1 rounded-md px-2 py-1.5 text-[12px] whitespace-nowrap transition-colors",
                tipo === opcao ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
              )}
            >
              {ROTULO_TIPO[opcao]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <Rotulo>Título</Rotulo>
            <Campo
              autoFocus
              value={titulo}
              onChange={(e) => definirTitulo(e.target.value)}
              placeholder={tipo === "exame" ? "Hemograma, raio-X do tórax…" : tipo === "vacina" ? "Gripe, tétano…" : ROTULO_TIPO[tipo]}
            />
          </div>
          <div>
            <Rotulo>Especialidade</Rotulo>
            <select value={especialidadeId} onChange={(e) => definirEspecialidadeId(e.target.value)} className={CLASSE_SELECT}>
              {dados.especialidades.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.icone} {item.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Rotulo>Data</Rotulo>
            <Campo type="date" value={data} onChange={(e) => mudarData(e.target.value)} />
          </div>
          <div>
            <Rotulo>Hora</Rotulo>
            <Campo type="time" value={hora} onChange={(e) => definirHora(e.target.value)} disabled={!data} />
          </div>
          <div>
            <Rotulo>Status</Rotulo>
            <select
              value={status}
              onChange={(e) => {
                statusMexido.current = true;
                definirStatus(e.target.value as StatusEventoSaude);
              }}
              className={CLASSE_SELECT}
            >
              {statusDisponiveis(tipo).map((opcao) => (
                <option key={opcao} value={opcao}>
                  {ROTULO_STATUS[opcao]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Rotulo>Profissional</Rotulo>
            <select value={profissionalId ?? ""} onChange={(e) => mudarProfissional(e.target.value || null)} className={CLASSE_SELECT}>
              <option value="">—</option>
              {profissionaisDaEspecialidade.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Rotulo>Local</Rotulo>
            <select value={localId ?? ""} onChange={(e) => definirLocalId(e.target.value || null)} className={CLASSE_SELECT}>
              <option value="">—</option>
              {dados.locais.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Rotulo>Observações (markdown)</Rotulo>
          <textarea
            value={observacoes}
            onChange={(e) => definirObservacoes(e.target.value)}
            rows={4}
            className={CLASSE_TEXTAREA}
            placeholder="O que o médico disse, o que perguntar da próxima vez, resultado…"
          />
        </div>

        {tipo === "consulta" ? (
          <div className="grid grid-cols-[auto_1fr] gap-3 rounded-lg border border-dashed border-linha p-3">
            <div>
              <Rotulo>Retorno em</Rotulo>
              <Campo type="date" value={retornoEm} onChange={(e) => definirRetornoEm(e.target.value)} className="w-40" />
              <p className="mt-1 text-[11px] text-tinta-3">Cria a consulta de retorno já agendada.</p>
            </div>
            <div>
              <Rotulo>Pedidos (um por linha)</Rotulo>
              <textarea
                value={pedidos}
                onChange={(e) => definirPedidos(e.target.value)}
                rows={3}
                className={CLASSE_TEXTAREA}
                placeholder={"Hemograma\nRaio-X do tórax"}
              />
              <p className="mt-1 text-[11px] text-tinta-3">Cada linha vira um exame “solicitado”, ligado a esta consulta.</p>
            </div>
          </div>
        ) : null}

        <Aviso>{erro}</Aviso>
        <div className="flex justify-end gap-2 pt-1">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" disabled={salvando || !especialidadeId}>
            {evento ? "Salvar" : "Registrar"}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/* ---------------------------------------------------------------------- */
/* Próximos e linha do tempo                                                */
/* ---------------------------------------------------------------------- */

function useMapas(dados: DadosSaude) {
  return useMemo(
    () => ({
      profissionais: new Map(dados.profissionais.map((item) => [item.id, item.nome])),
      locais: new Map(dados.locais.map((item) => [item.id, item.nome])),
      especialidades: new Map(dados.especialidades.map((item) => [item.id, item])),
    }),
    [dados],
  );
}

function SecaoDeLista({ titulo, contagem, children }: { titulo: string; contagem: number; children: React.ReactNode }) {
  if (contagem === 0) return null;
  return (
    <section>
      <h3 className="mb-1 px-2.5 text-[11px] font-bold tracking-[0.08em] text-tinta-3 uppercase">
        {titulo} <span className="font-medium tabular-nums">{contagem}</span>
      </h3>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

function VisaoProximos({
  dados,
  alertas,
  agendados,
  aguardando,
  solicitados,
  hoje,
  eventoAtivoId,
  onSelecionar,
  onNovo,
  onConfigurarAlerta,
}: {
  dados: DadosSaude;
  alertas: AlertaSaude[];
  agendados: EventoSaude[];
  aguardando: EventoSaude[];
  solicitados: EventoSaude[];
  hoje: string;
  eventoAtivoId: string | null;
  onSelecionar: (id: string) => void;
  onNovo: (especialidadeId?: string) => void;
  onConfigurarAlerta: (especialidade: EspecialidadeSaude) => void;
}) {
  const mapas = useMapas(dados);
  const vazio = alertas.length === 0 && agendados.length === 0 && aguardando.length === 0 && solicitados.length === 0;
  const semAlertaConfigurado = dados.especialidades.length > 0 && dados.especialidades.every((item) => item.mesesAlerta === null);

  const linha = (evento: EventoSaude) => (
    <LinhaEvento
      key={evento.id}
      evento={evento}
      profissional={evento.profissionalId ? (mapas.profissionais.get(evento.profissionalId) ?? null) : null}
      local={evento.localId ? (mapas.locais.get(evento.localId) ?? null) : null}
      especialidade={mapas.especialidades.get(evento.especialidadeId) ?? null}
      ativa={evento.id === eventoAtivoId}
      onSelecionar={onSelecionar}
    />
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-linha px-5 py-2.5">
        <CalendarClock size={15} className="text-tinta-3" />
        <h2 className="text-[14px] font-bold tracking-[-0.02em]">Próximos</h2>
        <Botao variante="primario" onClick={() => onNovo()} className="ml-auto" disabled={dados.especialidades.length === 0}>
          <Plus size={13} />
          Novo registro
        </Botao>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {vazio ? (
          <Vazio
            icone={<CalendarClock size={22} />}
            titulo="Nada esperando"
            descricao={
              semAlertaConfigurado
                ? "Nenhum agendamento, nenhum pedido em aberto. Dica: nas opções de uma especialidade, defina um alerta — “6 meses sem consulta” — e ela aparece aqui quando passar."
                : "Nenhum agendamento, nenhum pedido em aberto, nenhuma especialidade atrasada."
            }
          />
        ) : null}

        {alertas.length ? (
          <section>
            <h3 className="mb-1 px-2.5 text-[11px] font-bold tracking-[0.08em] text-[#F5822C] uppercase">
              Está na hora <span className="font-medium tabular-nums">{alertas.length}</span>
            </h3>
            <div className="space-y-0.5">
              {alertas.map((alerta) => (
                <div
                  key={alerta.especialidade.id}
                  className="flex items-center gap-3 rounded-lg border border-[color-mix(in_srgb,#F5822C_35%,transparent)] bg-[color-mix(in_srgb,#F5822C_7%,transparent)] px-3 py-2"
                >
                  <span aria-hidden className="text-[16px]">
                    {alerta.especialidade.icone}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-tinta">{alerta.especialidade.nome}</span>
                    <span className="block text-[11.5px] text-tinta-3">
                      {alerta.ultimaConsulta
                        ? `Última consulta em ${formatarDataSaude(alerta.ultimaConsulta)} — há ${alerta.mesesDesde} ${alerta.mesesDesde === 1 ? "mês" : "meses"}; o alerta é de ${alerta.especialidade.mesesAlerta}.`
                        : `Nenhuma consulta registrada; o alerta é de ${alerta.especialidade.mesesAlerta} meses.`}
                    </span>
                  </span>
                  <Botao variante="sutil" className="h-7 px-2 text-[11.5px]" onClick={() => onConfigurarAlerta(alerta.especialidade)}>
                    <BellRing size={12} />
                    Ajustar
                  </Botao>
                  <Botao variante="primario" className="h-7 px-2 text-[11.5px]" onClick={() => onNovo(alerta.especialidade.id)}>
                    <Plus size={12} />
                    Agendar
                  </Botao>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <SecaoDeLista titulo="Agendados" contagem={agendados.length}>
          {agendados.map((evento) => (
            <div key={evento.id} className={clsx(evento.data! < hoje && "opacity-80")}>
              {linha(evento)}
            </div>
          ))}
        </SecaoDeLista>
        <SecaoDeLista titulo="Aguardando resultado" contagem={aguardando.length}>
          {aguardando.map(linha)}
        </SecaoDeLista>
        <SecaoDeLista titulo="Solicitados, sem data" contagem={solicitados.length}>
          {solicitados.map(linha)}
        </SecaoDeLista>
      </div>
    </div>
  );
}

function VisaoLinhaDoTempo({
  dados,
  eventoAtivoId,
  onSelecionar,
  onNovo,
}: {
  dados: DadosSaude;
  eventoAtivoId: string | null;
  onSelecionar: (id: string) => void;
  onNovo: () => void;
}) {
  const mapas = useMapas(dados);
  // Por mês, do mais recente pro mais antigo; o que não tem data vai num grupo próprio no topo.
  const grupos = useMemo(() => {
    const ordenados = ordenarEventos(dados.eventos);
    const lista: { chave: string; rotulo: string; eventos: EventoSaude[] }[] = [];
    for (const evento of ordenados) {
      const chave = evento.data ? evento.data.slice(0, 7) : "sem-data";
      const ultimo = lista.at(-1);
      if (ultimo && ultimo.chave === chave) ultimo.eventos.push(evento);
      else lista.push({ chave, rotulo: evento.data ? rotuloDoMes(evento.data) : "Sem data", eventos: [evento] });
    }
    return lista;
  }, [dados.eventos]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-linha px-5 py-2.5">
        <History size={15} className="text-tinta-3" />
        <h2 className="text-[14px] font-bold tracking-[-0.02em]">Linha do tempo</h2>
        <span className="text-[11.5px] text-tinta-3">{dados.eventos.length ? `${dados.eventos.length} registros` : ""}</span>
        <Botao variante="primario" onClick={onNovo} className="ml-auto" disabled={dados.especialidades.length === 0}>
          <Plus size={13} />
          Novo registro
        </Botao>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {grupos.length === 0 ? (
          <Vazio icone={<History size={22} />} titulo="Nada registrado ainda" descricao="Tudo o que você registrar em qualquer especialidade aparece aqui, por mês." />
        ) : null}
        {grupos.map((grupo) => (
          <SecaoDeLista key={grupo.chave} titulo={grupo.rotulo} contagem={grupo.eventos.length}>
            {grupo.eventos.map((evento) => (
              <LinhaEvento
                key={evento.id}
                evento={evento}
                profissional={evento.profissionalId ? (mapas.profissionais.get(evento.profissionalId) ?? null) : null}
                local={evento.localId ? (mapas.locais.get(evento.localId) ?? null) : null}
                especialidade={mapas.especialidades.get(evento.especialidadeId) ?? null}
                ativa={evento.id === eventoAtivoId}
                onSelecionar={onSelecionar}
              />
            ))}
          </SecaoDeLista>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Alerta por especialidade                                                 */
/* ---------------------------------------------------------------------- */

const OPCOES_ALERTA = [3, 6, 12, 24];

function DialogoAlerta({
  especialidade,
  aoFechar,
  aoSalvar,
}: {
  especialidade: EspecialidadeSaude;
  aoFechar: () => void;
  aoSalvar: (meses: number | null) => Promise<string | null>;
}) {
  const [texto, definirTexto] = useState(especialidade.mesesAlerta === null ? "" : String(especialidade.mesesAlerta));
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function salvar(valor: number | null) {
    definirSalvando(true);
    const falha = await aoSalvar(valor);
    definirSalvando(false);
    if (falha) definirErro(falha);
  }

  return (
    <Dialogo
      titulo={`Alerta de ${especialidade.nome}`}
      descricao="Quantos meses sem consulta realizada até aparecer em “está na hora”. Uma consulta agendada pra frente silencia o alerta."
      aberto
      aoFechar={aoFechar}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const numero = Number(texto);
          if (!texto.trim() || !Number.isFinite(numero) || numero < 1) {
            definirErro("Informe um número de meses (1 ou mais), ou desligue o alerta.");
            return;
          }
          salvar(Math.round(numero));
        }}
        className="space-y-3"
      >
        <div className="flex gap-1">
          {OPCOES_ALERTA.map((meses) => (
            <button
              key={meses}
              type="button"
              onClick={() => definirTexto(String(meses))}
              aria-pressed={texto === String(meses)}
              className={clsx(
                "flex-1 rounded-md border border-linha px-2 py-1.5 text-[12px] transition-colors",
                texto === String(meses) ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
              )}
            >
              {meses} meses
            </button>
          ))}
        </div>
        <div>
          <Rotulo>Ou outro valor (meses)</Rotulo>
          <Campo type="number" min={1} max={120} value={texto} onChange={(e) => definirTexto(e.target.value)} placeholder="Ex.: 18" />
        </div>
        <Aviso>{erro}</Aviso>
        <div className="flex justify-between gap-2 pt-1">
          <Botao variante="sutil" onClick={() => salvar(null)} disabled={salvando || especialidade.mesesAlerta === null}>
            Desligar alerta
          </Botao>
          <div className="flex gap-2">
            <Botao onClick={aoFechar}>Cancelar</Botao>
            <Botao type="submit" variante="primario" disabled={salvando}>
              Salvar
            </Botao>
          </div>
        </div>
      </form>
    </Dialogo>
  );
}

/* ---------------------------------------------------------------------- */
/* Lixeira                                                                  */
/* ---------------------------------------------------------------------- */

function LixeiraSaude({ aplicar }: { aplicar: (resposta: RespostaSaude) => boolean }) {
  const [itens, definirItens] = useState<ItemLixeiraSaude[] | null>(null);
  const [processando, definirProcessando] = useState<string | null>(null);
  const [confirmandoEsvaziar, definirConfirmandoEsvaziar] = useState(false);
  const [apagando, definirApagando] = useState<ItemLixeiraSaude | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    acaoListarLixeiraSaude().then((lista) => {
      if (!cancelado) definirItens(lista);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  async function restaurar(item: ItemLixeiraSaude) {
    definirProcessando(item.id);
    definirErro(null);
    const resposta = await acaoRestaurarDaLixeiraSaude(item.id);
    definirProcessando(null);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    aplicar(resposta);
    definirItens((atuais) => atuais?.filter((outro) => outro.id !== item.id) ?? null);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-linha px-5 py-2.5">
        <Trash2 size={15} className="text-tinta-3" />
        <h2 className="text-[14px] font-bold tracking-[-0.02em]">Lixeira</h2>
        <span className="text-[11.5px] text-tinta-3">{itens?.length ? `${itens.length} ${itens.length === 1 ? "registro" : "registros"}` : ""}</span>
        {itens?.length ? (
          <Botao variante="perigo" onClick={() => definirConfirmandoEsvaziar(true)} className="ml-auto">
            Esvaziar lixeira
          </Botao>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {itens === null ? (
          <p className="px-2 py-3 text-[12px] text-tinta-3">Carregando…</p>
        ) : itens.length === 0 ? (
          <Vazio icone={<Trash2 size={22} />} titulo="Lixeira vazia" descricao="Registros excluídos ficam aqui, com os anexos, até você restaurar ou apagar de vez." />
        ) : (
          <div className="mx-auto max-w-3xl space-y-0.5">
            {itens.map((item) => (
              <div key={item.id} className="group flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-realce-fraco">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-tinta">{item.titulo}</span>
                    <span className="shrink-0 text-[10.5px] text-tinta-3">{ROTULO_TIPO[item.tipo]}</span>
                  </span>
                  <span className="block truncate text-[11.5px] text-tinta-3">
                    {[item.especialidadeNome, formatarDataSaude(item.data), item.anexos ? `${item.anexos} ${item.anexos === 1 ? "anexo" : "anexos"}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                    {" · excluído em "}
                    {new Date(item.excluidoEm).toLocaleDateString("pt-BR")}
                  </span>
                </span>
                <Botao variante="sutil" className="h-7 px-2 text-[11.5px]" disabled={processando === item.id} onClick={() => restaurar(item)}>
                  <RotateCcw size={12} />
                  Restaurar
                </Botao>
                <BotaoIcone rotulo="Apagar de vez" onClick={() => definirApagando(item)} className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
                  <X size={13} />
                </BotaoIcone>
              </div>
            ))}
          </div>
        )}
        <Aviso>{erro}</Aviso>
      </div>

      {apagando ? (
        <DialogoConfirmar
          aberto
          titulo={`Apagar "${apagando.titulo}" de vez?`}
          descricao={apagando.anexos ? "Os anexos são apagados do disco junto. Não dá para desfazer." : "Não dá para desfazer."}
          textoBotao="Apagar de vez"
          aoFechar={() => definirApagando(null)}
          aoConfirmar={async () => {
            await acaoApagarDeVezDaLixeiraSaude(apagando.id);
            definirItens((atuais) => atuais?.filter((outro) => outro.id !== apagando.id) ?? null);
            definirApagando(null);
            return null;
          }}
        />
      ) : null}

      {confirmandoEsvaziar ? (
        <DialogoConfirmar
          aberto
          titulo="Esvaziar a lixeira?"
          descricao="Todos os registros e anexos aqui são apagados do disco. Não dá para desfazer."
          textoBotao="Esvaziar"
          aoFechar={() => definirConfirmandoEsvaziar(false)}
          aoConfirmar={async () => {
            await acaoEsvaziarLixeiraSaude();
            definirItens([]);
            definirConfirmandoEsvaziar(false);
            return null;
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Cadastros: locais e profissionais                                        */
/* ---------------------------------------------------------------------- */

function CabecalhoCadastro({ icone, titulo, contagem, onNovo, textoNovo }: { icone: React.ReactNode; titulo: string; contagem: number; onNovo: () => void; textoNovo: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-linha px-5 py-2.5">
      <span className="text-tinta-3">{icone}</span>
      <h2 className="text-[14px] font-bold tracking-[-0.02em]">{titulo}</h2>
      <span className="text-[11.5px] text-tinta-3">{contagem || ""}</span>
      <Botao variante="primario" onClick={onNovo} className="ml-auto">
        <Plus size={13} />
        {textoNovo}
      </Botao>
    </div>
  );
}

function CadastroLocais({ dados, aplicar }: { dados: DadosSaude; aplicar: (resposta: RespostaSaude) => boolean }) {
  const [emEdicao, definirEmEdicao] = useState<LocalSaude | "novo" | null>(null);
  const [excluindo, definirExcluindo] = useState<LocalSaude | null>(null);
  const usoPorLocal = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const evento of dados.eventos) if (evento.localId) mapa.set(evento.localId, (mapa.get(evento.localId) ?? 0) + 1);
    return mapa;
  }, [dados.eventos]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <CabecalhoCadastro icone={<Building2 size={15} />} titulo="Locais" contagem={dados.locais.length} onNovo={() => definirEmEdicao("novo")} textoNovo="Novo local" />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {dados.locais.length === 0 ? (
          <Vazio icone={<Building2 size={22} />} titulo="Nenhum local ainda" descricao="Clínicas, hospitais, laboratórios — cadastre uma vez e escolha nos registros.">
            <Botao variante="primario" onClick={() => definirEmEdicao("novo")}>
              <Plus size={13} />
              Novo local
            </Botao>
          </Vazio>
        ) : (
          <div className="mx-auto max-w-3xl space-y-0.5">
            {dados.locais.map((local) => (
              <div key={local.id} className="group flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-realce-fraco">
                <button type="button" onClick={() => definirEmEdicao(local)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[13px] font-medium text-tinta">{local.nome}</span>
                  <span className="block truncate text-[11.5px] text-tinta-3">{[local.endereco, local.telefone].filter(Boolean).join(" · ")}</span>
                </button>
                <span className="text-[11px] text-tinta-3 tabular-nums">{usoPorLocal.get(local.id) ? `${usoPorLocal.get(local.id)} registros` : ""}</span>
                <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <BotaoIcone rotulo="Editar" onClick={() => definirEmEdicao(local)} className="size-7">
                    <Pencil size={13} />
                  </BotaoIcone>
                  <BotaoIcone rotulo="Excluir" onClick={() => definirExcluindo(local)} className="size-7">
                    <Trash2 size={13} />
                  </BotaoIcone>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {emEdicao ? (
        <DialogoLocal
          local={emEdicao === "novo" ? null : emEdicao}
          aoFechar={() => definirEmEdicao(null)}
          aoSalvar={async (id, campos) => {
            const resposta = id ? await acaoAtualizarLocal(id, campos) : await acaoCriarLocal(campos);
            if (!resposta.ok) return resposta.erro;
            aplicar(resposta);
            definirEmEdicao(null);
            return null;
          }}
        />
      ) : null}

      {excluindo ? (
        <DialogoConfirmar
          aberto
          titulo={`Excluir ${excluindo.nome}?`}
          descricao="Os registros que apontam para este local ficam sem local — nenhum é apagado."
          textoBotao="Excluir"
          aoFechar={() => definirExcluindo(null)}
          aoConfirmar={async () => {
            const resposta = await acaoExcluirLocal(excluindo.id);
            if (!resposta.ok) return resposta.erro;
            aplicar(resposta);
            definirExcluindo(null);
            return null;
          }}
        />
      ) : null}
    </div>
  );
}

function DialogoLocal({
  local,
  aoFechar,
  aoSalvar,
}: {
  local: LocalSaude | null;
  aoFechar: () => void;
  aoSalvar: (id: string | null, campos: CamposLocal) => Promise<string | null>;
}) {
  const [campos, definirCampos] = useState<CamposLocal>({
    nome: local?.nome ?? "",
    endereco: local?.endereco ?? "",
    telefone: local?.telefone ?? "",
    observacoes: local?.observacoes ?? "",
  });
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    definirSalvando(true);
    const falha = await aoSalvar(local?.id ?? null, campos);
    definirSalvando(false);
    if (falha) definirErro(falha);
  }

  return (
    <Dialogo titulo={local ? "Editar local" : "Novo local"} aberto aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-3">
        <div>
          <Rotulo>Nome</Rotulo>
          <Campo autoFocus value={campos.nome} onChange={(e) => definirCampos({ ...campos, nome: e.target.value })} placeholder="Clínica, hospital, laboratório" />
        </div>
        <div>
          <Rotulo>Endereço</Rotulo>
          <Campo value={campos.endereco} onChange={(e) => definirCampos({ ...campos, endereco: e.target.value })} />
        </div>
        <div>
          <Rotulo>Telefone</Rotulo>
          <Campo value={campos.telefone} onChange={(e) => definirCampos({ ...campos, telefone: e.target.value })} />
        </div>
        <div>
          <Rotulo>Observações</Rotulo>
          <textarea
            value={campos.observacoes}
            onChange={(e) => definirCampos({ ...campos, observacoes: e.target.value })}
            rows={2}
            className={CLASSE_TEXTAREA}
            placeholder="Estacionamento pago, levar pedido impresso…"
          />
        </div>
        <Aviso>{erro}</Aviso>
        <div className="flex justify-end gap-2 pt-1">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" disabled={salvando || !campos.nome.trim()}>
            {local ? "Salvar" : "Criar"}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function CadastroProfissionais({ dados, aplicar }: { dados: DadosSaude; aplicar: (resposta: RespostaSaude) => boolean }) {
  const [emEdicao, definirEmEdicao] = useState<ProfissionalSaude | "novo" | null>(null);
  const [excluindo, definirExcluindo] = useState<ProfissionalSaude | null>(null);
  const especialidades = useMemo(() => new Map(dados.especialidades.map((item) => [item.id, item])), [dados.especialidades]);
  const locais = useMemo(() => new Map(dados.locais.map((item) => [item.id, item.nome])), [dados.locais]);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <CabecalhoCadastro icone={<UserRound size={15} />} titulo="Profissionais" contagem={dados.profissionais.length} onNovo={() => definirEmEdicao("novo")} textoNovo="Novo profissional" />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {dados.profissionais.length === 0 ? (
          <Vazio icone={<UserRound size={22} />} titulo="Nenhum profissional ainda" descricao="Nome, especialidade, onde atende e o contato — o WhatsApp da secretária que se perde.">
            <Botao variante="primario" onClick={() => definirEmEdicao("novo")}>
              <Plus size={13} />
              Novo profissional
            </Botao>
          </Vazio>
        ) : (
          <div className="mx-auto max-w-3xl space-y-0.5">
            {dados.profissionais.map((profissional) => {
              const especialidade = profissional.especialidadeId ? especialidades.get(profissional.especialidadeId) : null;
              return (
                <div key={profissional.id} className="group flex items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-realce-fraco">
                  <button type="button" onClick={() => definirEmEdicao(profissional)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[13px] font-medium text-tinta">{profissional.nome}</span>
                    <span className="block truncate text-[11.5px] text-tinta-3">
                      {[
                        especialidade ? `${especialidade.icone} ${especialidade.nome}` : null,
                        profissional.localId ? locais.get(profissional.localId) : null,
                        profissional.contato,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <BotaoIcone rotulo="Editar" onClick={() => definirEmEdicao(profissional)} className="size-7">
                      <Pencil size={13} />
                    </BotaoIcone>
                    <BotaoIcone rotulo="Excluir" onClick={() => definirExcluindo(profissional)} className="size-7">
                      <Trash2 size={13} />
                    </BotaoIcone>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {emEdicao ? (
        <DialogoProfissional
          profissional={emEdicao === "novo" ? null : emEdicao}
          dados={dados}
          aoFechar={() => definirEmEdicao(null)}
          aoSalvar={async (id, campos) => {
            const resposta = id ? await acaoAtualizarProfissional(id, campos) : await acaoCriarProfissional(campos);
            if (!resposta.ok) return resposta.erro;
            aplicar(resposta);
            definirEmEdicao(null);
            return null;
          }}
        />
      ) : null}

      {excluindo ? (
        <DialogoConfirmar
          aberto
          titulo={`Excluir ${excluindo.nome}?`}
          descricao="Os registros que apontam para este profissional ficam sem profissional — nenhum é apagado."
          textoBotao="Excluir"
          aoFechar={() => definirExcluindo(null)}
          aoConfirmar={async () => {
            const resposta = await acaoExcluirProfissional(excluindo.id);
            if (!resposta.ok) return resposta.erro;
            aplicar(resposta);
            definirExcluindo(null);
            return null;
          }}
        />
      ) : null}
    </div>
  );
}

function DialogoProfissional({
  profissional,
  dados,
  aoFechar,
  aoSalvar,
}: {
  profissional: ProfissionalSaude | null;
  dados: DadosSaude;
  aoFechar: () => void;
  aoSalvar: (id: string | null, campos: CamposProfissional) => Promise<string | null>;
}) {
  const [campos, definirCampos] = useState<CamposProfissional>({
    nome: profissional?.nome ?? "",
    especialidadeId: profissional?.especialidadeId ?? null,
    localId: profissional?.localId ?? null,
    contato: profissional?.contato ?? "",
  });
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    definirSalvando(true);
    const falha = await aoSalvar(profissional?.id ?? null, campos);
    definirSalvando(false);
    if (falha) definirErro(falha);
  }

  return (
    <Dialogo titulo={profissional ? "Editar profissional" : "Novo profissional"} aberto aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-3">
        <div>
          <Rotulo>Nome</Rotulo>
          <Campo autoFocus value={campos.nome} onChange={(e) => definirCampos({ ...campos, nome: e.target.value })} placeholder="Dra. Fulana" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Rotulo>Especialidade</Rotulo>
            <select value={campos.especialidadeId ?? ""} onChange={(e) => definirCampos({ ...campos, especialidadeId: e.target.value || null })} className={CLASSE_SELECT}>
              <option value="">—</option>
              {dados.especialidades.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.icone} {item.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Rotulo>Atende em</Rotulo>
            <select value={campos.localId ?? ""} onChange={(e) => definirCampos({ ...campos, localId: e.target.value || null })} className={CLASSE_SELECT}>
              <option value="">—</option>
              {dados.locais.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Rotulo>Contato</Rotulo>
          <Campo value={campos.contato} onChange={(e) => definirCampos({ ...campos, contato: e.target.value })} placeholder="Telefone, WhatsApp da secretária…" />
        </div>
        <Aviso>{erro}</Aviso>
        <div className="flex justify-end gap-2 pt-1">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" disabled={salvando || !campos.nome.trim()}>
            {profissional ? "Salvar" : "Criar"}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}
