"use client";

import clsx from "clsx";
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileDown,
  Folder,
  FolderPlus,
  KeyRound,
  Loader2,
  Lock,
  MoreHorizontal,
  Plus,
  ShieldAlert,
  Trash2,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  acaoAtualizarEntrada,
  acaoBaixarCofre,
  acaoCriarCofre,
  acaoCriarEntrada,
  acaoCriarGrupo,
  acaoDestrancar,
  acaoExcluirEntrada,
  acaoExcluirGrupo,
  acaoExportarCsv,
  acaoMoverEntrada,
  acaoMoverGrupo,
  acaoObterArvore,
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
import type { EntradaSenha, GrupoSenhas } from "@/lib/tipos";

import { BotaoComoFunciona } from "./explicador-criptografia";
import { TituloEditavel } from "./titulo-editavel";
import { Botao, BotaoIcone, Campo, Dialogo, ItemMenu, Menu, Rotulo, SeparadorMenu, Vazio } from "./ui";

/** Quanto tempo a senha copiada fica na área de transferência antes de ser apagada sozinha. */
const ESPERA_LIMPAR_AREA_DE_TRANSFERENCIA = 20_000;
/** De quanto em quanto tempo confere se o cofre ainda está destrancado (o timeout é controlado pelo servidor). */
const INTERVALO_VERIFICAR_TRANCA = 30_000;

type Tela = "carregando" | "sem-cofre" | "trancado" | { arvore: GrupoSenhas };

/** Porta de entrada da aplicação Senhas — decide entre criar, destrancar ou já mostrar o cofre. */
export function AppSenhas() {
  const [tela, definirTela] = useState<Tela>("carregando");

  const carregar = useCallback(async () => {
    const status = await acaoStatusCofre();
    if (!status.existe) {
      definirTela("sem-cofre");
      return;
    }
    if (!status.destrancado) {
      definirTela("trancado");
      return;
    }
    const resposta = await acaoObterArvore();
    definirTela(resposta.ok ? { arvore: resposta.arvore } : "trancado");
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (tela === "carregando") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 size={20} className="animate-spin text-tinta-3" />
      </div>
    );
  }

  if (tela === "sem-cofre") {
    return <TelaTranca modo="criar" aoEntrar={(arvore) => definirTela({ arvore })} />;
  }

  if (tela === "trancado") {
    return <TelaTranca modo="destrancar" aoEntrar={(arvore) => definirTela({ arvore })} />;
  }

  return <CofreAberto arvoreInicial={tela.arvore} aoTrancar={() => definirTela("trancado")} />;
}

function TelaTranca({
  modo,
  aoEntrar,
}: {
  modo: "criar" | "destrancar";
  aoEntrar: (arvore: GrupoSenhas) => void;
}) {
  const [senha, definirSenha] = useState("");
  const [confirmacao, definirConfirmacao] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [enviando, definirEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (modo === "criar" && senha !== confirmacao) {
      definirErro("As duas senhas digitadas não são iguais.");
      return;
    }
    definirEnviando(true);
    definirErro(null);
    const resposta = modo === "criar" ? await acaoCriarCofre(senha) : await acaoDestrancar(senha);
    definirEnviando(false);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    aoEntrar(resposta.arvore);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <form onSubmit={enviar} className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-realce-medio text-[var(--realce)]">
            {modo === "criar" ? <ShieldAlert size={20} /> : <Lock size={20} />}
          </div>
          <h1 className="text-[18px] font-bold tracking-[-0.02em]">
            {modo === "criar" ? "Criar o cofre de senhas" : "Cofre trancado"}
          </h1>
          <p className="mt-1 text-[12.5px] text-tinta-2">
            {modo === "criar"
              ? "Escolha uma senha mestra. Ela nunca fica salva em lugar nenhum — sem ela, ninguém recupera o conteúdo, nem você."
              : "Digite a senha mestra para destrancar."}
          </p>
        </div>

        <Rotulo>Senha mestra</Rotulo>
        <Campo
          type="password"
          autoFocus
          value={senha}
          onChange={(evento) => definirSenha(evento.target.value)}
          placeholder="••••••••"
        />

        {modo === "criar" ? (
          <>
            <div className="mt-3">
              <Rotulo>Confirme a senha mestra</Rotulo>
              <Campo
                type="password"
                value={confirmacao}
                onChange={(evento) => definirConfirmacao(evento.target.value)}
                placeholder="••••••••"
              />
            </div>
          </>
        ) : null}

        {erro ? <p className="mt-2 text-[12.5px] text-perigo">{erro}</p> : null}

        <Botao type="submit" variante="primario" disabled={enviando || !senha} className="mt-4 w-full justify-center">
          {enviando ? <Loader2 size={13} className="animate-spin" /> : modo === "criar" ? <ShieldAlert size={13} /> : <Unlock size={13} />}
          {modo === "criar" ? "Criar cofre" : "Destrancar"}
        </Botao>

        <div className="mt-3 flex items-center justify-center">
          <BotaoComoFuncionaComTexto />
        </div>
      </form>
    </div>
  );
}

function BotaoComoFuncionaComTexto() {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-tinta-3">
      <BotaoComoFunciona className="size-6" />
      <span>Como isso funciona?</span>
    </div>
  );
}

function encontrarGrupo(raiz: GrupoSenhas, id: string): GrupoSenhas | null {
  if (raiz.id === id) return raiz;
  for (const sub of raiz.grupos) {
    const achado = encontrarGrupo(sub, id);
    if (achado) return achado;
  }
  return null;
}

function CofreAberto({
  arvoreInicial,
  aoTrancar,
}: {
  arvoreInicial: GrupoSenhas;
  aoTrancar: () => void;
}) {
  const [arvore, definirArvore] = useState(arvoreInicial);
  const [grupoAtivoId, definirGrupoAtivoId] = useState(arvoreInicial.grupos[0]?.id ?? arvoreInicial.id);
  const [entradaEmEdicao, definirEntradaEmEdicao] = useState<EntradaSenha | "nova" | null>(null);
  const [acaoGrupo, definirAcaoGrupo] = useState<{ tipo: "novo-subgrupo" | "excluir"; grupo: GrupoSenhas } | null>(
    null,
  );

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

  const grupoAtivo = encontrarGrupo(arvore, grupoAtivoId) ?? arvore;

  function aplicarResposta<T extends { ok: true; arvore: GrupoSenhas } | { ok: false; erro: string }>(
    resposta: T,
  ): boolean {
    if (resposta.ok) {
      definirArvore(resposta.arvore);
      return true;
    }
    alert(resposta.erro);
    return false;
  }

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
          grupoAtivoId={grupoAtivoId}
          onSelecionar={definirGrupoAtivoId}
          onCriarSubgrupo={(grupo) => definirAcaoGrupo({ tipo: "novo-subgrupo", grupo })}
          onExcluir={(grupo) => definirAcaoGrupo({ tipo: "excluir", grupo })}
          onMoverGrupo={async (id, idNovoPai) => aplicarResposta(await acaoMoverGrupo(id, idNovoPai))}
          onMoverEntrada={async (id, idNovoGrupo) => aplicarResposta(await acaoMoverEntrada(id, idNovoGrupo))}
        />

        <ColunaEntradas
          grupo={grupoAtivo}
          onAbrir={(entrada) => definirEntradaEmEdicao(entrada)}
          onNova={() => definirEntradaEmEdicao("nova")}
        />
      </div>

      {entradaEmEdicao ? (
        <DialogoEntrada
          entrada={entradaEmEdicao === "nova" ? null : entradaEmEdicao}
          aoFechar={() => definirEntradaEmEdicao(null)}
          aoSalvar={async (id, campos) => {
            const resposta = id ? await acaoAtualizarEntrada(id, campos) : await acaoCriarEntrada(grupoAtivo.id, campos);
            if (aplicarResposta(resposta)) definirEntradaEmEdicao(null);
          }}
          aoExcluir={
            entradaEmEdicao !== "nova"
              ? async () => {
                  if (!confirm(`Excluir "${entradaEmEdicao.titulo}"?`)) return;
                  if (aplicarResposta(await acaoExcluirEntrada(entradaEmEdicao.id))) definirEntradaEmEdicao(null);
                }
              : undefined
          }
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
            if (aplicarResposta(resposta)) {
              definirAcaoGrupo(null);
              if (grupoAtivoId === acaoGrupo.grupo.id) definirGrupoAtivoId(arvore.id);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function ColunaGrupos({
  raiz,
  grupoAtivoId,
  onSelecionar,
  onCriarSubgrupo,
  onExcluir,
  onMoverGrupo,
  onMoverEntrada,
}: {
  raiz: GrupoSenhas;
  grupoAtivoId: string;
  onSelecionar: (id: string) => void;
  onCriarSubgrupo: (grupo: GrupoSenhas) => void;
  onExcluir: (grupo: GrupoSenhas) => void;
  onMoverGrupo: (id: string, idNovoPai: string) => void;
  onMoverEntrada: (id: string, idNovoGrupo: string) => void;
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-linha bg-papel">
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
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
              grupoAtivoId={grupoAtivoId}
              onSelecionar={onSelecionar}
              onCriarSubgrupo={onCriarSubgrupo}
              onExcluir={onExcluir}
              onMoverGrupo={onMoverGrupo}
              onMoverEntrada={onMoverEntrada}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NoGrupo({
  grupo,
  profundidade,
  grupoAtivoId,
  onSelecionar,
  onCriarSubgrupo,
  onExcluir,
  onMoverGrupo,
  onMoverEntrada,
}: {
  grupo: GrupoSenhas;
  profundidade: number;
  grupoAtivoId: string;
  onSelecionar: (id: string) => void;
  onCriarSubgrupo: (grupo: GrupoSenhas) => void;
  onExcluir: (grupo: GrupoSenhas) => void;
  onMoverGrupo: (id: string, idNovoPai: string) => void;
  onMoverEntrada: (id: string, idNovoGrupo: string) => void;
}) {
  const [sobre, definirSobre] = useState(false);
  const ativo = grupo.id === grupoAtivoId;

  return (
    <div>
      <div
        draggable
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
          "group flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-1 text-[12.5px] transition-colors",
          ativo ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
          sobre && "ring-2 ring-[var(--realce)]",
        )}
      >
        <Folder size={13} className="shrink-0 text-tinta-3" />
        <div className="min-w-0 flex-1 truncate">
          <TituloEditavel
            titulo={grupo.nome}
            aoRenomear={async (novoNome) => {
              const resposta = await acaoRenomearGrupo(grupo.id, novoNome);
              return resposta.ok ? null : resposta.erro;
            }}
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
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ColunaEntradas({
  grupo,
  onAbrir,
  onNova,
}: {
  grupo: GrupoSenhas;
  onAbrir: (entrada: EntradaSenha) => void;
  onNova: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-papel">
      <div className="flex items-center justify-between gap-2 px-5 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold tracking-[-0.02em]">{grupo.nome || "Cofre"}</p>
          <p className="text-[11px] text-tinta-3">
            {grupo.entradas.length === 0
              ? "nenhuma senha"
              : `${grupo.entradas.length} ${grupo.entradas.length === 1 ? "senha" : "senhas"}`}
          </p>
        </div>
        <Botao variante="primario" onClick={onNova}>
          <Plus size={13} />
          Nova senha
        </Botao>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
        {grupo.entradas.length === 0 ? (
          <div className="pt-8">
            <Vazio
              icone={<KeyRound size={20} />}
              titulo="Nenhuma senha neste grupo"
              descricao='Clique em "Nova senha" para guardar a primeira aqui.'
            />
          </div>
        ) : (
          grupo.entradas.map((entrada) => (
            <div
              key={entrada.id}
              draggable
              onDragStart={(evento) => iniciarArrastoDeEntradaSenha(evento, entrada.id)}
              onClick={() => onAbrir(entrada)}
              className="cartao flex cursor-pointer items-center gap-3 px-3.5 py-2.5"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-realce-medio text-[var(--realce)]">
                <KeyRound size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-tinta">{entrada.titulo}</p>
                <p className="truncate text-[11.5px] text-tinta-3">{entrada.usuario || "sem usuário"}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type CamposEntrada = { titulo: string; usuario: string; senha: string; url: string; notas: string };

function DialogoEntrada({
  entrada,
  aoFechar,
  aoSalvar,
  aoExcluir,
}: {
  entrada: EntradaSenha | null;
  aoFechar: () => void;
  aoSalvar: (id: string | null, campos: CamposEntrada) => Promise<void>;
  aoExcluir?: () => void;
}) {
  const [campos, definirCampos] = useState<CamposEntrada>({
    titulo: entrada?.titulo ?? "",
    usuario: entrada?.usuario ?? "",
    senha: entrada?.senha ?? "",
    url: entrada?.url ?? "",
    notas: entrada?.notas ?? "",
  });
  const [mostrarSenha, definirMostrarSenha] = useState(!entrada);
  const [salvando, definirSalvando] = useState(false);
  const [copiado, definirCopiado] = useState(false);
  const limparCopia = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (limparCopia.current) clearTimeout(limparCopia.current);
  }, []);

  async function copiarSenha() {
    try {
      await navigator.clipboard.writeText(campos.senha);
      definirCopiado(true);
      if (limparCopia.current) clearTimeout(limparCopia.current);
      limparCopia.current = setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {});
        definirCopiado(false);
      }, ESPERA_LIMPAR_AREA_DE_TRANSFERENCIA);
    } catch {
      // Sem permissão de área de transferência: nada a fazer além de deixar
      // a pessoa selecionar e copiar o campo na mão.
    }
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    definirSalvando(true);
    await aoSalvar(entrada?.id ?? null, campos);
    definirSalvando(false);
  }

  return (
    <Dialogo
      titulo={entrada ? "Editar senha" : "Nova senha"}
      aberto
      aoFechar={aoFechar}
      largura="max-w-lg"
    >
      <form onSubmit={enviar} className="space-y-3">
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
          <Campo
            value={campos.usuario}
            onChange={(evento) => definirCampos({ ...campos, usuario: evento.target.value })}
          />
        </div>
        <div>
          <Rotulo>Senha</Rotulo>
          <div className="flex gap-1.5">
            <div className="relative flex-1">
              <Campo
                type={mostrarSenha ? "text" : "password"}
                value={campos.senha}
                onChange={(evento) => definirCampos({ ...campos, senha: evento.target.value })}
                className="pr-9"
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
            <BotaoIcone
              rotulo={copiado ? "Copiado!" : "Copiar senha"}
              onClick={copiarSenha}
              className={clsx("size-9.5 border border-linha", copiado && "text-[var(--realce)]")}
            >
              <Copy size={14} />
            </BotaoIcone>
          </div>
          {copiado ? (
            <p className="mt-1 text-[11px] text-tinta-3">
              Copiada — vai ser apagada da área de transferência sozinha em 20 segundos.
            </p>
          ) : null}
        </div>
        <div>
          <Rotulo>URL</Rotulo>
          <div className="flex gap-1.5">
            <Campo
              value={campos.url}
              onChange={(evento) => definirCampos({ ...campos, url: evento.target.value })}
              placeholder="https://…"
              className="flex-1"
            />
            {campos.url ? (
              <BotaoIcone
                rotulo="Abrir site"
                onClick={() => window.open(campos.url, "_blank", "noopener,noreferrer")}
                className="size-9.5 border border-linha"
              >
                <ExternalLink size={14} />
              </BotaoIcone>
            ) : null}
          </div>
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
          {aoExcluir ? (
            <Botao type="button" variante="perigo" onClick={aoExcluir}>
              <Trash2 size={13} />
              Excluir
            </Botao>
          ) : null}
          <div className="ml-auto flex gap-2">
            <Botao type="button" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="primario" disabled={salvando || !campos.titulo.trim()}>
              {salvando ? <Loader2 size={13} className="animate-spin" /> : null}
              Salvar
            </Botao>
          </div>
        </div>
      </form>
    </Dialogo>
  );
}

function DialogoNovoGrupo({
  grupoPai,
  aoFechar,
  aoCriar,
}: {
  grupoPai: GrupoSenhas;
  aoFechar: () => void;
  aoCriar: (nome: string) => Promise<void>;
}) {
  const [nome, definirNome] = useState("");
  const [enviando, definirEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    definirEnviando(true);
    await aoCriar(nome);
    definirEnviando(false);
  }

  return (
    <Dialogo
      titulo={grupoPai.nome ? `Novo subgrupo em "${grupoPai.nome}"` : "Novo grupo"}
      aberto
      aoFechar={aoFechar}
    >
      <form onSubmit={enviar}>
        <Rotulo>Nome</Rotulo>
        <Campo autoFocus value={nome} onChange={(evento) => definirNome(evento.target.value)} placeholder="Bancos, trabalho…" />
        <div className="mt-4 flex justify-end gap-2">
          <Botao type="button" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario" disabled={enviando || !nome.trim()}>
            Criar
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

function DialogoExcluirGrupo({
  grupo,
  aoFechar,
  aoConfirmar,
}: {
  grupo: GrupoSenhas;
  aoFechar: () => void;
  aoConfirmar: () => Promise<void>;
}) {
  return (
    <Dialogo
      titulo={`Excluir "${grupo.nome}"?`}
      descricao={
        grupo.entradas.length > 0 || grupo.grupos.length > 0
          ? "As senhas e subgrupos dentro dele vão junto."
          : undefined
      }
      aberto
      aoFechar={aoFechar}
    >
      <div className="flex justify-end gap-2">
        <Botao onClick={aoFechar}>Cancelar</Botao>
        <Botao variante="perigo-solido" onClick={aoConfirmar}>
          <Trash2 size={13} />
          Excluir
        </Botao>
      </div>
    </Dialogo>
  );
}

function base64ParaBytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function baixarArquivo(dados: Uint8Array | string, nome: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([dados as BlobPart], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
