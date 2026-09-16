"use client";

import clsx from "clsx";
import {
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  Folder,
  FolderPlus,
  KeyRound,
  KeySquare,
  Layers,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  acaoAtualizarEntrada,
  acaoBaixarCofre,
  acaoCriarEntrada,
  acaoCriarGrupo,
  acaoExcluirCofre,
  acaoExcluirEntrada,
  acaoExcluirGrupo,
  acaoExportarCsv,
  acaoFavoritarEntrada,
  acaoMoverEntrada,
  acaoMoverGrupo,
  acaoRegistrarAcesso,
  acaoRenomearGrupo,
  acaoStatusCofre,
  acaoTrancar,
} from "@/app/acoes-senhas";
import {
  iniciarArrastoDeEntradaSenha,
  iniciarArrastoDeGrupoSenha,
  lerIdDeEntradaSenha,
  lerIdDeGrupoSenha,
  trazEntradaSenha,
  trazGrupoSenha,
} from "@/lib/arrastar";
import { useAtalho } from "@/lib/atalhos";
import { CORES_CADERNO } from "@/lib/cores";
import { formatarDataCurta, formatarDataHora } from "@/lib/rotas";
import type { EntradaSenha, GrupoSenhas } from "@/lib/tipos";

import { BotaoComoFunciona } from "./explicador-criptografia";
import {
  DialogoExcluirCofre,
  DialogoExcluirEntrada,
  DialogoExcluirGrupo,
  DialogoNovoGrupo,
  DialogoTrocarSenha,
  ESPERA_LIMPAR_AREA_DE_TRANSFERENCIA,
  baixarArquivo,
  base64ParaBytes,
  copiarComLimpeza,
  encontrarGrupo,
} from "./senhas-comum";
import { TituloEditavel } from "./titulo-editavel";
import { Botao, BotaoIcone, Campo, Dialogo, ItemMenu, Menu, Rotulo, SeparadorMenu, Vazio } from "./ui";

/** De quanto em quanto tempo confere se o cofre ainda está destrancado (o timeout é controlado pelo servidor). */
const INTERVALO_VERIFICAR_TRANCA = 30_000;

/** Quantas entradas "Recentes" mostra. */
const LIMITE_RECENTES = 30;

/**
 * O que está selecionado na coluna da esquerda: um dos três nós virtuais
 * (que juntam entradas de todos os grupos) ou o id de um grupo do cofre.
 * Os ids do kdbx são base64 de 22 caracteres — não colidem com as palavras.
 */
type Selecao = "todas" | "favoritas" | "recentes" | string;

const NOS_VIRTUAIS: { id: Selecao; rotulo: string; icone: React.ReactNode }[] = [
  { id: "todas", rotulo: "Todas", icone: <Layers size={13} /> },
  { id: "favoritas", rotulo: "Favoritas", icone: <Star size={13} /> },
  { id: "recentes", rotulo: "Recentes", icone: <Clock size={13} /> },
];

function ehVirtual(selecao: Selecao): selecao is "todas" | "favoritas" | "recentes" {
  return selecao === "todas" || selecao === "favoritas" || selecao === "recentes";
}

/** Todas as entradas do cofre, num vetor só — a base das listas virtuais e da busca. */
function achatar(grupo: GrupoSenhas, saida: EntradaSenha[] = []): EntradaSenha[] {
  saida.push(...grupo.entradas);
  for (const sub of grupo.grupos) achatar(sub, saida);
  return saida;
}

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const ordenarPorTitulo = (a: EntradaSenha, b: EntradaSenha) => a.titulo.localeCompare(b.titulo, "pt-BR");

/**
 * Busca em todos os grupos: título, usuário, URL e notas. Quem casa no
 * título vem primeiro; dentro de cada faixa, ordem alfabética.
 */
function buscar(entradas: EntradaSenha[], termo: string): EntradaSenha[] {
  const procurado = normalizar(termo.trim());
  if (!procurado) return [];
  const noTitulo: EntradaSenha[] = [];
  const noResto: EntradaSenha[] = [];
  for (const entrada of entradas) {
    if (normalizar(entrada.titulo).includes(procurado)) noTitulo.push(entrada);
    else if (
      normalizar(entrada.usuario).includes(procurado) ||
      normalizar(entrada.url).includes(procurado) ||
      normalizar(entrada.notas).includes(procurado)
    ) {
      noResto.push(entrada);
    }
  }
  return [...noTitulo.sort(ordenarPorTitulo), ...noResto.sort(ordenarPorTitulo)];
}

/** Cor estável para a inicial de uma entrada, a partir do título. */
function corDaInicial(titulo: string): string {
  let soma = 0;
  for (const caractere of titulo) soma = (soma * 31 + caractere.codePointAt(0)!) >>> 0;
  return CORES_CADERNO[soma % CORES_CADERNO.length];
}

/** "há 3 dias", "há 2 h", "agora" — para o "atualizada há…" do painel. */
function tempoRelativo(iso: string): string {
  const diferenca = Date.now() - new Date(iso).getTime();
  const minutos = Math.round(diferenca / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.round(meses / 12);
  return `há ${anos} ${anos === 1 ? "ano" : "anos"}`;
}

export type CamposEntrada = { titulo: string; usuario: string; senha: string; url: string; notas: string };

export function CofreAberto({
  arvoreInicial,
  aoTrancar,
  aoExcluirCofre,
}: {
  arvoreInicial: GrupoSenhas;
  aoTrancar: () => void;
  aoExcluirCofre: () => void;
}) {
  const [arvore, definirArvore] = useState(arvoreInicial);
  const [selecao, definirSelecao] = useState<Selecao>(arvoreInicial.grupos[0]?.id ?? "todas");
  const [busca, definirBusca] = useState("");
  const [entradaAtivaId, definirEntradaAtivaId] = useState<string | null>(null);
  const [editando, definirEditando] = useState(false);
  const [criando, definirCriando] = useState(false);
  const [acaoGrupo, definirAcaoGrupo] = useState<{ tipo: "novo-subgrupo" | "excluir"; grupo: GrupoSenhas } | null>(
    null,
  );
  const [trocandoSenha, definirTrocandoSenha] = useState(false);
  const [excluindoCofre, definirExcluindoCofre] = useState(false);
  const [excluindoEntrada, definirExcluindoEntrada] = useState(false);
  const campoBusca = useRef<HTMLInputElement>(null);

  // O timeout de inatividade é controlado pelo servidor — aqui só se confere
  // de tempos em tempos se ele já trancou sozinho, para voltar pra tela de
  // senha mestra sem precisar de uma ação manual para descobrir isso.
  useEffect(() => {
    const intervalo = setInterval(async () => {
      const status = await acaoStatusCofre();
      if (!status.destrancado) aoTrancar();
    }, INTERVALO_VERIFICAR_TRANCA);
    return () => clearInterval(intervalo);
  }, [aoTrancar]);

  const todas = useMemo(() => achatar(arvore), [arvore]);
  const grupoAtivo = ehVirtual(selecao) ? null : (encontrarGrupo(arvore, selecao) ?? null);
  const buscando = busca.trim().length > 0;

  // A lista do meio: resultado da busca (em todo o cofre), um nó virtual ou
  // as entradas diretas do grupo escolhido.
  const lista = useMemo((): EntradaSenha[] => {
    if (buscando) return buscar(todas, busca);
    if (selecao === "todas") return [...todas].sort(ordenarPorTitulo);
    if (selecao === "favoritas") return todas.filter((entrada) => entrada.favorita).sort(ordenarPorTitulo);
    if (selecao === "recentes") {
      return todas
        .filter((entrada) => entrada.acessadoEm)
        .sort((a, b) => b.acessadoEm!.localeCompare(a.acessadoEm!))
        .slice(0, LIMITE_RECENTES);
    }
    return grupoAtivo?.entradas ?? [];
  }, [buscando, busca, selecao, todas, grupoAtivo]);

  const tituloDaLista = buscando
    ? `Resultados para “${busca.trim()}”`
    : (NOS_VIRTUAIS.find((no) => no.id === selecao)?.rotulo ?? grupoAtivo?.nome ?? "Cofre");
  // Nome do grupo em cada linha só quando a lista mistura grupos.
  const mostrarGrupoNasLinhas = buscando || ehVirtual(selecao);

  const entradaAtiva = entradaAtivaId ? (todas.find((entrada) => entrada.id === entradaAtivaId) ?? null) : null;
  // Entrada sumiu (excluída, cofre recarregado): painel volta ao vazio.
  useEffect(() => {
    if (entradaAtivaId && !entradaAtiva) {
      definirEntradaAtivaId(null);
      definirEditando(false);
    }
  }, [entradaAtivaId, entradaAtiva]);

  const aplicarResposta = useCallback(
    <T extends { ok: true; arvore: GrupoSenhas } | { ok: false; erro: string }>(resposta: T): boolean => {
      if (resposta.ok) {
        definirArvore(resposta.arvore);
        return true;
      }
      alert(resposta.erro);
      return false;
    },
    [],
  );

  // Estáveis entre renders para o `memo` de NoGrupo / LinhaEntrada fazer efeito
  // — sem isso, navegar entre grupos re-renderizava a árvore inteira.
  const abrirNovoSubgrupo = useCallback(
    (grupo: GrupoSenhas) => definirAcaoGrupo({ tipo: "novo-subgrupo", grupo }),
    [],
  );
  const abrirExcluirGrupo = useCallback(
    (grupo: GrupoSenhas) => definirAcaoGrupo({ tipo: "excluir", grupo }),
    [],
  );
  const moverGrupo = useCallback(
    async (id: string, idNovoPai: string) => void aplicarResposta(await acaoMoverGrupo(id, idNovoPai)),
    [aplicarResposta],
  );
  const moverEntrada = useCallback(
    async (id: string, idNovoGrupo: string) => void aplicarResposta(await acaoMoverEntrada(id, idNovoGrupo)),
    [aplicarResposta],
  );
  const renomearGrupo = useCallback(async (id: string, nome: string) => {
    const resposta = await acaoRenomearGrupo(id, nome);
    if (!resposta.ok) return resposta.erro;
    definirArvore(resposta.arvore);
    return null;
  }, []);
  const selecionarNo = useCallback((id: Selecao) => {
    definirSelecao(id);
    definirBusca("");
  }, []);
  const selecionarEntrada = useCallback((id: string) => {
    definirEntradaAtivaId(id);
    definirEditando(false);
  }, []);
  /** Copiar a senha ou abrir o site conta como uso — alimenta "Recentes". */
  const registrarAcesso = useCallback(
    async (id: string) => void aplicarResposta(await acaoRegistrarAcesso(id)),
    [aplicarResposta],
  );
  const favoritar = useCallback(
    async (id: string, favorita: boolean) => void aplicarResposta(await acaoFavoritarEntrada(id, favorita)),
    [aplicarResposta],
  );

  // Nova senha nasce no grupo aberto; num nó virtual ou na busca, no primeiro grupo.
  const grupoParaNova = grupoAtivo ?? arvore.grupos[0] ?? arvore;
  const novaEntrada = useCallback(() => definirCriando(true), []);
  const indiceAtivo = lista.findIndex((entrada) => entrada.id === entradaAtivaId);
  const moverSelecao = useCallback(
    (passo: 1 | -1) => {
      if (lista.length === 0) return;
      // Sem nada aberto, ↓ abre a primeira e ↑ a última; senão anda um passo, sem dar a volta.
      const proximo =
        indiceAtivo === -1
          ? passo === 1
            ? 0
            : lista.length - 1
          : Math.min(lista.length - 1, Math.max(0, indiceAtivo + passo));
      selecionarEntrada(lista[proximo].id);
    },
    [lista, indiceAtivo, selecionarEntrada],
  );

  useAtalho("n", { grupo: "Senhas", descricao: `Nova senha em ${grupoParaNova.nome || "Cofre"}`, acao: novaEntrada });
  useAtalho("ctrl+f", {
    grupo: "Senhas",
    descricao: "Buscar no cofre",
    mesmoEmCampo: true,
    acao: () => campoBusca.current?.select(),
  });
  useAtalho("ctrl+l", { grupo: "Senhas", descricao: "Trancar o cofre", mesmoEmCampo: true, acao: () => trancarAgora() });
  useAtalho("arrowdown", { grupo: "Senhas", descricao: "Próxima senha", ativo: !editando, acao: () => moverSelecao(1) });
  useAtalho("arrowup", { grupo: "Senhas", descricao: "Senha anterior", ativo: !editando, acao: () => moverSelecao(-1) });
  useAtalho("e", {
    grupo: "Senhas",
    descricao: "Editar a senha aberta",
    ativo: !!entradaAtiva && !editando,
    acao: () => definirEditando(true),
  });
  useAtalho("f", {
    grupo: "Senhas",
    descricao: "Favoritar a senha aberta",
    ativo: !!entradaAtiva && !editando,
    acao: () => entradaAtiva && favoritar(entradaAtiva.id, !entradaAtiva.favorita),
  });

  async function trancarAgora() {
    await acaoTrancar();
    aoTrancar();
  }

  async function baixarCofre() {
    const resposta = await acaoBaixarCofre();
    if (!resposta.ok || !resposta.mensagem) return;
    baixarArquivo(base64ParaBytes(resposta.mensagem), "cofre.kdbx", "application/octet-stream");
  }

  async function exportarCsv() {
    if (!confirm("Isso gera um arquivo com todas as suas senhas em TEXTO PURO, sem nenhuma cifra. Continuar?")) {
      return;
    }
    const resposta = await acaoExportarCsv();
    if (!resposta.ok || !resposta.mensagem) return;
    baixarArquivo(new TextEncoder().encode(resposta.mensagem), "senhas.csv", "text/csv");
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-linha bg-superficie px-5 py-2.5">
        <KeyRound size={15} className="text-tinta-3" />
        <h1 className="text-[13px] font-bold tracking-[-0.02em]">Senhas</h1>
        <span className="text-[11.5px] text-tinta-3 tabular-nums">
          {todas.length} {todas.length === 1 ? "senha" : "senhas"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <BotaoComoFunciona />
          <Menu
            gatilho={(abrir) => (
              <BotaoIcone rotulo="Mais opções" onClick={abrir}>
                <MoreHorizontal size={15} />
              </BotaoIcone>
            )}
          >
            {(fechar) => (
              <>
                <ItemMenu
                  icone={<Download size={14} />}
                  onClick={() => {
                    fechar();
                    baixarCofre();
                  }}
                >
                  Baixar cópia do cofre (.kdbx)
                </ItemMenu>
                <ItemMenu
                  icone={<FileDown size={14} />}
                  onClick={() => {
                    fechar();
                    exportarCsv();
                  }}
                >
                  Exportar CSV (texto puro)
                </ItemMenu>
                <SeparadorMenu />
                <ItemMenu
                  icone={<KeySquare size={14} />}
                  onClick={() => {
                    fechar();
                    definirTrocandoSenha(true);
                  }}
                >
                  Trocar senha mestra
                </ItemMenu>
                <SeparadorMenu />
                <ItemMenu
                  icone={<Trash2 size={14} />}
                  perigo
                  onClick={() => {
                    fechar();
                    definirExcluindoCofre(true);
                  }}
                >
                  Excluir cofre
                </ItemMenu>
              </>
            )}
          </Menu>
          <Botao onClick={trancarAgora}>
            <Lock size={13} />
            Trancar agora
          </Botao>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ColunaGrupos
          raiz={arvore}
          selecao={selecao}
          totais={{
            todas: todas.length,
            favoritas: todas.filter((entrada) => entrada.favorita).length,
            recentes: Math.min(LIMITE_RECENTES, todas.filter((entrada) => entrada.acessadoEm).length),
          }}
          onSelecionar={selecionarNo}
          onCriarSubgrupo={abrirNovoSubgrupo}
          onExcluir={abrirExcluirGrupo}
          onMoverGrupo={moverGrupo}
          onMoverEntrada={moverEntrada}
          onRenomear={renomearGrupo}
        />

        <ColunaEntradas
          titulo={tituloDaLista}
          lista={lista}
          busca={busca}
          buscando={buscando}
          campoBusca={campoBusca}
          mostrarGrupo={mostrarGrupoNasLinhas}
          entradaAtivaId={entradaAtivaId}
          onBuscar={definirBusca}
          onSelecionar={selecionarEntrada}
          onNova={novaEntrada}
          onRegistrarAcesso={registrarAcesso}
          onMoverSelecao={moverSelecao}
        />

        <PainelEntrada
          entrada={entradaAtiva}
          editando={editando}
          onEditar={() => definirEditando(true)}
          onCancelar={() => definirEditando(false)}
          onSalvar={async (campos) => {
            if (!entradaAtiva) return;
            if (aplicarResposta(await acaoAtualizarEntrada(entradaAtiva.id, campos))) definirEditando(false);
          }}
          onExcluir={() => definirExcluindoEntrada(true)}
          onFavoritar={favoritar}
          onRegistrarAcesso={registrarAcesso}
          onIrParaGrupo={(id) => {
            selecionarNo(id);
          }}
        />
      </div>

      {criando ? (
        <DialogoNovaEntrada
          grupo={grupoParaNova}
          aoFechar={() => definirCriando(false)}
          aoSalvar={async (campos) => {
            const resposta = await acaoCriarEntrada(grupoParaNova.id, campos);
            if (!resposta.ok || !aplicarResposta(resposta)) return;
            definirCriando(false);
            // Abre a recém-criada no painel: é a mais nova do grupo.
            const grupo = encontrarGrupo(resposta.arvore, grupoParaNova.id);
            const nova = grupo?.entradas[grupo.entradas.length - 1];
            if (nova) selecionarEntrada(nova.id);
            if (!buscando && ehVirtual(selecao) && selecao !== "todas") definirSelecao(grupoParaNova.id);
          }}
        />
      ) : null}

      {excluindoEntrada && entradaAtiva ? (
        <DialogoExcluirEntrada
          entrada={entradaAtiva}
          aoFechar={() => definirExcluindoEntrada(false)}
          aoConfirmar={async () => {
            if (aplicarResposta(await acaoExcluirEntrada(entradaAtiva.id))) {
              definirExcluindoEntrada(false);
              definirEntradaAtivaId(null);
              definirEditando(false);
            }
          }}
        />
      ) : null}

      {acaoGrupo?.tipo === "novo-subgrupo" ? (
        <DialogoNovoGrupo
          grupoPai={acaoGrupo.grupo}
          aoFechar={() => definirAcaoGrupo(null)}
          aoCriar={async (nome) => {
            const resposta = await acaoCriarGrupo(acaoGrupo.grupo.id, nome);
            if (aplicarResposta(resposta)) definirAcaoGrupo(null);
          }}
        />
      ) : null}

      {acaoGrupo?.tipo === "excluir" ? (
        <DialogoExcluirGrupo
          grupo={acaoGrupo.grupo}
          aoFechar={() => definirAcaoGrupo(null)}
          aoConfirmar={async () => {
            const resposta = await acaoExcluirGrupo(acaoGrupo.grupo.id);
            if (resposta.ok && aplicarResposta(resposta)) {
              definirAcaoGrupo(null);
              if (!ehVirtual(selecao) && !encontrarGrupo(resposta.arvore, selecao)) definirSelecao("todas");
            }
          }}
        />
      ) : null}

      {trocandoSenha ? <DialogoTrocarSenha aoFechar={() => definirTrocandoSenha(false)} /> : null}

      {excluindoCofre ? (
        <DialogoExcluirCofre
          aoFechar={() => definirExcluindoCofre(false)}
          aoConfirmar={async () => {
            await acaoExcluirCofre();
            definirExcluindoCofre(false);
            aoExcluirCofre();
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Coluna 1: nós virtuais + grupos                                          */
/* ---------------------------------------------------------------------- */

function ColunaGrupos({
  raiz,
  selecao,
  totais,
  onSelecionar,
  onCriarSubgrupo,
  onExcluir,
  onMoverGrupo,
  onMoverEntrada,
  onRenomear,
}: {
  raiz: GrupoSenhas;
  selecao: Selecao;
  totais: Record<"todas" | "favoritas" | "recentes", number>;
  onSelecionar: (id: Selecao) => void;
  onCriarSubgrupo: (grupo: GrupoSenhas) => void;
  onExcluir: (grupo: GrupoSenhas) => void;
  onMoverGrupo: (id: string, idNovoPai: string) => void;
  onMoverEntrada: (id: string, idNovoGrupo: string) => void;
  onRenomear: (id: string, nome: string) => Promise<string | null>;
}) {
  return (
    <div className="flex w-56 shrink-0 flex-col overflow-hidden border-r border-linha bg-papel">
      <div className="space-y-0.5 px-2 pt-3">
        {NOS_VIRTUAIS.map((no) => (
          <button
            key={no.id}
            type="button"
            onClick={() => onSelecionar(no.id)}
            aria-pressed={selecao === no.id}
            className={clsx(
              "linha-nav flex w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors",
              selecao === no.id ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
            )}
          >
            <span className="shrink-0 text-tinta-3">{no.icone}</span>
            <span className="flex-1 truncate">{no.rotulo}</span>
            <span className="text-[10.5px] text-tinta-3 tabular-nums">{totais[no.id as "todas"] || ""}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-3.5 pt-4 pb-1.5">
        <p className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Grupos</p>
        <BotaoIcone rotulo="Novo grupo" onClick={() => onCriarSubgrupo(raiz)} className="size-6">
          <FolderPlus size={13} />
        </BotaoIcone>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {raiz.grupos.length === 0 ? (
          <p className="px-2 py-3 text-[12px] leading-relaxed text-tinta-3">
            Nenhum grupo ainda. Crie um pelo “+” acima para começar a guardar senhas.
          </p>
        ) : (
          raiz.grupos.map((grupo) => (
            <NoGrupo
              key={grupo.id}
              grupo={grupo}
              profundidade={0}
              grupoAtivoId={selecao}
              onSelecionar={onSelecionar}
              onCriarSubgrupo={onCriarSubgrupo}
              onExcluir={onExcluir}
              onMoverGrupo={onMoverGrupo}
              onMoverEntrada={onMoverEntrada}
              onRenomear={onRenomear}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** `true` se `id` é este grupo ou algum descendente. */
function contémId(grupo: GrupoSenhas, id: string): boolean {
  return grupo.id === id || grupo.grupos.some((sub) => contémId(sub, id));
}

type PropsNoGrupo = {
  grupo: GrupoSenhas;
  profundidade: number;
  grupoAtivoId: string;
  onSelecionar: (id: string) => void;
  onCriarSubgrupo: (grupo: GrupoSenhas) => void;
  onExcluir: (grupo: GrupoSenhas) => void;
  onMoverGrupo: (id: string, idNovoPai: string) => void;
  onMoverEntrada: (id: string, idNovoGrupo: string) => void;
  onRenomear: (id: string, nome: string) => Promise<string | null>;
};

/**
 * `memo` com comparador próprio: navegar entre grupos muda `grupoAtivoId`
 * para todos os nós, mas só os dois que trocam de estado (o que sai e o que
 * entra) precisam re-renderizar. Os callbacks vêm do `CofreAberto` via
 * `useCallback`, então são estáveis; a árvore só muda em cima de uma
 * operação, aí `grupo` muda de referência e o nó re-renderiza normalmente.
 */
const NoGrupo = memo(NoGrupoImpl, (anterior, proximo) => {
  if (anterior.grupo !== proximo.grupo || anterior.profundidade !== proximo.profundidade) return false;
  if (anterior.grupoAtivoId === proximo.grupoAtivoId) return true;
  return (
    !contémId(anterior.grupo, anterior.grupoAtivoId) && !contémId(anterior.grupo, proximo.grupoAtivoId)
  );
});

function NoGrupoImpl({
  grupo,
  profundidade,
  grupoAtivoId,
  onSelecionar,
  onCriarSubgrupo,
  onExcluir,
  onMoverGrupo,
  onMoverEntrada,
  onRenomear,
}: PropsNoGrupo) {
  const [sobre, definirSobre] = useState(false);
  const [renomeando, definirRenomeando] = useState(false);
  const ativo = grupo.id === grupoAtivoId;

  return (
    <div>
      <div
        // Desligado durante a edição do nome: um elemento arrastável engole
        // o duplo clique do mouse antes dele virar um `dblclick` de
        // verdade, então com `draggable` sempre ligado o clique duplo para
        // renomear simplesmente não fazia nada.
        draggable={!renomeando}
        onDragStart={(evento) => iniciarArrastoDeGrupoSenha(evento, grupo.id)}
        onDragOver={(evento) => {
          if (!trazGrupoSenha(evento) && !trazEntradaSenha(evento)) return;
          evento.preventDefault();
          evento.dataTransfer.dropEffect = "move";
          definirSobre(true);
        }}
        onDragLeave={() => definirSobre(false)}
        onDrop={(evento) => {
          definirSobre(false);
          if (trazGrupoSenha(evento)) {
            evento.preventDefault();
            const id = lerIdDeGrupoSenha(evento);
            if (id && id !== grupo.id) onMoverGrupo(id, grupo.id);
          } else if (trazEntradaSenha(evento)) {
            evento.preventDefault();
            const id = lerIdDeEntradaSenha(evento);
            if (id) onMoverEntrada(id, grupo.id);
          }
        }}
        onClick={() => onSelecionar(grupo.id)}
        style={{ paddingLeft: 8 + profundidade * 14 }}
        className={clsx(
          "linha-nav group flex cursor-pointer items-center gap-1.5 rounded-md pr-1 text-[12.5px] transition-colors",
          ativo ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
          sobre && "ring-2 ring-[var(--realce)]",
        )}
      >
        <Folder size={13} className="shrink-0 text-tinta-3" />
        <div className="min-w-0 flex-1 truncate">
          <TituloEditavel
            titulo={grupo.nome}
            aoAlternarEdicao={definirRenomeando}
            aoRenomear={(novoNome) => onRenomear(grupo.id, novoNome)}
          />
        </div>
        <span className="shrink-0 text-[10px] text-tinta-3 tabular-nums opacity-0 group-hover:opacity-100">
          {grupo.entradas.length || ""}
        </span>
        <Menu
          gatilho={(abrir) => (
            <BotaoIcone
              rotulo={`Opções de ${grupo.nome}`}
              onClick={(evento) => {
                evento.stopPropagation();
                abrir();
              }}
              className="size-5 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal size={12} />
            </BotaoIcone>
          )}
        >
          {(fechar) => (
            <>
              <ItemMenu
                icone={<FolderPlus size={14} />}
                onClick={() => {
                  fechar();
                  onCriarSubgrupo(grupo);
                }}
              >
                Novo subgrupo
              </ItemMenu>
              <SeparadorMenu />
              <ItemMenu
                icone={<Trash2 size={14} />}
                perigo
                onClick={() => {
                  fechar();
                  onExcluir(grupo);
                }}
              >
                Excluir
              </ItemMenu>
            </>
          )}
        </Menu>
      </div>
      {grupo.grupos.length > 0 ? (
        <div>
          {grupo.grupos.map((sub) => (
            <NoGrupo
              key={sub.id}
              grupo={sub}
              profundidade={profundidade + 1}
              grupoAtivoId={grupoAtivoId}
              onSelecionar={onSelecionar}
              onCriarSubgrupo={onCriarSubgrupo}
              onExcluir={onExcluir}
              onMoverGrupo={onMoverGrupo}
              onMoverEntrada={onMoverEntrada}
              onRenomear={onRenomear}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Coluna 2: busca + linhas de entrada                                     */
/* ---------------------------------------------------------------------- */

function ColunaEntradas({
  titulo,
  lista,
  busca,
  buscando,
  campoBusca,
  mostrarGrupo,
  entradaAtivaId,
  onBuscar,
  onSelecionar,
  onNova,
  onRegistrarAcesso,
  onMoverSelecao,
}: {
  titulo: string;
  lista: EntradaSenha[];
  busca: string;
  buscando: boolean;
  campoBusca: React.RefObject<HTMLInputElement | null>;
  mostrarGrupo: boolean;
  entradaAtivaId: string | null;
  onBuscar: (texto: string) => void;
  onSelecionar: (id: string) => void;
  onNova: () => void;
  onRegistrarAcesso: (id: string) => void;
  onMoverSelecao: (passo: 1 | -1) => void;
}) {
  return (
    <div className="flex w-80 shrink-0 flex-col overflow-hidden border-r border-linha bg-papel">
      <div className="px-3 pt-3">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-tinta-3" />
          <input
            ref={campoBusca}
            value={busca}
            onChange={(evento) => onBuscar(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Escape" && busca) {
                evento.preventDefault();
                onBuscar("");
              } else if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
                evento.preventDefault();
                onMoverSelecao(evento.key === "ArrowDown" ? 1 : -1);
              }
            }}
            placeholder="Buscar em todos os grupos…"
            aria-label="Buscar senhas"
            className="h-8.5 w-full rounded-lg border border-linha bg-superficie-alta pr-7 pl-8 text-[12.5px] text-tinta transition-shadow placeholder:text-tinta-3 focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => onBuscar("")}
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-tinta-3 hover:text-tinta"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold tracking-[-0.02em]">{titulo}</p>
          <p className="text-[11px] text-tinta-3">
            {lista.length === 0 ? "nenhuma senha" : `${lista.length} ${lista.length === 1 ? "senha" : "senhas"}`}
          </p>
        </div>
        <BotaoIcone rotulo="Nova senha (n)" onClick={onNova} className="border border-linha bg-superficie-alta">
          <Plus size={14} />
        </BotaoIcone>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3" role="listbox" aria-label={titulo}>
        {lista.length === 0 ? (
          <div className="px-2 pt-6">
            <Vazio
              icone={<KeyRound size={20} />}
              titulo={buscando ? "Nada encontrado" : "Nenhuma senha aqui"}
              descricao={
                buscando
                  ? "A busca olha título, usuário, endereço e notas de todos os grupos."
                  : "Clique em “+” (ou tecle n) para guardar a primeira."
              }
            />
          </div>
        ) : (
          lista.map((entrada) => (
            <LinhaEntrada
              key={entrada.id}
              entrada={entrada}
              ativa={entrada.id === entradaAtivaId}
              mostrarGrupo={mostrarGrupo}
              onSelecionar={onSelecionar}
              onRegistrarAcesso={onRegistrarAcesso}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** A inicial colorida da entrada — no lugar do favicon enquanto não há um. */
function Inicial({ titulo, tamanho = 28 }: { titulo: string; tamanho?: number }) {
  const cor = corDaInicial(titulo);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-md font-bold uppercase"
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.round(tamanho * 0.46),
        color: `color-mix(in srgb, ${cor} 85%, var(--tinta))`,
        background: `color-mix(in srgb, ${cor} 16%, transparent)`,
      }}
    >
      {(titulo.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

const LinhaEntrada = memo(function LinhaEntrada({
  entrada,
  ativa,
  mostrarGrupo,
  onSelecionar,
  onRegistrarAcesso,
}: {
  entrada: EntradaSenha;
  ativa: boolean;
  mostrarGrupo: boolean;
  onSelecionar: (id: string) => void;
  onRegistrarAcesso: (id: string) => void;
}) {
  const [copiado, definirCopiado] = useState<"usuario" | "senha" | null>(null);
  const linha = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ativa) linha.current?.scrollIntoView({ block: "nearest" });
  }, [ativa]);

  async function copiar(evento: React.MouseEvent, qual: "usuario" | "senha") {
    // Não pode abrir a entrada por trás — é justamente o atalho para NÃO
    // precisar abrir a senha para copiar ela.
    evento.stopPropagation();
    if (qual === "senha") {
      await copiarComLimpeza(entrada.senha);
      onRegistrarAcesso(entrada.id);
    } else {
      await navigator.clipboard.writeText(entrada.usuario).catch(() => {});
    }
    definirCopiado(qual);
    setTimeout(() => definirCopiado(null), 1500);
  }

  return (
    <div
      ref={linha}
      role="option"
      aria-selected={ativa}
      draggable
      onDragStart={(evento) => iniciarArrastoDeEntradaSenha(evento, entrada.id)}
      onClick={() => onSelecionar(entrada.id)}
      className={clsx(
        "group flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 transition-colors",
        ativa ? "bg-realce-medio" : "hover:bg-realce-fraco",
      )}
    >
      <Inicial titulo={entrada.titulo} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="flex items-center gap-1 truncate text-[12.5px] font-medium text-tinta">
          <span className="truncate">{entrada.titulo}</span>
          {entrada.favorita ? <Star size={10} className="shrink-0 fill-current text-[var(--realce)]" /> : null}
        </p>
        <p className="truncate text-[11px] text-tinta-3">
          {entrada.usuario || "sem usuário"}
          {mostrarGrupo && entrada.grupoNome ? <span className="text-tinta-3/70"> · {entrada.grupoNome}</span> : null}
        </p>
      </div>
      <div
        className={clsx(
          "flex shrink-0 items-center gap-0.5",
          copiado ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        )}
      >
        {entrada.usuario ? (
          <BotaoIcone
            rotulo={copiado === "usuario" ? "Copiado!" : "Copiar usuário"}
            onClick={(evento) => copiar(evento, "usuario")}
            className={clsx("size-6", copiado === "usuario" && "pointer-events-none text-[var(--realce)]")}
          >
            {copiado === "usuario" ? <Check size={13} /> : <User size={13} />}
          </BotaoIcone>
        ) : null}
        <BotaoIcone
          rotulo={copiado === "senha" ? "Copiada!" : "Copiar senha"}
          onClick={(evento) => copiar(evento, "senha")}
          className={clsx("size-6", copiado === "senha" && "pointer-events-none text-[var(--realce)]")}
        >
          {copiado === "senha" ? <Check size={13} /> : <Copy size={13} />}
        </BotaoIcone>
      </div>
    </div>
  );
});

/* ---------------------------------------------------------------------- */
/* Coluna 3: painel de detalhe (leitura e edição no lugar)                 */
/* ---------------------------------------------------------------------- */

function PainelEntrada({
  entrada,
  editando,
  onEditar,
  onCancelar,
  onSalvar,
  onExcluir,
  onFavoritar,
  onRegistrarAcesso,
  onIrParaGrupo,
}: {
  entrada: EntradaSenha | null;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvar: (campos: CamposEntrada) => Promise<void>;
  onExcluir: () => void;
  onFavoritar: (id: string, favorita: boolean) => void;
  onRegistrarAcesso: (id: string) => void;
  onIrParaGrupo: (id: string) => void;
}) {
  if (!entrada) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center bg-papel">
        <Vazio
          icone={<KeyRound size={20} />}
          titulo="Nenhuma senha aberta"
          descricao="Escolha uma na lista ao lado — ou tecle n para guardar uma nova. Copiar direto da lista não precisa abrir."
        />
      </div>
    );
  }

  if (editando) {
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-papel">
        <div className="mx-auto w-full max-w-xl px-6 pt-5 pb-8">
          <p className="mb-3 text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Editando</p>
          <FormularioEntrada
            key={entrada.id}
            inicial={entrada}
            aoCancelar={onCancelar}
            aoSalvar={onSalvar}
            rodapeEsquerdo={
              <Botao type="button" variante="perigo" onClick={onExcluir}>
                <Trash2 size={13} />
                Excluir
              </Botao>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-papel">
      <div className="mx-auto w-full max-w-xl px-6 pt-5 pb-8">
        <div className="flex items-start gap-3">
          <Inicial titulo={entrada.titulo} tamanho={40} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] leading-tight font-bold tracking-[-0.02em]">{entrada.titulo}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-tinta-3">
              <button
                type="button"
                onClick={() => onIrParaGrupo(entrada.grupoId)}
                className="inline-flex items-center gap-1 hover:text-tinta hover:underline"
              >
                <Folder size={11} />
                {entrada.grupoNome || "Cofre"}
              </button>
              <span>·</span>
              <span title={formatarDataHora(entrada.atualizadoEm)}>atualizada {tempoRelativo(entrada.atualizadoEm)}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <BotaoIcone
              rotulo={entrada.favorita ? "Tirar das favoritas (f)" : "Favoritar (f)"}
              onClick={() => onFavoritar(entrada.id, !entrada.favorita)}
              aria-pressed={entrada.favorita}
              className={clsx(entrada.favorita && "text-[var(--realce)]")}
            >
              <Star size={15} className={clsx(entrada.favorita && "fill-current")} />
            </BotaoIcone>
            <Botao onClick={onEditar}>
              <Pencil size={13} />
              Editar
            </Botao>
            <Menu
              gatilho={(abrir) => (
                <BotaoIcone rotulo="Mais opções da senha" onClick={abrir}>
                  <MoreHorizontal size={15} />
                </BotaoIcone>
              )}
            >
              {(fechar) => (
                <>
                  {entrada.url ? (
                    <ItemMenu
                      icone={<ExternalLink size={14} />}
                      onClick={() => {
                        fechar();
                        window.open(entrada.url, "_blank", "noopener,noreferrer");
                        onRegistrarAcesso(entrada.id);
                      }}
                    >
                      Abrir site
                    </ItemMenu>
                  ) : null}
                  <ItemMenu
                    icone={<Trash2 size={14} />}
                    perigo
                    onClick={() => {
                      fechar();
                      onExcluir();
                    }}
                  >
                    Excluir
                  </ItemMenu>
                </>
              )}
            </Menu>
          </div>
        </div>

        <div className="painel mt-5 divide-y divide-linha">
          <CampoDetalhe rotulo="Usuário" valor={entrada.usuario} copiavel />
          <CampoSenhaDetalhe senha={entrada.senha} aoCopiar={() => onRegistrarAcesso(entrada.id)} />
          <CampoDetalhe
            rotulo="Site"
            valor={entrada.url}
            copiavel
            acaoExtra={
              entrada.url ? (
                <BotaoIcone
                  rotulo="Abrir site"
                  onClick={() => {
                    window.open(entrada.url, "_blank", "noopener,noreferrer");
                    onRegistrarAcesso(entrada.id);
                  }}
                  className="size-7"
                >
                  <ExternalLink size={13} />
                </BotaoIcone>
              ) : null
            }
          />
          <CampoDetalhe rotulo="Notas" valor={entrada.notas} multilinha />
        </div>

        <p className="mt-4 text-[11px] text-tinta-3">
          Criada em {formatarDataHora(entrada.criadoEm)} · Alterada em {formatarDataHora(entrada.atualizadoEm)}
          {entrada.acessadoEm ? ` · Usada ${formatarDataCurta(entrada.acessadoEm)}` : ""}
        </p>
      </div>
    </div>
  );
}

/** Uma linha do painel: rótulo em cima, valor embaixo, botões à direita. */
function CampoDetalhe({
  rotulo,
  valor,
  copiavel,
  multilinha,
  acaoExtra,
}: {
  rotulo: string;
  valor: string;
  copiavel?: boolean;
  multilinha?: boolean;
  acaoExtra?: React.ReactNode;
}) {
  const [copiado, definirCopiado] = useState(false);
  async function copiar() {
    await navigator.clipboard.writeText(valor).catch(() => {});
    definirCopiado(true);
    setTimeout(() => definirCopiado(false), 1500);
  }
  return (
    <div className="group flex items-start gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">{rotulo}</p>
        {valor ? (
          <p className={clsx("mt-0.5 text-[13px] text-tinta", multilinha ? "whitespace-pre-wrap" : "truncate")}>
            {valor}
          </p>
        ) : (
          <p className="mt-0.5 text-[13px] text-tinta-3">—</p>
        )}
      </div>
      {valor ? (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {acaoExtra}
          {copiavel ? (
            <BotaoIcone
              rotulo={copiado ? "Copiado!" : `Copiar ${rotulo.toLowerCase()}`}
              onClick={copiar}
              className={clsx("size-7", copiado && "text-[var(--realce)]")}
            >
              {copiado ? <Check size={13} /> : <Copy size={13} />}
            </BotaoIcone>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A linha da senha: escondida por padrão, olho para revelar, copiar com limpeza. */
function CampoSenhaDetalhe({ senha, aoCopiar }: { senha: string; aoCopiar: () => void }) {
  const [visivel, definirVisivel] = useState(false);
  const [copiado, definirCopiado] = useState(false);
  const limpar = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (limpar.current) clearTimeout(limpar.current);
  }, []);

  async function copiar() {
    await copiarComLimpeza(senha);
    aoCopiar();
    definirCopiado(true);
    if (limpar.current) clearTimeout(limpar.current);
    limpar.current = setTimeout(() => definirCopiado(false), ESPERA_LIMPAR_AREA_DE_TRANSFERENCIA);
  }

  return (
    <div className="group flex items-start gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">Senha</p>
        {senha ? (
          <p className={clsx("mt-0.5 truncate text-[13px] text-tinta", visivel ? "font-mono" : "tracking-[0.2em]")}>
            {visivel ? senha : "••••••••••••"}
          </p>
        ) : (
          <p className="mt-0.5 text-[13px] text-tinta-3">—</p>
        )}
        {copiado ? (
          <p className="mt-1 text-[11px] text-tinta-3">
            Copiada — some da área de transferência sozinha em 20 segundos.
          </p>
        ) : null}
      </div>
      {senha ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <BotaoIcone
            rotulo={visivel ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => definirVisivel((valor) => !valor)}
            className="size-7"
          >
            {visivel ? <EyeOff size={13} /> : <Eye size={13} />}
          </BotaoIcone>
          <BotaoIcone
            rotulo={copiado ? "Copiada!" : "Copiar senha"}
            onClick={copiar}
            className={clsx("size-7", copiado && "text-[var(--realce)]")}
          >
            {copiado ? <Check size={13} /> : <Copy size={13} />}
          </BotaoIcone>
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Formulário (edição no painel e criação no diálogo)                      */
/* ---------------------------------------------------------------------- */

function FormularioEntrada({
  inicial,
  aoCancelar,
  aoSalvar,
  rodapeEsquerdo,
  rotuloSalvar = "Salvar",
}: {
  inicial: CamposEntrada | null;
  aoCancelar: () => void;
  aoSalvar: (campos: CamposEntrada) => Promise<void>;
  rodapeEsquerdo?: React.ReactNode;
  rotuloSalvar?: string;
}) {
  const [campos, definirCampos] = useState<CamposEntrada>({
    titulo: inicial?.titulo ?? "",
    usuario: inicial?.usuario ?? "",
    senha: inicial?.senha ?? "",
    url: inicial?.url ?? "",
    notas: inicial?.notas ?? "",
  });
  const [mostrarSenha, definirMostrarSenha] = useState(!inicial);
  const [salvando, definirSalvando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    definirSalvando(true);
    await aoSalvar(campos);
    definirSalvando(false);
  }

  return (
    <form
      onSubmit={enviar}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") {
          evento.preventDefault();
          aoCancelar();
        }
      }}
      className="space-y-3"
    >
      <div>
        <Rotulo>Título</Rotulo>
        <Campo
          autoFocus
          value={campos.titulo}
          onChange={(evento) => definirCampos({ ...campos, titulo: evento.target.value })}
          placeholder="GitHub, banco, e-mail…"
        />
      </div>
      <div>
        <Rotulo>Usuário</Rotulo>
        <Campo value={campos.usuario} onChange={(evento) => definirCampos({ ...campos, usuario: evento.target.value })} />
      </div>
      <div>
        <Rotulo>Senha</Rotulo>
        <div className="relative">
          <Campo
            type={mostrarSenha ? "text" : "password"}
            value={campos.senha}
            onChange={(evento) => definirCampos({ ...campos, senha: evento.target.value })}
            className={clsx("pr-9", mostrarSenha && "font-mono")}
          />
          <button
            type="button"
            onClick={() => definirMostrarSenha((valor) => !valor)}
            title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-tinta-3 hover:text-tinta"
          >
            {mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      <div>
        <Rotulo>Site</Rotulo>
        <Campo
          value={campos.url}
          onChange={(evento) => definirCampos({ ...campos, url: evento.target.value })}
          placeholder="https://…"
        />
      </div>
      <div>
        <Rotulo>Notas</Rotulo>
        <textarea
          value={campos.notas}
          onChange={(evento) => definirCampos({ ...campos, notas: evento.target.value })}
          rows={3}
          className="w-full resize-none rounded-lg border border-linha bg-superficie-alta px-3 py-2 text-[13px] text-tinta transition-shadow placeholder:text-tinta-3 focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        {rodapeEsquerdo}
        <div className="ml-auto flex gap-2">
          <Botao type="button" onClick={aoCancelar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario" disabled={salvando || !campos.titulo.trim()}>
            {salvando ? <Loader2 size={13} className="animate-spin" /> : null}
            {rotuloSalvar}
          </Botao>
        </div>
      </div>
    </form>
  );
}

function DialogoNovaEntrada({
  grupo,
  aoFechar,
  aoSalvar,
}: {
  grupo: GrupoSenhas;
  aoFechar: () => void;
  aoSalvar: (campos: CamposEntrada) => Promise<void>;
}) {
  return (
    <Dialogo titulo="Nova senha" descricao={`Vai para o grupo “${grupo.nome || "Cofre"}”.`} aberto aoFechar={aoFechar} largura="max-w-lg">
      <FormularioEntrada inicial={null} aoCancelar={aoFechar} aoSalvar={aoSalvar} rotuloSalvar="Guardar" />
    </Dialogo>
  );
}
