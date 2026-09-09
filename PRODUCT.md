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
sempre dentro de uma seção, nunca soltas direto no caderno. Página nova é
sempre markdown; os `.txt` de versões anteriores continuam abrindo e
editando normalmente, e o menu deles oferece converter para markdown.
O Kanban é outra aplicação, com pastas próprias em `dados/_kanban/` — ver
"aplicações independentes" abaixo.
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
  reordenar e excluir (vai para uma lixeira própria, recuperável). Reordenar
  e mover também dá pra fazer arrastando: seção arrastada para perto de
  outra troca de posição, arrastada em cima de um caderno na tira do topo
  muda de dono; página arrastada perto de outra troca de posição, arrastada
  em cima de uma seção na coluna ao lado muda de seção. As setas "Subir" /
  "Descer" e o "Mover para..." do menu continuam existindo, para quem
  prefere não arrastar.
- Página nova não pergunta nada: o "+" cria na hora, com nome tirado da
  seção mais a data e a hora ("Reuniões 08-09 21-05"), e já abre em edição.
  O título muda com dois cliques nele, na própria página — o arquivo é
  renomeado no disco junto, e o endereço acompanha. Perguntar o título antes
  era pedir a decisão mais difícil no pior momento: antes de existir texto.
- Página em markdown abre em modo leitura por padrão (renderizado, com
  realce de sintaxe); um botão "Editar" abre a edição lado a lado
  (texto cru + prévia ao vivo). Um título ainda sem texto ("### " recém
  digitado) aparece na prévia como os próprios "#" em cinza, em vez de
  sumir da tela até o título ganhar palavras. Os `.txt` que sobraram de
  versões anteriores continuam abrindo no editor de texto puro, com a barra
  de formatação limitada ao que o formato suporta — mas o app não cria mais
  nenhum: página nova é sempre markdown.
- As colunas de seções e de páginas se recolhem numa faixa fina, e a faixa
  continua dizendo onde a pessoa está: o nome da seção aberta e o da página
  aberta, escritos de cima para baixo. Clicar no nome abre a coluna de volta.
- Etiquetas cadastráveis com cor, aplicáveis a qualquer página, que
  atravessam cadernos.
- Modelos de página cadastráveis (nome, descrição, conteúdo em markdown) —
  um botão à parte ("começar de um modelo") cria a página já com o modelo
  escolhido, só aparecendo quando existe algum modelo cadastrado.
- Captura rápida (`Ctrl+Shift+N`) e a nota do dia (`Ctrl+Shift+D`, sempre a
  mesma página por data) caem na seção "Geral" do caderno "Entrada" — um
  caderno de verdade, visível e renomeável na tira de cadernos como
  qualquer outro, não uma pasta escondida. "Toda nota mora dentro de uma
  seção", mesmo as soltas.
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
- **O app é um hub de aplicações independentes** — hoje Anotações e Kanban.
  A coluna mais à esquerda diz qual está aberta e lista o que é dela:
  cadernos numa, quadros na outra. As listas não se misturam em nada:
  excluir o quadro "Trabalho" não encosta no caderno "Trabalho", e
  vice-versa. Em modo Kanban, a coluna de navegação das anotações (busca,
  captura rápida, seções, atalhos fixos) some da tela; sobram a coluna de
  quadros e o quadro em si. O botão de tema claro/escuro fica no rodapé
  dessa coluna, visível nos dois modos.
- Kanban (`/kanban/<Quadro>`): quadros próprios, guardados em
  `dados/_kanban/<Quadro>/<Coluna>/<Tarefa>.md` — fora dos cadernos, porque
  não são anotação. Cada tarefa é um arquivo `.md` de verdade; arrastar
  entre colunas move o arquivo de pasta, exatamente como mover uma página
  entre seções. Quadros criados numa versão anterior (quando o quadro vivia
  dentro do caderno) são migrados sozinhos na primeira abertura: viram um
  quadro com o nome do caderno de onde saíram, com índice, dependências e
  itens da lixeira reapontados. Exclusão vai para a mesma lixeira das
  páginas. As tarefas do Kanban não aparecem em nada das Anotações (busca,
  recentes, favoritos, painel `/tarefas`, árvore de cadernos).
  - **Etiquetas do Kanban** (`/kanban/etiquetas`): cadastro à parte das
    etiquetas de anotações — mesma interface, mas vale só para tarefas, em
    qualquer quadro. O editor de tarefa tem seu próprio seletor, que já
    linka pra lá quando falta cadastrar uma cor nova.
  - **Dependências ("Bloqueado por")**: uma tarefa pode depender de outras
    do mesmo quadro. O cartão mostra um cadeado com a contagem de
    dependências ainda não concluídas; arrastar a tarefa pra a coluna de
    conclusão enquanto sobrar alguma pendente é recusado, com um aviso
    explicando quais faltam. Mover ou renomear uma tarefa da qual outras
    dependem atualiza a referência sozinho, sem quebrar o vínculo.
  - **Colunas configuráveis por quadro**: as 4 colunas padrão (Backlog,
    Fazendo, Impedido, Feito) são só o ponto de partida — dá pra criar,
    renomear, reordenar e excluir coluna (só vazia) pelo menu de três
    pontos no cabeçalho de cada uma. Uma delas é marcada como "coluna de
    conclusão" (Feito, por padrão) — é ela que o bloqueio de dependências
    usa. Guardado em `_kanban/<Quadro>/config.json`.
  - **Prioridade** (Baixa/Média/Alta/Urgente, com cor) e **prazo** (data
    opcional, cartão destaca em vermelho quando atrasado e a tarefa ainda
    não está na coluna de conclusão) por tarefa.
  - **Sprints**: agrupador simples e global (sem datas nem burndown) — cria
    uma sprint com um nome, vincula tarefas de qualquer quadro a ela,
    filtra o quadro por sprint.
  - **Filtro do quadro** por etiqueta, prioridade ou sprint — no topo do
    quadro, sem sair da tela; mostra quantas tarefas batem de quantas
    existem na coluna.
  - **Menu de três pontos no cartão** (some ao passar o mouse): mover para
    outra coluna, mudar prioridade, duplicar tarefa (etiqueta/prioridade/
    prazo vêm junto, dependências não), favoritar e excluir — sem precisar
    abrir o editor da tarefa pra nada disso.
  - **Subtarefas**: checklist da tarefa, no editor — digitar e dar Enter
    cria a próxima sem tirar a mão do teclado, e marcar é um clique. O
    cartão fechado mostra o progresso ("1/4") e uma barrinha aparece no
    editor. Ficam no índice, não no corpo em markdown: assim a contagem não
    depende de a pessoa ter escrito as caixinhas num formato específico.
  - **Impedimento com motivo**: marcar a tarefa como impedida e escrever o
    porquê. O cartão pequeno ganha uma faixa vermelha com o motivo e a
    borda vermelha, então dá para achar o que está travado varrendo o
    quadro de longe. Diferente de "Bloqueado por", que é dependência de
    outra tarefa: aqui o bloqueio é externo (esperando terceiro, faltando
    informação).
  - **Data de criação** visível no rodapé de cada cartão.
  - **Renomear com dois cliques** no título — só com o cartão aberto. No
    cartão pequeno do quadro, o clique é sempre "abrir": a área é apertada
    demais para disputar com um duplo clique.
  - **Editor da tarefa**: título editável no topo, descrição em markdown
    que abre só com a caixa de edição (sem prévia lado a lado) — um botão
    "Salvar" embaixo dela grava e troca pra visualização renderizada; um
    "Editar" volta pra caixa de texto. Abaixo dela, as subtarefas.
    Impedimento, prioridade, prazo, sprint, etiquetas e "Bloqueado por"
    ficam numa coluna à direita, separados do conteúdo.
- Histórico de versões automático durante a edição (restaurável) e lixeira
  para pastas e páginas excluídas.
- Se um arquivo `.md`/`.txt` for criado ou editado por fora do app
  (Explorador de Arquivos, outro editor), o app adota a mudança na próxima
  abertura — o disco manda, não o app. A varredura que reconcilia disco e
  índice vale por 1 segundo: uma tela que lê a árvore, os favoritos e os
  recentes de uma vez varre o disco uma vez só, em vez de três.
- **O campo de edição da nota não é controlado pelo React** (`defaultValue`,
  não `value`): quem manda no texto escrito é o DOM. Num campo controlado,
  uma renderização concorrente interrompida podia repor no DOM o texto de
  uma renderização já vencida — era o "###" que virava "##" e voltava ao
  apertar Enter, com a prévia chegando a mostrar mais "#" que o editor. A
  contrapartida é que mudança feita por código (negrito, imagem colada,
  restaurar versão) precisa escrever no campo na mão, e por isso passa toda
  por uma função só (`aplicarNoCampo`).
- **Regra de desempenho:** o que acontece enquanto se digita (salvamento
  automático da nota e da tarefa) e o que é clique repetido (marcar
  subtarefa, trocar prioridade, prazo, sprint, etiqueta, impedimento) não
  revalida a casca do app. Essas ações já aparecem na tela na hora, pelo
  estado local; revalidar remontava a árvore inteira e mandava ~30 KB de
  volta a cada pausa na digitação — além de deixar lento, isso re-renderizava
  o campo de texto no meio da escrita e fazia sumir letra em rajada rápida.
  Quem revalida é o que muda a estrutura (criar, renomear, mover, excluir) e
  o fim da edição (`Concluir`/`Esc`), que é quando a lista de páginas precisa
  do trecho novo.
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
