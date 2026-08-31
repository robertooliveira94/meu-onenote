"use client";

import clsx from "clsx";
import { Check, CornerDownRight, Folder } from "lucide-react";
import { useEffect, useState } from "react";

import type { NoArvore } from "@/lib/tipos";

import { Aviso, Botao, Campo, Dialogo, Rotulo } from "./ui";

/** Diálogos usados pela árvore e pela lista de páginas. */

/** Pede um nome — serve para criar caderno, criar seção e renomear. */
export function DialogoNome({
  aberto,
  titulo,
  descricao,
  rotulo,
  valorInicial = "",
  textoBotao,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  rotulo: string;
  valorInicial?: string;
  textoBotao: string;
  aoConfirmar: (nome: string) => Promise<string | null>;
  aoFechar: () => void;
}) {
  const [valor, definirValor] = useState(valorInicial);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  useEffect(() => {
    if (aberto) {
      definirValor(valorInicial);
      definirErro(null);
    }
  }, [aberto, valorInicial]);

  async function confirmar() {
    if (!valor.trim()) {
      definirErro("Dê um nome antes de continuar");
      return;
    }
    definirSalvando(true);
    const falha = await aoConfirmar(valor.trim());
    definirSalvando(false);
    if (falha) definirErro(falha);
    else aoFechar();
  }

  return (
    <Dialogo titulo={titulo} descricao={descricao} aberto={aberto} aoFechar={aoFechar}>
      {/* Formulário de verdade: o Enter confirma sem precisar de atalho manual. */}
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          confirmar();
        }}
      >
        <label className="block">
          <Rotulo>{rotulo}</Rotulo>
          <Campo value={valor} autoFocus onChange={(evento) => definirValor(evento.target.value)} />
        </label>
        <Aviso>{erro}</Aviso>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="sutil" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario" disabled={salvando}>
            {textoBotao}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/** Confirmação para ações que mexem em várias coisas de uma vez. */
export function DialogoConfirmar({
  aberto,
  titulo,
  descricao,
  textoBotao,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  textoBotao: string;
  aoConfirmar: () => Promise<string | null>;
  aoFechar: () => void;
}) {
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);

  return (
    <Dialogo titulo={titulo} descricao={descricao} aberto={aberto} aoFechar={aoFechar}>
      <Aviso>{erro}</Aviso>
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="sutil" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao
          variante="perigo-solido"
          disabled={ocupado}
          onClick={async () => {
            definirOcupado(true);
            const falha = await aoConfirmar();
            definirOcupado(false);
            if (falha) definirErro(falha);
            else aoFechar();
          }}
        >
          {textoBotao}
        </Botao>
      </div>
    </Dialogo>
  );
}

/** Lista achatada de pastas, para escolher um destino. */
function achatar(nos: NoArvore[], nivel = 0): { caminho: string; nome: string; nivel: number }[] {
  return nos.flatMap((no) => [
    { caminho: no.caminho, nome: no.nome, nivel },
    ...achatar(no.filhos, nivel + 1),
  ]);
}

export function DialogoMover({
  aberto,
  cadernos,
  caminhoAtual,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean;
  cadernos: NoArvore[];
  caminhoAtual: string;
  aoConfirmar: (destino: string) => Promise<string | null>;
  aoFechar: () => void;
}) {
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);

  // Não dá para mover um item para dentro de si mesmo.
  const destinos = achatar(cadernos).filter(
    (pasta) => pasta.caminho !== caminhoAtual && !pasta.caminho.startsWith(`${caminhoAtual}/`),
  );

  async function escolher(destino: string) {
    definirOcupado(true);
    const falha = await aoConfirmar(destino);
    definirOcupado(false);
    if (falha) definirErro(falha);
    else aoFechar();
  }

  return (
    <Dialogo
      titulo="Mover para"
      descricao="Escolha a seção que vai receber este item."
      aberto={aberto}
      aoFechar={aoFechar}
    >
      <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-linha bg-superficie-alta p-1">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => escolher("")}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-realce-fraco"
        >
          <Folder size={14} className="text-tinta-3" />
          Nível principal (vira um caderno)
        </button>
        {destinos.map((pasta) => (
          <button
            key={pasta.caminho}
            type="button"
            disabled={ocupado}
            onClick={() => escolher(pasta.caminho)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-realce-fraco"
            style={{ paddingLeft: `${8 + pasta.nivel * 14}px` }}
          >
            {pasta.nivel > 0 ? (
              <CornerDownRight size={13} className="text-tinta-3" />
            ) : (
              <Folder size={14} className="text-tinta-3" />
            )}
            <span className="truncate">{pasta.nome}</span>
          </button>
        ))}
      </div>
      <Aviso>{erro}</Aviso>
    </Dialogo>
  );
}

/** Escolha do emoji que representa o caderno na barra lateral. */
export function DialogoIcone({
  aberto,
  icones,
  iconeAtual,
  aoEscolher,
  aoFechar,
}: {
  aberto: boolean;
  icones: string[];
  iconeAtual: string;
  aoEscolher: (icone: string) => Promise<string | null>;
  aoFechar: () => void;
}) {
  const [erro, definirErro] = useState<string | null>(null);

  return (
    <Dialogo
      titulo="Ícone do caderno"
      descricao="Aparece na barra lateral e na trilha de cada página."
      aberto={aberto}
      aoFechar={aoFechar}
    >
      <div className="grid grid-cols-8 gap-1">
        {icones.map((icone) => (
          <button
            key={icone}
            type="button"
            aria-label={`Usar o ícone ${icone}`}
            onClick={async () => {
              const falha = await aoEscolher(icone);
              if (falha) definirErro(falha);
              else aoFechar();
            }}
            className={clsx(
              "flex aspect-square items-center justify-center rounded-lg text-[19px] transition-colors",
              icone === iconeAtual ? "bg-realce-medio" : "hover:bg-realce-fraco",
            )}
          >
            {icone}
          </button>
        ))}
      </div>
      <Aviso>{erro}</Aviso>
    </Dialogo>
  );
}

/** Escolha da cor da lombada do caderno. */
export function DialogoCor({
  aberto,
  cores,
  corAtual,
  aoEscolher,
  aoFechar,
}: {
  aberto: boolean;
  cores: string[];
  corAtual: string;
  aoEscolher: (cor: string) => Promise<string | null>;
  aoFechar: () => void;
}) {
  const [erro, definirErro] = useState<string | null>(null);

  return (
    <Dialogo
      titulo="Cor do caderno"
      descricao="A cor acompanha o caderno pela interface inteira, até a margem da página."
      aberto={aberto}
      aoFechar={aoFechar}
      largura="max-w-xs"
    >
      <div className="flex flex-wrap gap-2">
        {cores.map((cor) => (
          <button
            key={cor}
            type="button"
            aria-label={`Usar a cor ${cor}`}
            onClick={async () => {
              const falha = await aoEscolher(cor);
              if (falha) definirErro(falha);
              else aoFechar();
            }}
            className={clsx(
              "flex size-9 items-center justify-center rounded-lg border-2 transition-transform hover:scale-105",
              cor === corAtual ? "border-tinta" : "border-transparent",
            )}
            style={{ background: cor }}
          >
            {cor === corAtual ? <Check size={15} className="text-white" /> : null}
          </button>
        ))}
      </div>
      <Aviso>{erro}</Aviso>
    </Dialogo>
  );
}
