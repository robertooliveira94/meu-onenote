"use client";

import { KeySquare, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { acaoTrocarSenhaMestra } from "@/app/acoes-senhas";
import type { EntradaSenha, GrupoSenhas } from "@/lib/tipos";

import { Botao, Campo, Dialogo, Rotulo } from "./ui";

/**
 * O que a tela do cofre (`cofre-senhas.tsx`) e a tela de entrada
 * (`senhas.tsx`) compartilham: copiar com limpeza da área de transferência,
 * os diálogos de confirmação e os utilitários de download.
 */
/** Quanto tempo a senha copiada fica na área de transferência antes de ser apagada sozinha. */
export const ESPERA_LIMPAR_AREA_DE_TRANSFERENCIA = 20_000;

/** Copia e agenda a limpeza sozinha da área de transferência — usado tanto no atalho da lista quanto no editor da senha. */
export function copiarComLimpeza(texto: string): Promise<void> {
  return navigator.clipboard
    .writeText(texto)
    .then(() => {
      setTimeout(() => {
        navigator.clipboard.writeText("").catch(() => {});
      }, ESPERA_LIMPAR_AREA_DE_TRANSFERENCIA);
    })
    .catch(() => {
      // Sem permissão de área de transferência: nada a fazer além de deixar
      // a pessoa selecionar e copiar o campo na mão.
    });
}

export function encontrarGrupo(raiz: GrupoSenhas, id: string): GrupoSenhas | null {
  if (raiz.id === id) return raiz;
  for (const sub of raiz.grupos) {
    const achado = encontrarGrupo(sub, id);
    if (achado) return achado;
  }
  return null;
}

export function DialogoTrocarSenha({ aoFechar }: { aoFechar: () => void }) {
  const [senhaAtual, definirSenhaAtual] = useState("");
  const [senhaNova, definirSenhaNova] = useState("");
  const [confirmacao, definirConfirmacao] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [enviando, definirEnviando] = useState(false);
  const [sucesso, definirSucesso] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (senhaNova !== confirmacao) {
      definirErro("As duas senhas novas digitadas não são iguais.");
      return;
    }
    definirEnviando(true);
    definirErro(null);
    const resposta = await acaoTrocarSenhaMestra(senhaAtual, senhaNova);
    definirEnviando(false);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    definirSucesso(true);
  }

  if (sucesso) {
    return (
      <Dialogo titulo="Senha mestra trocada" aberto aoFechar={aoFechar}>
        <p className="text-[13px] leading-relaxed text-tinta-2">
          A partir de agora, é a nova senha que destranca o cofre — a antiga não vale mais.
        </p>
        <div className="mt-4 flex justify-end">
          <Botao variante="primario" onClick={aoFechar}>
            Entendi
          </Botao>
        </div>
      </Dialogo>
    );
  }

  return (
    <Dialogo
      titulo="Trocar senha mestra"
      descricao="O conteúdo do cofre é mantido — só a senha que abre ele muda."
      aberto
      aoFechar={aoFechar}
    >
      <form onSubmit={enviar} className="space-y-3">
        <div>
          <Rotulo>Senha mestra atual</Rotulo>
          <Campo
            type="password"
            autoFocus
            value={senhaAtual}
            onChange={(evento) => definirSenhaAtual(evento.target.value)}
          />
        </div>
        <div>
          <Rotulo>Nova senha mestra</Rotulo>
          <Campo type="password" value={senhaNova} onChange={(evento) => definirSenhaNova(evento.target.value)} />
        </div>
        <div>
          <Rotulo>Confirme a nova senha mestra</Rotulo>
          <Campo
            type="password"
            value={confirmacao}
            onChange={(evento) => definirConfirmacao(evento.target.value)}
          />
        </div>

        {erro ? <p className="text-[12.5px] text-perigo">{erro}</p> : null}

        <div className="flex justify-end gap-2 pt-1">
          <Botao type="button" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            type="submit"
            variante="primario"
            disabled={enviando || !senhaAtual || !senhaNova}
          >
            {enviando ? <Loader2 size={13} className="animate-spin" /> : <KeySquare size={13} />}
            Trocar
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

export function DialogoNovoGrupo({
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

export function DialogoExcluirGrupo({
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

export function DialogoExcluirEntrada({
  entrada,
  aoFechar,
  aoConfirmar,
}: {
  entrada: EntradaSenha;
  aoFechar: () => void;
  aoConfirmar: () => Promise<void>;
}) {
  return (
    <Dialogo titulo={`Excluir "${entrada.titulo}"?`} aberto aoFechar={aoFechar}>
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

export const PALAVRA_CONFIRMACAO = "excluir";

export function DialogoExcluirCofre({
  aoFechar,
  aoConfirmar,
}: {
  aoFechar: () => void;
  aoConfirmar: () => Promise<void>;
}) {
  const [confirmacao, definirConfirmacao] = useState("");
  const [excluindo, definirExcluindo] = useState(false);
  const liberado = confirmacao.trim().toLowerCase() === PALAVRA_CONFIRMACAO;

  async function confirmar() {
    definirExcluindo(true);
    await aoConfirmar();
  }

  return (
    <Dialogo
      titulo="Excluir o cofre inteiro?"
      descricao="Todas as senhas guardadas são apagadas para sempre — sem lixeira, sem desfazer. Se você tem uma cópia baixada do .kdbx, ela continua valendo; qualquer outra coisa se perde."
      aberto
      aoFechar={aoFechar}
    >
      <Rotulo>
        Digite <span className="font-mono text-tinta">{PALAVRA_CONFIRMACAO}</span> para confirmar
      </Rotulo>
      <Campo
        autoFocus
        value={confirmacao}
        onChange={(evento) => definirConfirmacao(evento.target.value)}
        placeholder={PALAVRA_CONFIRMACAO}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Botao onClick={aoFechar}>Cancelar</Botao>
        <Botao variante="perigo-solido" disabled={!liberado || excluindo} onClick={confirmar}>
          {excluindo ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Excluir cofre
        </Botao>
      </div>
    </Dialogo>
  );
}

export function base64ParaBytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

export function baixarArquivo(dados: Uint8Array | string, nome: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([dados as BlobPart], { type: tipo }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}
