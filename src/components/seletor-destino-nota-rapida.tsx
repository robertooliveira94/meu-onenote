"use client";

import { FolderPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { acaoCriarDestinoNotaRapida } from "@/app/acoes";
import type { Caderno } from "@/lib/tipos";

import { Botao, Campo, Rotulo } from "./ui";

export function SeletorDestinoNotaRapida({
  cadernos,
  destinoInicial,
  aoEscolher,
}: {
  cadernos: Caderno[];
  destinoInicial?: string | null;
  aoEscolher: (destino: string) => Promise<void> | void;
}) {
  const secoes = useMemo(() => cadernos.flatMap((caderno) => caderno.secoes), [cadernos]);
  const [destino, definirDestino] = useState(destinoInicial ?? secoes[0]?.caminho ?? "");
  const [cadernoPai, definirCadernoPai] = useState(cadernos[0]?.caminho ?? "__novo__");
  const [novoCaderno, definirNovoCaderno] = useState("");
  const [novaSecao, definirNovaSecao] = useState("");
  const [ocupado, definirOcupado] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function criarDestino() {
    definirOcupado(true);
    definirErro(null);
    const resposta = await acaoCriarDestinoNotaRapida(
      cadernoPai === "__novo__" ? null : cadernoPai,
      novoCaderno,
      novaSecao,
    );
    definirOcupado(false);
    if (!resposta.ok || !resposta.mensagem) {
      definirErro(resposta.ok ? "Não deu para criar a seção." : resposta.erro);
      return;
    }
    await aoEscolher(resposta.mensagem);
  }

  return (
    <div className="space-y-4">
      {secoes.length > 0 ? (
        <div>
          <Rotulo>Guardar em uma seção existente</Rotulo>
          <div className="flex gap-2">
            <select
              value={destino}
              onChange={(evento) => definirDestino(evento.target.value)}
              disabled={ocupado}
              className="h-9.5 min-w-0 flex-1 rounded-lg border border-linha bg-superficie-alta px-3 text-[13px] focus:border-[var(--realce)] focus:outline-none"
            >
              {cadernos.map((caderno) => (
                <optgroup key={caderno.caminho} label={caderno.nome}>
                  {caderno.secoes.map((secao) => (
                    <option key={secao.caminho} value={secao.caminho}>
                      {secao.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Botao variante="primario" disabled={!destino || ocupado} onClick={() => void aoEscolher(destino)}>
              Usar seção
            </Botao>
          </div>
        </div>
      ) : null}

      <div className={secoes.length > 0 ? "border-t border-linha pt-4" : undefined}>
        <Rotulo>{secoes.length > 0 ? "Ou criar uma seção" : "Criar o primeiro destino"}</Rotulo>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={cadernoPai}
            onChange={(evento) => definirCadernoPai(evento.target.value)}
            disabled={ocupado}
            className="h-9.5 w-full rounded-lg border border-linha bg-superficie-alta px-3 text-[13px] focus:border-[var(--realce)] focus:outline-none"
          >
            {cadernos.map((caderno) => (
              <option key={caderno.caminho} value={caderno.caminho}>
                {caderno.nome}
              </option>
            ))}
            <option value="__novo__">Novo caderno…</option>
          </select>
          {cadernoPai === "__novo__" ? (
            <Campo
              value={novoCaderno}
              onChange={(evento) => definirNovoCaderno(evento.target.value)}
              placeholder="Nome do caderno"
              disabled={ocupado}
            />
          ) : (
            <span className="hidden sm:block" aria-hidden />
          )}
          <Campo
            value={novaSecao}
            onChange={(evento) => definirNovaSecao(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") void criarDestino();
            }}
            placeholder="Nome da seção"
            disabled={ocupado}
          />
          <Botao
            disabled={ocupado || !novaSecao.trim() || (cadernoPai === "__novo__" && !novoCaderno.trim())}
            onClick={() => void criarDestino()}
          >
            <FolderPlus size={14} />
            Criar e usar
          </Botao>
        </div>
      </div>

      {erro ? <p className="text-[12px] text-perigo" role="alert">{erro}</p> : null}
    </div>
  );
}
