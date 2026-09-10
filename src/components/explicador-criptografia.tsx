"use client";

import { ShieldQuestion } from "lucide-react";
import { useState } from "react";

import { BotaoIcone, Dialogo } from "./ui";

/**
 * "Como funciona" — sempre à mão, tanto na tela trancada quanto dentro do
 * cofre já aberto, para quem quiser reler sem precisar perguntar de novo.
 */
export function BotaoComoFunciona({ className }: { className?: string }) {
  const [aberto, definirAberto] = useState(false);
  return (
    <>
      <BotaoIcone rotulo="Como funciona a criptografia" onClick={() => definirAberto(true)} className={className}>
        <ShieldQuestion size={15} />
      </BotaoIcone>
      <Dialogo
        titulo="Como funciona a criptografia deste cofre"
        aberto={aberto}
        aoFechar={() => definirAberto(false)}
        largura="max-w-xl"
      >
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1 text-[13px] leading-relaxed text-tinta-2">
          <section>
            <h3 className="mb-1 text-[13px] font-bold text-tinta">O cofre é salvo — a senha mestra não</h3>
            <p>
              O arquivo do cofre fica salvo no disco o tempo todo, como qualquer nota ou quadro deste
              app. Dentro dele estão todas as suas senhas, sempre — só que cifradas, viram um
              emaranhado ilegível sem a chave certa. A sua senha mestra, por outro lado,{" "}
              <strong className="text-tinta">nunca é salva em lugar nenhum</strong> — nem em texto puro,
              nem como hash, nem no navegador.
            </p>
          </section>

          <section>
            <h3 className="mb-1 text-[13px] font-bold text-tinta">Uma chave que ninguém guarda</h3>
            <p>
              Pense no cofre como uma caixa trancada guardada numa gaveta, e a senha mestra como a
              chave física dela. A chave nunca fica dentro da gaveta — ela existe só na sua cabeça, e
              você a usa toda vez que quer abrir a caixa. Ninguém precisou “lembrar” da chave em lugar
              nenhum: a mesma chave sempre abre a mesma fechadura porque foi ela que a fechou.
            </p>
            <p className="mt-2">
              Tecnicamente: sua senha mestra passa por um cálculo chamado <strong>Argon2id</strong>, que
              a transforma numa chave de criptografia. Esse cálculo usa também um número aleatório (o
              “sal”) gerado quando o cofre nasceu — guardado sem segredo nenhum dentro do próprio
              arquivo. Toda vez que você digita a senha de novo, o app repete exatamente o mesmo
              cálculo, com os mesmos ingredientes, e chega na mesma chave de novo — não porque algo foi
              lembrado, mas porque a conta dá o mesmo resultado sempre que os mesmos números entram
              nela.
            </p>
          </section>

          <section>
            <h3 className="mb-1 text-[13px] font-bold text-tinta">Por que é lento de propósito</h3>
            <p>
              Um hash comum é rápido de calcular — dá para testar bilhões de senhas por segundo numa
              placa de vídeo. O Argon2id é desenhado para ser caro: ele obriga o computador a preencher
              um bloco grande de memória (64 MB, aqui) com dados derivados da senha, e fica lendo e
              misturando pedaços aleatórios desse bloco várias vezes. Isso é chamado de{" "}
              <em>memory-hard</em> — testar um bilhão de senhas em paralelo exigiria um bilhão de blocos
              de 64 MB ao mesmo tempo, o que é caro demais para valer a pena mesmo com muito hardware.
            </p>
          </section>

          <section>
            <h3 className="mb-1 text-[13px] font-bold text-tinta">Como o app sabe que a senha está certa</h3>
            <p>
              A chave calculada decifra o conteúdo do arquivo. Se ela estiver certa, o resultado bate
              com um selo de conferência guardado no arquivo desde que o cofre foi criado; se estiver
              errada, o conteúdo decifrado vira lixo e o selo não bate. É assim que o app diz “senha
              incorreta” sem nunca ter guardado a senha certa em lugar nenhum para comparar.
            </p>
          </section>

          <section className="rounded-lg border border-[color-mix(in_srgb,var(--perigo)_30%,transparent)] bg-[color-mix(in_srgb,var(--perigo)_6%,transparent)] p-3">
            <p className="text-perigo">
              <strong>Sem recuperação:</strong> se você esquecer a senha mestra, não existe “esqueci
              minha senha” — nem eu, nem o app, nem ninguém consegue reconstruir o conteúdo sem ela.
              Isso não é uma limitação imposta, é a própria natureza da criptografia por senha.
            </p>
          </section>
        </div>
      </Dialogo>
    </>
  );
}
