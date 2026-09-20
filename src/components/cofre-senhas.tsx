"use client";

import clsx from "clsx";
import {
  Activity,
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileDown,
  Folder,
  FolderOpen,
  FolderPlus,
  History,
  KeyRound,
  KeySquare,
  Layers,
  Loader2,
  Lock,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  ScanLine,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wand2,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RespostaSenhas } from "@/app/acoes-senhas";
import {
  acaoAdicionarAnexo,
  acaoAtualizarEntrada,
  acaoBaixarAnexo,
  acaoBaixarCofre,
  acaoCriarEntrada,
  acaoCriarGrupo,
  acaoDefinirConfig,
  acaoEsvaziarLixeira,
  acaoExcluirCofre,
  acaoExcluirDaLixeiraDeVez,
  acaoExcluirEntrada,
  acaoExcluirGrupo,
  acaoExportarCsv,
  acaoFavoritarEntrada,
  acaoMoverEntrada,
  acaoMoverGrupo,
  acaoObterConfig,
  acaoObterHistorico,
  acaoObterLixeira,
  acaoRegistrarAcesso,
  acaoRemoverAnexo,
  acaoRenomearGrupo,
  acaoRestaurarDaLixeira,
  acaoRestaurarVersao,
  acaoStatusCofre,
  acaoTrancar,
} from "@/app/acoes-senhas";
import { acaoBuscarMetadadosUrl } from "@/app/acoes-links";
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
import { formatarDataCurta, formatarDataHora, formatarDia } from "@/lib/rotas";
import type {
  CampoExtraSenha,
  CamposEntrada,
  ConfigSenhas,
  EntradaSenha,
  GrupoSenhas,
  ItemLixeiraSenha,
  VersaoSenha,
} from "@/lib/tipos";
import { medirForca } from "@/lib/forca-senha";
import { contarVazamentos } from "@/lib/hibp";
import type { FaviconEntrada } from "@/lib/senhas";
import { gerarCodigoTotp, interpretarOtp, segundosRestantesTotp } from "@/lib/totp";

import { BotaoComoFunciona } from "./explicador-criptografia";
import { BarraForca, GeradorSenha, SeloForca } from "./gerador-senha";
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

/** Com quantos dias de antecedência a validade começa a ser avisada. */
const DIAS_AVISO_VALIDADE = 14;

type EstadoValidade = "vencida" | "vencendo" | null;

/** "AAAA-MM-DD" → vencida (já passou), vencendo (nos próximos 14 dias) ou nada. */
function estadoDaValidade(expiraEm: string | null): EstadoValidade {
  if (!expiraEm) return null;
  const [ano, mes, dia] = expiraEm.split("-").map(Number);
  const hoje = new Date();
  const dias = Math.round(
    (new Date(ano, mes - 1, dia).getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) /
      86_400_000,
  );
  if (dias < 0) return "vencida";
  if (dias <= DIAS_AVISO_VALIDADE) return "vencendo";
  return null;
}

/** As outras entradas que usam a mesma senha — "esta senha já está em X". */
function repetidaEm(senha: string, todas: EntradaSenha[], excetoId: string | null): EntradaSenha[] {
  if (!senha) return [];
  return todas.filter((entrada) => entrada.id !== excetoId && entrada.senha === senha);
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolver((leitor.result as string).split(",")[1] ?? "");
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

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
  const [contagemLixeira, definirContagemLixeira] = useState(0);
  const [vendoSaude, definirVendoSaude] = useState(false);
  const [configurandoTrava, definirConfigurandoTrava] = useState(false);
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

  // A lixeira não faz parte da árvore normal — recontada à parte sempre que
  // algo muda (excluir/restaurar/esvaziar), só pro número no rodapé da coluna.
  useEffect(() => {
    let cancelado = false;
    acaoObterLixeira().then((resposta) => {
      if (!cancelado && resposta.ok) definirContagemLixeira(resposta.itens.length);
    });
    return () => {
      cancelado = true;
    };
  }, [arvore]);

  // "Trancar ao fechar a aba" (preferência em Trava e privacidade):
  // `sendBeacon` tenta entregar mesmo com a página descarregando, o que um
  // `fetch`/server action normal não garante nesse momento.
  useEffect(() => {
    let cancelado = false;
    const aoDescarregar = () => navigator.sendBeacon("/senhas/trancar-beacon");
    acaoObterConfig().then((config) => {
      if (!cancelado && config.trancarAoFechar) window.addEventListener("pagehide", aoDescarregar);
    });
    return () => {
      cancelado = true;
      window.removeEventListener("pagehide", aoDescarregar);
    };
  }, []);

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
                  icone={<Activity size={14} />}
                  onClick={() => {
                    fechar();
                    definirVendoSaude(true);
                  }}
                >
                  Relatório de saúde
                </ItemMenu>
                <ItemMenu
                  icone={<ShieldAlert size={14} />}
                  onClick={() => {
                    fechar();
                    definirConfigurandoTrava(true);
                  }}
                >
                  Trava e privacidade
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
          contagemLixeira={contagemLixeira}
          onSelecionar={selecionarNo}
          onCriarSubgrupo={abrirNovoSubgrupo}
          onExcluir={abrirExcluirGrupo}
          onMoverGrupo={moverGrupo}
          onMoverEntrada={moverEntrada}
          onRenomear={renomearGrupo}
        />

        {selecao === "lixeira" ? (
          <PainelLixeira aoAtualizarArvore={definirArvore} />
        ) : (
          <>
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
              todas={todas}
              editando={editando}
              onEditar={() => definirEditando(true)}
              onCancelar={() => definirEditando(false)}
              onSalvar={async (campos, favicon) => {
                if (!entradaAtiva) return;
                if (aplicarResposta(await acaoAtualizarEntrada(entradaAtiva.id, campos, favicon))) definirEditando(false);
              }}
              onArvoreAtualizada={aplicarResposta}
              onExcluir={() => definirExcluindoEntrada(true)}
              onFavoritar={favoritar}
              onRegistrarAcesso={registrarAcesso}
              onIrParaGrupo={(id) => {
                selecionarNo(id);
              }}
              onAnexar={async (arquivo) => {
                if (!entradaAtiva) return;
                if (arquivo.size > 5 * 1024 * 1024) {
                  alert("Anexo grande demais (máximo 5 MB).");
                  return;
                }
                aplicarResposta(await acaoAdicionarAnexo(entradaAtiva.id, arquivo.name, await lerArquivoBase64(arquivo)));
              }}
              onRemoverAnexo={async (nome) => {
                if (!entradaAtiva || !confirm(`Remover o anexo “${nome}”?`)) return;
                aplicarResposta(await acaoRemoverAnexo(entradaAtiva.id, nome));
              }}
              onBaixarAnexo={async (nome) => {
                if (!entradaAtiva) return;
                const resposta = await acaoBaixarAnexo(entradaAtiva.id, nome);
                if (!resposta.ok || !resposta.mensagem) {
                  alert(resposta.ok ? "Anexo vazio." : resposta.erro);
                  return;
                }
                baixarArquivo(base64ParaBytes(resposta.mensagem), nome, "application/octet-stream");
              }}
            />
          </>
        )}
      </div>

      {criando ? (
        <DialogoNovaEntrada
          grupo={grupoParaNova}
          todas={todas}
          aoFechar={() => definirCriando(false)}
          aoSalvar={async (campos, favicon) => {
            const resposta = await acaoCriarEntrada(grupoParaNova.id, campos, favicon);
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

      {vendoSaude ? (
        <DialogoSaude
          todas={todas}
          aoFechar={() => definirVendoSaude(false)}
          onIrPara={(id) => {
            selecionarEntrada(id);
            definirVendoSaude(false);
          }}
        />
      ) : null}

      {configurandoTrava ? <DialogoConfigCofre aoFechar={() => definirConfigurandoTrava(false)} /> : null}

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
  contagemLixeira,
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
  contagemLixeira: number;
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
      <div className="border-t border-linha px-2 py-1.5">
        <button
          type="button"
          onClick={() => onSelecionar("lixeira")}
          aria-pressed={selecao === "lixeira"}
          className={clsx(
            "linha-nav flex w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] transition-colors",
            selecao === "lixeira" ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
          )}
        >
          <Trash2 size={13} className="shrink-0 text-tinta-3" />
          <span className="flex-1 truncate">Lixeira</span>
          <span className="text-[10.5px] text-tinta-3 tabular-nums">{contagemLixeira || ""}</span>
        </button>
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

/**
 * A lixeira do cofre: ocupa as colunas do meio e de detalhe juntas — não
 * tem o que editar aqui, só restaurar ou apagar de vez. Carrega sozinha
 * (a lixeira não é parte da árvore normal, então não vem em `arvore`).
 */
function PainelLixeira({ aoAtualizarArvore }: { aoAtualizarArvore: (arvore: GrupoSenhas) => void }) {
  const [itens, definirItens] = useState<ItemLixeiraSenha[] | null>(null);
  const [processando, definirProcessando] = useState<string | null>(null);
  const [esvaziando, definirEsvaziando] = useState(false);
  const [confirmandoEsvaziar, definirConfirmandoEsvaziar] = useState(false);

  const carregar = useCallback(async () => {
    const resposta = await acaoObterLixeira();
    definirItens(resposta.ok ? resposta.itens : []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function restaurar(id: string) {
    definirProcessando(id);
    const resposta = await acaoRestaurarDaLixeira(id);
    definirProcessando(null);
    if (!resposta.ok) {
      alert(resposta.erro);
      return;
    }
    aoAtualizarArvore(resposta.arvore);
    await carregar();
  }

  async function apagarDeVez(id: string, titulo: string) {
    if (!confirm(`Apagar "${titulo}" para sempre? Não tem como desfazer.`)) return;
    definirProcessando(id);
    const resposta = await acaoExcluirDaLixeiraDeVez(id);
    definirProcessando(null);
    if (!resposta.ok) {
      alert(resposta.erro);
      return;
    }
    aoAtualizarArvore(resposta.arvore);
    await carregar();
  }

  async function esvaziar() {
    definirEsvaziando(true);
    const resposta = await acaoEsvaziarLixeira();
    definirEsvaziando(false);
    definirConfirmandoEsvaziar(false);
    if (!resposta.ok) {
      alert(resposta.erro);
      return;
    }
    aoAtualizarArvore(resposta.arvore);
    await carregar();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-papel">
      <div className="mx-auto w-full max-w-2xl px-6 pt-5 pb-8">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-bold tracking-[-0.02em]">Lixeira</h2>
            <p className="mt-0.5 text-[12px] text-tinta-3">
              Fica aqui até você esvaziar — depois de esvaziar não tem como desfazer.
            </p>
          </div>
          {itens && itens.length > 0 ? (
            <Botao variante="perigo" onClick={() => definirConfirmandoEsvaziar(true)}>
              <Trash2 size={13} />
              Esvaziar lixeira
            </Botao>
          ) : null}
        </div>

        <div className="mt-4">
          {itens === null ? (
            <p className="py-10 text-center text-[12.5px] text-tinta-3">Carregando…</p>
          ) : itens.length === 0 ? (
            <Vazio icone={<Trash2 size={20} />} titulo="A lixeira está vazia" descricao="Grupos e senhas excluídos aparecem aqui antes de sumir de vez." />
          ) : (
            <ul className="painel divide-y divide-linha">
              {itens.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-realce-medio text-[var(--realce)]">
                    {item.tipo === "grupo" ? <FolderOpen size={14} /> : <KeyRound size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-tinta">{item.titulo}</p>
                    <p className="text-[11px] text-tinta-3">
                      {item.tipo === "grupo" ? `Grupo${item.itensDentro ? ` · ${item.itensDentro} ${item.itensDentro === 1 ? "item" : "itens"}` : ""}` : "Senha"}
                      {item.excluidoEm ? ` · excluído ${tempoRelativo(item.excluidoEm)}` : ""}
                    </p>
                  </div>
                  <Botao
                    onClick={() => restaurar(item.id)}
                    disabled={processando !== null}
                    className="h-7 px-2 text-[11.5px]"
                  >
                    {processando === item.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                    Restaurar
                  </Botao>
                  <BotaoIcone
                    rotulo="Apagar para sempre"
                    onClick={() => apagarDeVez(item.id, item.titulo)}
                    disabled={processando !== null}
                    className="size-7"
                  >
                    <Trash2 size={13} />
                  </BotaoIcone>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {confirmandoEsvaziar ? (
        <Dialogo
          titulo="Esvaziar a lixeira?"
          descricao={`Os ${itens?.length ?? 0} itens dentro dela somem para sempre — sem outra lixeira depois desta.`}
          aberto
          aoFechar={() => definirConfirmandoEsvaziar(false)}
        >
          <div className="flex justify-end gap-2">
            <Botao onClick={() => definirConfirmandoEsvaziar(false)}>Cancelar</Botao>
            <Botao variante="perigo-solido" disabled={esvaziando} onClick={esvaziar}>
              {esvaziando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Esvaziar
            </Botao>
          </div>
        </Dialogo>
      ) : null}
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

/**
 * O ícone de uma entrada: o favicon do site quando ele existe (buscado ao
 * salvar a URL, guardado dentro do cofre — ver `buscarFavicon` no
 * formulário), senão a inicial colorida de sempre. A URL leva
 * `atualizadoEm` como versão, pra não servir do cache um favicon antigo
 * depois de trocar a URL da entrada.
 */
function Avatar({ entrada, tamanho = 28 }: { entrada: EntradaSenha; tamanho?: number }) {
  const [falhou, definirFalhou] = useState(false);
  if (!entrada.temFavicon || falhou) return <Inicial titulo={entrada.titulo} tamanho={tamanho} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- favicon local pequeno, cifrado na sessão; não vale a pena o otimizador de imagens do Next pra isso.
    <img
      key={entrada.id}
      src={`/senhas/favicon/${entrada.id}?v=${entrada.atualizadoEm}`}
      alt=""
      width={tamanho}
      height={tamanho}
      className="shrink-0 rounded-md object-contain"
      style={{ width: tamanho, height: tamanho }}
      // Sob demanda: um grupo com muitas entradas disparava uma requisição
      // por favicon de uma vez só ao trocar de grupo — o navegador decide
      // sozinho, pela distância até a tela, o que baixa agora e o que espera.
      loading="lazy"
      // O cofre pode trancar entre a lista carregar e a imagem pedir — cai pra inicial.
      onError={() => definirFalhou(true)}
    />
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
  const validade = estadoDaValidade(entrada.expiraEm);

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
      <Avatar entrada={entrada} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="flex items-center gap-1 truncate text-[12.5px] font-medium text-tinta">
          <span className="truncate">{entrada.titulo}</span>
          {entrada.favorita ? <Star size={10} className="shrink-0 fill-current text-[var(--realce)]" /> : null}
          {validade ? (
            <AlertTriangle
              size={10}
              className={clsx("shrink-0", validade === "vencida" ? "text-perigo" : "text-[#F5822C]")}
              aria-label={validade === "vencida" ? "Senha vencida" : "Senha vencendo"}
            />
          ) : null}
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
  todas,
  editando,
  onEditar,
  onCancelar,
  onSalvar,
  onExcluir,
  onFavoritar,
  onRegistrarAcesso,
  onIrParaGrupo,
  onAnexar,
  onRemoverAnexo,
  onBaixarAnexo,
  onArvoreAtualizada,
}: {
  entrada: EntradaSenha | null;
  todas: EntradaSenha[];
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onSalvar: (campos: CamposEntrada, favicon?: FaviconEntrada) => Promise<void>;
  onExcluir: () => void;
  onFavoritar: (id: string, favorita: boolean) => void;
  onRegistrarAcesso: (id: string) => void;
  onIrParaGrupo: (id: string) => void;
  onAnexar: (arquivo: File) => Promise<void>;
  onRemoverAnexo: (nome: string) => Promise<void>;
  onBaixarAnexo: (nome: string) => Promise<void>;
  /** Aplica uma `RespostaSenhas` (usado pelo histórico, que troca a árvore ao restaurar uma versão). */
  onArvoreAtualizada: (resposta: RespostaSenhas) => boolean;
}) {
  const [vendoHistorico, definirVendoHistorico] = useState(false);

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
            outras={todas.filter((item) => item.id !== entrada.id)}
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
          <Avatar entrada={entrada} tamanho={40} />
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
                    icone={<History size={14} />}
                    onClick={() => {
                      fechar();
                      definirVendoHistorico(true);
                    }}
                  >
                    Histórico
                  </ItemMenu>
                  <SeparadorMenu />
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

        <AvisosDaEntrada entrada={entrada} todas={todas} />

        <div className="painel mt-4 divide-y divide-linha">
          <CampoDetalhe rotulo="Usuário" valor={entrada.usuario} copiavel />
          <CampoSenhaDetalhe
            senha={entrada.senha}
            aoCopiar={() => onRegistrarAcesso(entrada.id)}
            extra={<SeloForca senha={entrada.senha} />}
          />
          {entrada.otp ? <CampoTotp otp={entrada.otp} /> : null}
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
          {entrada.camposExtras.map((campo) =>
            campo.protegido ? (
              <CampoSenhaDetalhe key={campo.nome} rotulo={campo.nome} senha={campo.valor} />
            ) : (
              <CampoDetalhe key={campo.nome} rotulo={campo.nome} valor={campo.valor} copiavel multilinha />
            ),
          )}
          <CampoDetalhe rotulo="Notas" valor={entrada.notas} multilinha />
          {entrada.expiraEm ? (
            <CampoDetalhe
              rotulo="Validade"
              valor={`${formatarDia(entrada.expiraEm)}${estadoDaValidade(entrada.expiraEm) === "vencida" ? " — vencida" : ""}`}
            />
          ) : null}
        </div>

        <SecaoAnexos entrada={entrada} onAnexar={onAnexar} onRemover={onRemoverAnexo} onBaixar={onBaixarAnexo} />

        <p className="mt-4 text-[11px] text-tinta-3">
          Criada em {formatarDataHora(entrada.criadoEm)} · Alterada em {formatarDataHora(entrada.atualizadoEm)}
          {entrada.acessadoEm ? ` · Usada ${formatarDataCurta(entrada.acessadoEm)}` : ""}
        </p>
      </div>

      {vendoHistorico ? (
        <DialogoHistorico entrada={entrada} aoFechar={() => definirVendoHistorico(false)} onArvoreAtualizada={onArvoreAtualizada} />
      ) : null}
    </div>
  );
}

/** As versões antigas de uma entrada — busca ao abrir, cada uma com "Restaurar esta versão". */
function DialogoHistorico({
  entrada,
  aoFechar,
  onArvoreAtualizada,
}: {
  entrada: EntradaSenha;
  aoFechar: () => void;
  onArvoreAtualizada: (resposta: RespostaSenhas) => boolean;
}) {
  const [estado, definirEstado] = useState<"carregando" | { versoes: VersaoSenha[] } | { erro: string }>("carregando");
  const [restaurando, definirRestaurando] = useState<number | null>(null);
  const [restaurada, definirRestaurada] = useState(false);

  useEffect(() => {
    let cancelado = false;
    acaoObterHistorico(entrada.id).then((resposta) => {
      if (cancelado) return;
      definirEstado(resposta.ok ? { versoes: resposta.versoes } : { erro: resposta.erro });
    });
    return () => {
      cancelado = true;
    };
  }, [entrada.id]);

  async function restaurar(indice: number) {
    definirRestaurando(indice);
    const resposta = await acaoRestaurarVersao(entrada.id, indice);
    definirRestaurando(null);
    if (onArvoreAtualizada(resposta)) definirRestaurada(true);
  }

  return (
    <Dialogo
      titulo="Histórico"
      descricao={`Versões anteriores de "${entrada.titulo}" — cada troca de senha ou edição vira uma aqui.`}
      aberto
      aoFechar={aoFechar}
      largura="max-w-lg"
    >
      {restaurada ? (
        <p className="rounded-lg border border-[color-mix(in_srgb,var(--realce)_35%,transparent)] bg-realce-fraco px-3 py-2 text-[12.5px] text-tinta">
          Versão restaurada — a que estava valendo virou uma entrada de histórico também, então dá para voltar.
        </p>
      ) : null}
      {estado === "carregando" ? (
        <p className="py-6 text-center text-[12.5px] text-tinta-3">Carregando…</p>
      ) : "erro" in estado ? (
        <p className="py-6 text-center text-[12.5px] text-perigo">{estado.erro}</p>
      ) : estado.versoes.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-tinta-3">
          Nenhuma versão anterior ainda — ela aparece aqui na próxima vez que esta entrada for editada.
        </p>
      ) : (
        <ul className="max-h-96 space-y-2 overflow-y-auto">
          {estado.versoes.map((versao) => (
            <li key={versao.indice} className="painel px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11.5px] text-tinta-3">{formatarDataHora(versao.quando)}</p>
                <Botao onClick={() => restaurar(versao.indice)} disabled={restaurando !== null} className="h-7 px-2 text-[11.5px]">
                  {restaurando === versao.indice ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  Restaurar
                </Botao>
              </div>
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[12px]">
                <dt className="text-tinta-3">Título</dt>
                <dd className="truncate text-tinta">{versao.titulo || "—"}</dd>
                <dt className="text-tinta-3">Usuário</dt>
                <dd className="truncate text-tinta">{versao.usuario || "—"}</dd>
                <dt className="text-tinta-3">Site</dt>
                <dd className="truncate text-tinta">{versao.url || "—"}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Dialogo>
  );
}

/** Quantos dias desde uma data ISO. */
function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const LIMITE_DIAS_ANTIGA = 365;

type CategoriaSaude = {
  chave: string;
  titulo: string;
  descricao: string;
  entradas: EntradaSenha[];
};

/**
 * Relatório de saúde: tudo calculado na hora a partir de `todas` — sem
 * ida ao servidor, sem guardar nada. Fracas/repetidas/antigas/sem
 * site/vencidas primeiro; vazamentos (HIBP) é a única parte que sai da
 * máquina, e só quando a pessoa pede.
 */
function DialogoSaude({
  todas,
  aoFechar,
  onIrPara,
}: {
  todas: EntradaSenha[];
  aoFechar: () => void;
  onIrPara: (id: string) => void;
}) {
  const [hibp, definirHibp] = useState<
    "ocioso" | "confirmando" | { verificando: number; total: number } | { resultados: Map<string, number> }
  >("ocioso");

  const categorias = useMemo((): CategoriaSaude[] => {
    const comSenha = todas.filter((entrada) => entrada.senha);
    const porSenha = new Map<string, EntradaSenha[]>();
    for (const entrada of comSenha) porSenha.set(entrada.senha, [...(porSenha.get(entrada.senha) ?? []), entrada]);

    return [
      {
        chave: "fracas",
        titulo: "Senhas fracas",
        descricao: "Fáceis de chutar — curtas, comuns ou sem mistura de caracteres.",
        entradas: comSenha.filter((entrada) => medirForca(entrada.senha).nivel <= 1),
      },
      {
        chave: "repetidas",
        titulo: "Senhas repetidas",
        descricao: "A mesma senha em mais de uma entrada — se uma vazar, as outras vão junto.",
        entradas: [...porSenha.values()].filter((grupo) => grupo.length > 1).flat(),
      },
      {
        chave: "antigas",
        titulo: "Senhas antigas",
        descricao: `Sem trocar há mais de ${LIMITE_DIAS_ANTIGA} dias.`,
        entradas: comSenha.filter((entrada) => diasDesde(entrada.atualizadoEm) > LIMITE_DIAS_ANTIGA),
      },
      {
        chave: "sem-site",
        titulo: "Sem site cadastrado",
        descricao: "Sem URL, o preenchimento automático (e o favicon) não têm como funcionar.",
        entradas: todas.filter((entrada) => !entrada.url),
      },
      {
        chave: "vencidas",
        titulo: "Vencidas",
        descricao: "Passaram da data de validade que você definiu.",
        entradas: todas.filter((entrada) => estadoDaValidade(entrada.expiraEm) === "vencida"),
      },
    ];
  }, [todas]);

  async function verificarVazamentos() {
    const unicas = [...new Map(todas.filter((entrada) => entrada.senha).map((entrada) => [entrada.senha, entrada])).values()];
    const porSenha = new Map<string, number>();
    for (let i = 0; i < unicas.length; i++) {
      definirHibp({ verificando: i + 1, total: unicas.length });
      try {
        porSenha.set(unicas[i].senha, await contarVazamentos(unicas[i].senha));
      } catch {
        // Uma falha de rede não derruba o resto — essa senha some do resultado, o resto segue.
      }
    }
    const resultados = new Map<string, number>();
    for (const entrada of todas) {
      const contagem = porSenha.get(entrada.senha);
      if (contagem) resultados.set(entrada.id, contagem);
    }
    definirHibp({ resultados });
  }

  return (
    <Dialogo
      titulo="Relatório de saúde"
      descricao="Calculado agora, na sua máquina — nada disso fica guardado."
      aberto
      aoFechar={aoFechar}
      largura="max-w-lg"
    >
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        {categorias.map((categoria) => (
          <div key={categoria.chave}>
            <div className="flex items-center gap-2">
              <p className="text-[12.5px] font-semibold text-tinta">{categoria.titulo}</p>
              <span className="rounded-full bg-realce-medio px-1.5 py-0.5 text-[10.5px] font-medium text-tinta tabular-nums">
                {categoria.entradas.length}
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-tinta-3">{categoria.descricao}</p>
            {categoria.entradas.length > 0 ? (
              <ul className="mt-1.5 space-y-0.5">
                {categoria.entradas.map((entrada) => (
                  <li key={entrada.id}>
                    <button
                      type="button"
                      onClick={() => onIrPara(entrada.id)}
                      className="w-full truncate rounded-md px-2 py-1 text-left text-[12px] text-tinta-2 hover:bg-realce-fraco hover:text-tinta"
                    >
                      {entrada.titulo}
                      {entrada.grupoNome ? <span className="text-tinta-3"> · {entrada.grupoNome}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}

        <div className="border-t border-linha pt-3">
          <p className="text-[12.5px] font-semibold text-tinta">Vazamentos conhecidos</p>
          {hibp === "ocioso" ? (
            <>
              <p className="mt-0.5 text-[11.5px] text-tinta-3">
                Confere cada senha contra vazamentos públicos, por k-anonimato: só os 5 primeiros caracteres do hash
                saem da máquina — a senha em si, nunca. Ainda assim é uma consulta na internet; só roda se você pedir.
              </p>
              <Botao onClick={() => definirHibp("confirmando")} className="mt-2">
                <ShieldAlert size={13} />
                Verificar vazamentos
              </Botao>
            </>
          ) : hibp === "confirmando" ? (
            <div className="mt-2 flex items-center gap-2">
              <Botao variante="primario" onClick={verificarVazamentos}>
                Confirmar e verificar
              </Botao>
              <Botao onClick={() => definirHibp("ocioso")}>Cancelar</Botao>
            </div>
          ) : "verificando" in hibp ? (
            <p className="mt-1.5 flex items-center gap-2 text-[12px] text-tinta-3">
              <Loader2 size={13} className="animate-spin" />
              Verificando {hibp.verificando} de {hibp.total}…
            </p>
          ) : hibp.resultados.size === 0 ? (
            <p className="mt-1.5 text-[12px] text-tinta-3">Nenhuma das suas senhas apareceu em vazamentos conhecidos.</p>
          ) : (
            <ul className="mt-1.5 space-y-0.5">
              {todas
                .filter((entrada) => hibp.resultados.has(entrada.id))
                .map((entrada) => (
                  <li key={entrada.id}>
                    <button
                      type="button"
                      onClick={() => onIrPara(entrada.id)}
                      className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[12px] text-tinta hover:bg-realce-fraco"
                    >
                      <AlertTriangle size={12} className="shrink-0 text-perigo" />
                      <span className="truncate">{entrada.titulo}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-tinta-3">
                        {hibp.resultados.get(entrada.id)!.toLocaleString("pt-BR")}×
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </Dialogo>
  );
}

/** Preferências do cofre: trava por inatividade e trancar ao fechar a aba. */
function DialogoConfigCofre({ aoFechar }: { aoFechar: () => void }) {
  const [config, definirConfig] = useState<ConfigSenhas | null>(null);
  const [salvando, definirSalvando] = useState(false);

  useEffect(() => {
    acaoObterConfig().then(definirConfig);
  }, []);

  async function aplicar(mudanca: Partial<ConfigSenhas>) {
    if (!config) return;
    definirConfig({ ...config, ...mudanca });
    definirSalvando(true);
    await acaoDefinirConfig(mudanca);
    definirSalvando(false);
  }

  return (
    <Dialogo titulo="Trava e privacidade" aberto aoFechar={aoFechar} largura="max-w-md">
      {!config ? (
        <p className="py-6 text-center text-[12.5px] text-tinta-3">Carregando…</p>
      ) : (
        <div className="space-y-4">
          <div>
            <Rotulo>Trancar sozinho depois de</Rotulo>
            <div className="flex gap-1.5">
              {[5, 15, 30, null].map((minutos) => (
                <button
                  key={String(minutos)}
                  type="button"
                  onClick={() => aplicar({ minutosTrava: minutos })}
                  aria-pressed={config.minutosTrava === minutos}
                  className={clsx(
                    "h-8.5 flex-1 rounded-lg border text-[12.5px] font-medium transition-colors",
                    config.minutosTrava === minutos
                      ? "border-[var(--realce)] bg-realce-medio text-tinta"
                      : "border-linha text-tinta-2 hover:bg-realce-fraco",
                  )}
                >
                  {minutos === null ? "Nunca" : `${minutos} min`}
                </button>
              ))}
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] text-tinta-2">
            <input
              type="checkbox"
              checked={config.trancarAoFechar}
              onChange={(evento) => aplicar({ trancarAoFechar: evento.target.checked })}
              className="mt-0.5 accent-[var(--realce)]"
            />
            <span>
              Trancar ao fechar a aba
              <span className="block text-[11px] text-tinta-3">Além do tempo de inatividade acima.</span>
            </span>
          </label>
          {salvando ? <p className="text-[11px] text-tinta-3">Salvando…</p> : null}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Botao onClick={aoFechar}>Fechar</Botao>
      </div>
    </Dialogo>
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

/** Alertas acima dos campos: senha repetida noutra entrada, validade vencida ou vencendo. */
function AvisosDaEntrada({ entrada, todas }: { entrada: EntradaSenha; todas: EntradaSenha[] }) {
  const repetidas = repetidaEm(entrada.senha, todas, entrada.id);
  const validade = estadoDaValidade(entrada.expiraEm);
  if (repetidas.length === 0 && !validade) return null;
  return (
    <div className="mt-4 space-y-1.5">
      {repetidas.length > 0 ? (
        <p className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,#F5822C_35%,transparent)] bg-[color-mix(in_srgb,#F5822C_10%,transparent)] px-3 py-2 text-[12px] text-tinta">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[#F5822C]" />
          <span>
            Esta senha também está em{" "}
            <strong>{repetidas.map((item) => item.titulo).join(", ")}</strong>. Se uma vazar, as outras vão junto.
          </span>
        </p>
      ) : null}
      {validade ? (
        <p
          className={clsx(
            "flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] text-tinta",
            validade === "vencida"
              ? "border-[color-mix(in_srgb,var(--perigo)_35%,transparent)] bg-[color-mix(in_srgb,var(--perigo)_10%,transparent)]"
              : "border-[color-mix(in_srgb,#F5822C_35%,transparent)] bg-[color-mix(in_srgb,#F5822C_10%,transparent)]",
          )}
        >
          <AlertTriangle size={13} className={clsx("mt-0.5 shrink-0", validade === "vencida" ? "text-perigo" : "text-[#F5822C]")} />
          <span>
            {validade === "vencida" ? "A validade desta senha passou" : "Esta senha vence"} em{" "}
            <strong>{formatarDia(entrada.expiraEm!)}</strong> — hora de trocar.
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Os arquivos guardados dentro da entrada, com anexar, baixar e remover. */
function SecaoAnexos({
  entrada,
  onAnexar,
  onRemover,
  onBaixar,
}: {
  entrada: EntradaSenha;
  onAnexar: (arquivo: File) => Promise<void>;
  onRemover: (nome: string) => Promise<void>;
  onBaixar: (nome: string) => Promise<void>;
}) {
  const [enviando, definirEnviando] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);

  async function escolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    definirEnviando(true);
    await onAnexar(arquivo);
    definirEnviando(false);
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">
          Anexos{entrada.anexos.length ? ` · ${entrada.anexos.length}` : ""}
        </p>
        <input ref={seletor} type="file" className="hidden" onChange={escolher} />
        <Botao onClick={() => seletor.current?.click()} disabled={enviando} className="h-7 px-2 text-[11.5px]">
          {enviando ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
          Anexar arquivo
        </Botao>
      </div>
      {entrada.anexos.length > 0 ? (
        <ul className="painel mt-2 divide-y divide-linha">
          {entrada.anexos.map((anexo) => (
            <li key={anexo.nome} className="group flex items-center gap-2 px-3 py-2 text-[12.5px]">
              <Paperclip size={12} className="shrink-0 text-tinta-3" />
              <button
                type="button"
                onClick={() => onBaixar(anexo.nome)}
                className="min-w-0 flex-1 truncate text-left text-tinta hover:underline"
                title="Baixar"
              >
                {anexo.nome}
              </button>
              <span className="shrink-0 text-[11px] text-tinta-3 tabular-nums">{formatarTamanho(anexo.tamanho)}</span>
              <BotaoIcone rotulo="Baixar anexo" onClick={() => onBaixar(anexo.nome)} className="size-6 opacity-0 group-hover:opacity-100">
                <Download size={12} />
              </BotaoIcone>
              <BotaoIcone rotulo="Remover anexo" onClick={() => onRemover(anexo.nome)} className="size-6 opacity-0 group-hover:opacity-100">
                <Trash2 size={12} />
              </BotaoIcone>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-[11.5px] text-tinta-3">
          Chaves de recuperação, códigos de backup, um PDF — ficam cifrados dentro do cofre (até 5 MB cada).
        </p>
      )}
    </div>
  );
}

/** A linha da senha (ou de um campo extra protegido): escondida por padrão, olho para revelar, copiar com limpeza. */
/**
 * O código de 6 dígitos do TOTP, com a barrinha de tempo até trocar e um
 * botão de copiar. Recalcula sozinho a cada segundo — o segredo já chegou
 * ao navegador dentro da entrada, então não precisa voltar ao servidor.
 */
function CampoTotp({ otp }: { otp: string }) {
  const config = useMemo(() => interpretarOtp(otp), [otp]);
  const [codigo, definirCodigo] = useState<string | null>(null);
  const [restam, definirRestam] = useState(() => (config ? segundosRestantesTotp(config.periodo) : 0));
  const [copiado, definirCopiado] = useState(false);

  useEffect(() => {
    if (!config) return;
    let cancelado = false;
    async function atualizar() {
      if (!config) return;
      definirRestam(segundosRestantesTotp(config.periodo));
      const novoCodigo = await gerarCodigoTotp(config).catch(() => null);
      if (!cancelado) definirCodigo(novoCodigo);
    }
    atualizar();
    const intervalo = setInterval(atualizar, 1000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [config]);

  async function copiar() {
    if (!codigo) return;
    await navigator.clipboard.writeText(codigo).catch(() => {});
    definirCopiado(true);
    setTimeout(() => definirCopiado(false), 1500);
  }

  if (!config) {
    return (
      <div className="px-4 py-2.5">
        <p className="text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">Verificação em duas etapas</p>
        <p className="mt-0.5 text-[12.5px] text-perigo">O código guardado não é reconhecido — edite a entrada para corrigir.</p>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">Verificação em duas etapas</p>
        <p className="mt-0.5 font-mono text-[17px] tracking-[0.15em] text-tinta tabular-nums">
          {codigo ? `${codigo.slice(0, codigo.length / 2)} ${codigo.slice(codigo.length / 2)}` : "······"}
        </p>
      </div>
      <div
        className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-linha"
        role="progressbar"
        aria-label="Tempo até o código trocar"
        aria-valuenow={restam}
        aria-valuemax={config.periodo}
      >
        <div
          className="h-full rounded-full bg-[var(--realce)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${(restam / config.periodo) * 100}%` }}
        />
      </div>
      <BotaoIcone
        rotulo={copiado ? "Copiado!" : "Copiar código"}
        onClick={copiar}
        className={clsx("size-7 shrink-0", copiado && "text-[var(--realce)]")}
      >
        {copiado ? <Check size={13} /> : <Copy size={13} />}
      </BotaoIcone>
    </div>
  );
}

function CampoSenhaDetalhe({
  senha,
  rotulo = "Senha",
  aoCopiar,
  extra,
}: {
  senha: string;
  rotulo?: string;
  aoCopiar?: () => void;
  extra?: React.ReactNode;
}) {
  const [visivel, definirVisivel] = useState(false);
  const [copiado, definirCopiado] = useState(false);
  const limpar = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (limpar.current) clearTimeout(limpar.current);
  }, []);

  async function copiar() {
    await copiarComLimpeza(senha);
    aoCopiar?.();
    definirCopiado(true);
    if (limpar.current) clearTimeout(limpar.current);
    limpar.current = setTimeout(() => definirCopiado(false), ESPERA_LIMPAR_AREA_DE_TRANSFERENCIA);
  }

  return (
    <div className="group flex items-start gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">
          {rotulo}
          {extra}
        </p>
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
            rotulo={copiado ? "Copiado!" : `Copiar ${rotulo.toLowerCase()}`}
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
  outras,
  aoCancelar,
  aoSalvar,
  rodapeEsquerdo,
  rotuloSalvar = "Salvar",
}: {
  inicial: CamposEntrada | null;
  /** As demais entradas do cofre — para avisar "esta senha já está em X" enquanto se digita. */
  outras: EntradaSenha[];
  aoCancelar: () => void;
  aoSalvar: (campos: CamposEntrada, favicon?: FaviconEntrada) => Promise<void>;
  rodapeEsquerdo?: React.ReactNode;
  rotuloSalvar?: string;
}) {
  const [campos, definirCampos] = useState<CamposEntrada>({
    titulo: inicial?.titulo ?? "",
    usuario: inicial?.usuario ?? "",
    senha: inicial?.senha ?? "",
    url: inicial?.url ?? "",
    notas: inicial?.notas ?? "",
    expiraEm: inicial?.expiraEm ?? null,
    otp: inicial?.otp ?? null,
    camposExtras: inicial?.camposExtras ?? [],
  });
  const [mostrarSenha, definirMostrarSenha] = useState(!inicial);
  const [gerando, definirGerando] = useState(false);
  const [comValidade, definirComValidade] = useState(!!inicial?.expiraEm);
  const [comOtp, definirComOtp] = useState(!!inicial?.otp);
  const [salvando, definirSalvando] = useState(false);
  const [buscandoFavicon, definirBuscandoFavicon] = useState(false);
  // `undefined` = não mexeu no favicon (mantém o que já tinha, se houver);
  // `null`/objeto = já tentou buscar (com ou sem sucesso) — ver DialogoLink em links.tsx, mesmo padrão.
  const [favicon, definirFavicon] = useState<FaviconEntrada>(undefined);
  const urlOriginal = useRef(inicial?.url ?? "");
  const repetidas = repetidaEm(campos.senha, outras, null);

  function alterarExtra(indice: number, mudanca: Partial<CampoExtraSenha>) {
    definirCampos((atual) => ({
      ...atual,
      camposExtras: atual.camposExtras.map((campo, i) => (i === indice ? { ...campo, ...mudanca } : campo)),
    }));
  }

  async function buscarFavicon() {
    const url = campos.url.trim();
    if (!url || url === urlOriginal.current) return;
    definirBuscandoFavicon(true);
    const resultado = await acaoBuscarMetadadosUrl(url);
    definirBuscandoFavicon(false);
    definirFavicon(resultado.favicon);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    definirSalvando(true);
    await aoSalvar(campos, favicon);
    definirSalvando(false);
  }

  return (
    <form
      onSubmit={enviar}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") {
          evento.preventDefault();
          if (gerando) definirGerando(false);
          else aoCancelar();
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
        <div className="flex gap-1.5">
          <div className="relative flex-1">
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
          <Botao
            type="button"
            onClick={() => definirGerando((valor) => !valor)}
            aria-pressed={gerando}
            className={clsx("h-9.5", gerando && "bg-realce-medio")}
          >
            <Wand2 size={13} />
            Gerar
          </Botao>
        </div>
        <BarraForca senha={campos.senha} className="mt-1.5" />
        {repetidas.length > 0 ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-[#F5822C]">
            <AlertTriangle size={12} />
            Já usada em {repetidas.map((item) => item.titulo).join(", ")}.
          </p>
        ) : null}
        {gerando ? (
          <GeradorSenha
            aoFechar={() => definirGerando(false)}
            aoUsar={(senha) => {
              definirCampos((atual) => ({ ...atual, senha }));
              definirMostrarSenha(true);
              definirGerando(false);
            }}
          />
        ) : null}
      </div>
      <div>
        <Rotulo>Site</Rotulo>
        <Campo
          value={campos.url}
          onChange={(evento) => definirCampos({ ...campos, url: evento.target.value })}
          onBlur={buscarFavicon}
          placeholder="https://…"
        />
        {buscandoFavicon ? <p className="mt-1 text-[11px] text-tinta-3">Buscando ícone do site…</p> : null}
      </div>
      <div>
        <label className="mb-1 flex cursor-pointer items-center gap-2 text-[11px] font-medium tracking-wide text-tinta-2 uppercase">
          <input
            type="checkbox"
            checked={comOtp}
            onChange={(evento) => {
              definirComOtp(evento.target.checked);
              if (!evento.target.checked) definirCampos((atual) => ({ ...atual, otp: null }));
            }}
            className="accent-[var(--realce)]"
          />
          Verificação em duas etapas (TOTP)
        </label>
        {comOtp ? (
          <>
            <Campo
              value={campos.otp ?? ""}
              onChange={(evento) => definirCampos({ ...campos, otp: evento.target.value || null })}
              placeholder="Segredo Base32 ou otpauth://…"
              className="font-mono"
            />
            {campos.otp ? (
              interpretarOtp(campos.otp) ? (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-tinta-3">
                  <ScanLine size={12} />
                  Reconhecido — o código vai aparecer junto com a senha.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-perigo">
                  Não reconheci esse formato — cole o segredo (letras e números) ou a URI otpauth:// inteira.
                </p>
              )
            ) : null}
          </>
        ) : null}
      </div>
      {campos.camposExtras.length > 0 ? (
        <div className="space-y-2">
          <Rotulo>Campos extras</Rotulo>
          {campos.camposExtras.map((campo, indice) => (
            <div key={indice} className="flex items-center gap-1.5">
              <Campo
                value={campo.nome}
                onChange={(evento) => alterarExtra(indice, { nome: evento.target.value })}
                placeholder="Nome (PIN, pergunta…)"
                aria-label="Nome do campo"
                className="h-8.5 w-2/5 text-[12.5px]"
              />
              <Campo
                type={campo.protegido ? "password" : "text"}
                value={campo.valor}
                onChange={(evento) => alterarExtra(indice, { valor: evento.target.value })}
                placeholder="Valor"
                aria-label={`Valor de ${campo.nome || "campo"}`}
                className="h-8.5 flex-1 text-[12.5px]"
              />
              <BotaoIcone
                rotulo={campo.protegido ? "Protegido — clique para deixar visível" : "Visível — clique para proteger"}
                onClick={() => alterarExtra(indice, { protegido: !campo.protegido })}
                aria-pressed={campo.protegido}
                className={clsx("size-8", campo.protegido && "text-[var(--realce)]")}
              >
                <ShieldCheck size={14} />
              </BotaoIcone>
              <BotaoIcone
                rotulo="Tirar campo"
                onClick={() =>
                  definirCampos((atual) => ({
                    ...atual,
                    camposExtras: atual.camposExtras.filter((_, i) => i !== indice),
                  }))
                }
                className="size-8"
              >
                <X size={14} />
              </BotaoIcone>
            </div>
          ))}
        </div>
      ) : null}
      <div>
        <Rotulo>Notas</Rotulo>
        <textarea
          value={campos.notas}
          onChange={(evento) => definirCampos({ ...campos, notas: evento.target.value })}
          rows={3}
          className="w-full resize-none rounded-lg border border-linha bg-superficie-alta px-3 py-2 text-[13px] text-tinta transition-shadow placeholder:text-tinta-3 focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-tinta-2">
        <button
          type="button"
          onClick={() =>
            definirCampos((atual) => ({
              ...atual,
              camposExtras: [...atual.camposExtras, { nome: "", valor: "", protegido: false }],
            }))
          }
          className="inline-flex items-center gap-1 hover:text-tinta"
        >
          <Plus size={12} />
          Campo extra
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={comValidade}
            onChange={(evento) => {
              definirComValidade(evento.target.checked);
              if (!evento.target.checked) definirCampos((atual) => ({ ...atual, expiraEm: null }));
            }}
            className="accent-[var(--realce)]"
          />
          Tem validade
        </label>
        {comValidade ? (
          <input
            type="date"
            value={campos.expiraEm ?? ""}
            onChange={(evento) => definirCampos({ ...campos, expiraEm: evento.target.value || null })}
            aria-label="Válida até"
            className="h-8 rounded-lg border border-linha bg-superficie-alta px-2 text-[12.5px] text-tinta focus:border-[var(--realce)] focus:outline-none"
          />
        ) : null}
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
  todas,
  aoFechar,
  aoSalvar,
}: {
  grupo: GrupoSenhas;
  todas: EntradaSenha[];
  aoFechar: () => void;
  aoSalvar: (campos: CamposEntrada, favicon?: FaviconEntrada) => Promise<void>;
}) {
  return (
    <Dialogo titulo="Nova senha" descricao={`Vai para o grupo “${grupo.nome || "Cofre"}”.`} aberto aoFechar={aoFechar} largura="max-w-lg">
      <FormularioEntrada inicial={null} outras={todas} aoCancelar={aoFechar} aoSalvar={aoSalvar} rotuloSalvar="Guardar" />
    </Dialogo>
  );
}
