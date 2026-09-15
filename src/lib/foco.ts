"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Modo foco: some com a moldura toda (trilho, coluna de navegação e
 * cabeçalho da nota) e deixa só o texto na tela.
 *
 * O estado mora num `data-foco` no `<html>` em vez de num contexto porque
 * quem precisa sumir está espalhado por componentes que não são parentes da
 * nota — o CSS resolve com uma regra só (ver `.esconde-no-foco` em
 * `globals.css`). Não é lembrado entre sessões de propósito: é um modo de
 * escrever agora, não uma preferência.
 */
export function useModoFoco() {
  const [foco, definirFoco] = useState(false);

  useEffect(() => {
    if (foco) document.documentElement.dataset.foco = "1";
    else delete document.documentElement.dataset.foco;
    // Sair da nota (ou fechar a janela flutuante) não pode deixar o app
    // inteiro sem moldura.
    return () => {
      delete document.documentElement.dataset.foco;
    };
  }, [foco]);

  const alternar = useCallback(() => definirFoco((atual) => !atual), []);
  const sair = useCallback(() => definirFoco(false), []);

  return { foco, alternar, sair };
}
