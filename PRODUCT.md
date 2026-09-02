# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Um único usuário: o dono da máquina onde o app roda. Ele usava o Bloco de
Notas do Windows para anotações pessoais e se perdia — arquivos soltos, sem
hierarquia, sem busca, sem etiquetas. Não há contas, login ou multiusuário;
é uma ferramenta pessoal, para uso exclusivo no próprio PC (confirmado —
sem intenção de compartilhar com outras pessoas).

## Product Purpose

Um bloco de anotações pessoal no espírito do OneNote — caderno → seção →
página, hierarquia fixa de 3 níveis, igual ao OneNote de verdade — mas onde
essa hierarquia é a estrutura real de pastas do sistema operacional, e cada
página é um arquivo `.md` ou `.txt` comum, sem formato proprietário. Existe
para resolver a desorganização do Bloco de Notas sem
introduzir a complexidade e o peso do OneNote de verdade. Sucesso é o
usuário nunca mais se perder entre anotações: encontrar qualquer coisa em
segundos pela busca, manter tudo com backup simples (é só copiar a pasta) e
continuar podendo abrir qualquer nota num editor de texto comum se quiser.

## Positioning

Local-first e sem nuvem: os arquivos moram em disco, legíveis e editáveis
fora do app (Bloco de Notas, outro editor, um pendrive). Isso é o que um
concorrente baseado em nuvem (Notion, OneNote de verdade, Obsidian Sync)
não consegue replicar sem abrir mão da própria proposta. Roda como serviço
do Windows sempre ligado — sem terminal, sem login, sem Docker — o que o
diferencia tanto de apps de anotação hospedados quanto de rodar um projeto
de código via `npm run dev` toda vez.

## Operating Context

Roda como serviço nativo do Windows (via NSSM), sempre em segundo plano,
disponível em `http://localhost:3100` assim que o computador liga —
reinicia sozinho se cair. O uso do dia a dia é abrir o navegador nesse
endereço, ou clicar num atalho na Área de Trabalho; não há passo de
"iniciar o app". Para editar o código, existe um modo de desenvolvimento
separado (`npm run dev`, porta diferente), documentado no README.

As anotações ficam em `dados/`, dentro da pasta do projeto: cadernos são
pastas de primeiro nível, seções são subpastas deles (nunca aninhadas entre
si — uma seção nunca tem outra seção dentro), páginas são arquivos `.md`
(markdown) ou `.txt` (texto puro) sempre dentro de uma seção, nunca soltas
direto no caderno — a pessoa escolhe o formato ao criar cada página.
Metadados que não cabem num arquivo de texto
(etiquetas, favoritos, ordem manual, cor/ícone do caderno) ficam num índice
à parte (`dados/_sistema/indice.json`), para as notas em si continuarem
limpas e abríveis em qualquer editor.

## Capabilities and Constraints

- **Sem banco de dados.** O sistema de arquivos é a fonte da verdade; o
  índice em `_sistema/` é reconstruído sozinho a partir do disco se for
  apagado (só etiquetas e favoritos se perdem nesse caso).
- Hierarquia fixa de 3 níveis, igual ao OneNote: caderno → seção → página.
  Sem aninhamento livre — uma seção nunca tem outra seção dentro, e uma
  página nunca fica solta direto no caderno (sempre dentro de uma seção;
  a seção "Geral" recebe automaticamente qualquer página que apareça solta,
  seja de uma migração de versão anterior do app ou copiada ali por fora).
  Criar, renomear, mover (seção só entre cadernos; página só entre seções),
  reordenar e excluir (vai para uma lixeira própria, recuperável).
- Página em markdown abre em modo leitura por padrão (renderizado, com
  realce de sintaxe); um botão "Editar" abre a edição lado a lado
  (texto cru + prévia ao vivo). Página em texto puro abre direto no editor,
  com uma barra de formatação limitada ao que um `.txt` de fato suporta
  (caixa alta, título sublinhado, lista, recuo, separador) — sem negrito
  nem cor, porque o formato não guarda isso.
- Etiquetas cadastráveis com cor, aplicáveis a qualquer página, que
  atravessam cadernos.
- Modelos de página cadastráveis (nome, descrição, conteúdo em markdown) —
  na hora de criar uma página em markdown, um menu opcional deixa começar
  já com o modelo escolhido em vez de em branco.
- Captura rápida (`Ctrl+Shift+N`) e a nota do dia (`Ctrl+Shift+D`, sempre a
  mesma página por data) caem no caderno "Entrada" — um caderno de verdade,
  visível e renomeável na árvore como qualquer outro, não uma pasta
  escondida. "Toda nota mora dentro de um caderno", mesmo as soltas.
- Colar uma imagem (print, cópia de outro app) direto no editor de markdown
  salva o arquivo numa subpasta `_anexos/` ao lado da nota e insere
  `![](_anexos/arquivo.png)` — caminho relativo de verdade, que continua
  fazendo sentido se a pasta for aberta em outro editor de markdown.
- Em modo leitura, clicar numa caixinha de tarefa (`- [ ]`) já grava a
  mudança no arquivo, sem precisar entrar em edição.
- Links entre páginas com `[[Nome da Página]]`: em modo leitura viram um
  link de verdade (com dica ao passar o mouse mostrando "Caderno › Seção ›
  Página" completo) quando o título casa com exatamente uma página; se não
  casar com nenhuma, aparece sublinhado tracejado e sem clique, deixando
  claro que a página ainda não existe. Cada página lê, no rodapé, "Notas que
  apontam para esta" — os backlinks de quem cita ela. Uma tela `/grafo`
  mostra o vault inteiro como uma rede (arraste do mouse destaca as conexões
  de uma nota, clique abre), com uma lista à parte das "notas órfãs" — as
  que nenhuma outra ainda referencia.
- Busca global (`Ctrl+K`) no título e no corpo de todas as notas.
- Painel `/tarefas` junta toda `- [ ]`/`- [x]` do vault inteiro, agrupada por
  página; clicar na caixinha ali grava direto no arquivo de origem, sem abrir
  a nota. Um filtro "Mostrar concluídas" some com o que já foi feito por
  padrão.
- Contagem de palavras e tempo de leitura estimado no cabeçalho de cada nota,
  atualizando ao vivo enquanto se escreve.
- "Exportar tudo" (barra lateral) baixa o vault inteiro — todo caderno, seção
  e página — num único markdown, mesma lógica de exportar uma seção só.
- Web clipper (`/clipper`): um bookmarklet para a barra de favoritos do
  navegador que recorta a página aberta (título, endereço e o texto
  selecionado) direto para uma nota nova no caderno "Entrada", sem extensão
  nenhuma para instalar.
- Histórico de versões automático durante a edição (restaurável) e lixeira
  para pastas e páginas excluídas.
- Se um arquivo `.md`/`.txt` for criado ou editado por fora do app
  (Explorador de Arquivos, outro editor), o app adota a mudança na próxima
  abertura — o disco manda, não o app.
- Restrição de ambiente conhecida: o Smart App Control do Windows bloqueia
  o compilador nativo do Next.js, então builds caem para um modo mais lento
  em WASM; documentado, sem solução automática (desativar o Smart App
  Control é irreversível sem reinstalar o Windows, então o projeto convive
  com a lentidão do build em vez de desativá-lo).
- O projeto fica fora de pastas sincronizadas por nuvem (OneDrive) de
  propósito — sincronizar milhares de arquivos pequenos do `node_modules`
  atrapalhava instalação e build.

## Evidence on Hand

Não há conteúdo de marketing, depoimentos ou dados de demonstração — e
nenhum deve ser inventado. O "conteúdo real" do produto são as próprias
anotações do usuário em `dados/`, que são dados pessoais, não material de
divulgação.

## Product Principles

1. **O disco é a verdade.** Nenhuma informação essencial vive só na memória
   do app; tudo que importa está em arquivos comuns, e o app se reconstrói
   a partir deles.
2. **Arquivo aberto em qualquer editor.** `.txt` e `.md` nunca ganham
   metadados embutidos ou marcação que os torne dependentes deste app.
3. **Sem fricção para abrir.** O app já está rodando quando o computador
   liga; usar é só abrir o navegador, nunca "iniciar" nada.
4. **Simplicidade sobre paridade de recursos.** A meta é resolver a
   desorganização do Bloco de Notas, não replicar todo recurso do OneNote.
5. **Local e sem conta, sempre.** Nenhuma decisão de produto deve exigir
   nuvem, login ou rede para o uso básico funcionar.

## Accessibility & Inclusion

Nenhum requisito específico confirmado além de boas práticas gerais
(contraste, navegação por teclado, foco visível).
