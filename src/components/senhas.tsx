"use client";

import clsx from "clsx";
import { Download, Eye, EyeOff, Loader2, Lock, ShieldAlert, Unlock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { acaoCriarCofre, acaoDestrancar, acaoImportarCofre, acaoObterArvore, acaoStatusCofre } from "@/app/acoes-senhas";
import type { GrupoSenhas } from "@/lib/tipos";

import { CofreAberto } from "./cofre-senhas";
import { BotaoComoFunciona } from "./explicador-criptografia";
import { Botao, Campo, Rotulo } from "./ui";

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

  return (
    <CofreAberto arvoreInicial={tela.arvore} aoTrancar={() => definirTela("trancado")} aoExcluirCofre={carregar} />
  );
}

function lerArquivoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

function TelaTranca({
  modo,
  aoEntrar,
}: {
  modo: "criar" | "destrancar";
  aoEntrar: (arvore: GrupoSenhas) => void;
}) {
  const [aba, definirAba] = useState<"criar" | "importar">("criar");
  const [senha, definirSenha] = useState("");
  const [confirmacao, definirConfirmacao] = useState("");
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [mostrarSenha, definirMostrarSenha] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [enviando, definirEnviando] = useState(false);

  const importando = modo === "criar" && aba === "importar";

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (modo === "criar" && aba === "criar" && senha !== confirmacao) {
      definirErro("As duas senhas digitadas não são iguais.");
      return;
    }
    if (importando && !arquivo) {
      definirErro("Escolha o arquivo .kdbx.");
      return;
    }
    definirEnviando(true);
    definirErro(null);
    const resposta = importando
      ? await acaoImportarCofre(await lerArquivoBase64(arquivo as File), senha)
      : modo === "criar"
        ? await acaoCriarCofre(senha)
        : await acaoDestrancar(senha);
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
            {modo === "destrancar"
              ? "Digite a senha mestra para destrancar."
              : importando
                ? "Escolha um .kdbx que você já tem (do KeePass ou uma cópia baixada daqui) e a senha mestra dele."
                : "Escolha uma senha mestra. Ela nunca fica salva em lugar nenhum — sem ela, ninguém recupera o conteúdo, nem você."}
          </p>
        </div>

        {modo === "criar" ? (
          <div className="mb-4 flex gap-1.5">
            {(
              [
                ["criar", "Criar novo"],
                ["importar", "Já tenho um .kdbx"],
              ] as const
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => {
                  definirAba(valor);
                  definirErro(null);
                }}
                className={clsx(
                  "flex-1 rounded-md border px-2 py-1.5 text-[12px] transition-colors",
                  aba === valor
                    ? "border-[var(--realce)] bg-realce-fraco text-tinta"
                    : "border-linha text-tinta-2 hover:border-linha-forte",
                )}
              >
                {rotulo}
              </button>
            ))}
          </div>
        ) : null}

        {importando ? (
          <div className="mb-3">
            <Rotulo>Arquivo do cofre</Rotulo>
            <input
              type="file"
              accept=".kdbx"
              onChange={(evento) => definirArquivo(evento.target.files?.[0] ?? null)}
              className="block w-full text-[12.5px] text-tinta-2 file:mr-3 file:rounded-md file:border file:border-linha file:bg-superficie-alta file:px-2.5 file:py-1 file:text-[12px] file:text-tinta hover:file:bg-papel"
            />
          </div>
        ) : null}

        <Rotulo>Senha mestra</Rotulo>
        <div className="relative">
          <Campo
            type={mostrarSenha ? "text" : "password"}
            autoFocus
            value={senha}
            onChange={(evento) => definirSenha(evento.target.value)}
            placeholder="••••••••"
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

        {modo === "criar" && aba === "criar" ? (
          <div className="mt-3">
            <Rotulo>Confirme a senha mestra</Rotulo>
            <Campo
              type={mostrarSenha ? "text" : "password"}
              value={confirmacao}
              onChange={(evento) => definirConfirmacao(evento.target.value)}
              placeholder="••••••••"
            />
          </div>
        ) : null}

        {erro ? <p className="mt-2 text-[12.5px] text-perigo">{erro}</p> : null}

        <Botao
          type="submit"
          variante="primario"
          disabled={enviando || !senha || (importando && !arquivo)}
          className="mt-4 w-full justify-center"
        >
          {enviando ? (
            <Loader2 size={13} className="animate-spin" />
          ) : importando ? (
            <Download size={13} />
          ) : modo === "criar" ? (
            <ShieldAlert size={13} />
          ) : (
            <Unlock size={13} />
          )}
          {importando ? "Importar cofre" : modo === "criar" ? "Criar cofre" : "Destrancar"}
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
