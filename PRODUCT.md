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
Kanban, Senhas e Links são outras aplicações, com dados próprios: quadros
em `dados/_kanban/`, o cofre em `dados/_senhas/cofre.kdbx` (um arquivo
`.kdbx` opaco, cifrado — a única exceção ao "arquivo aberto em qualquer
editor" de texto, porque é da natureza de um cofre de senhas ser ilegível
sem a senha mestra), e a árvore de Links em `dados/_links/arvore.json`
(uma exceção deliberada ao "disco é a verdade": um link não tem corpo de
texto que justifique ser arquivo próprio, então a árvore inteira de
pastas vive num JSON só; os favicons, esses sim, são arquivos reais em
`dados/_links/favicons/`) — ver "aplicações independentes" abaixo.
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
  seção mais a data e a hora ("Reuniões 08-09-2026 21-05"), e já abre em
  edição.
  O título muda com dois cliques nele, na própria página — o arquivo é
  renomeado no disco junto, e o endereço acompanha. Perguntar o título antes
  era pedir a decisão mais difícil no pior momento: antes de existir texto.
- **A navegação de Anotações é uma árvore só**: cadernos › seções ›
  páginas numa coluna, no modelo do explorador do Obsidian. Vários
  cadernos e seções podem ficar abertos ao mesmo tempo; o que estava
  aberto é lembrado, e a trilha da página aberta abre sozinha. As páginas
  aparecem em linhas (estrela se favorita, alfinete se fixada, título,
  data) — cabem três vezes mais por tela do que os cartões de antes, que
  continuam só no Início e nas Etiquetas. Ctrl+clique (ou botão do meio)
  numa página abre ela numa aba nova sem sair da atual.
- **Abas de notas abertas**, como num navegador: uma faixa acima do
  conteúdo lembra por onde se passou. Clicar numa página substitui a aba
  atual; Ctrl+clique abre ao lado; arrastar reordena; botão do meio ou
  Alt+W fecha; Alt+PageUp/PageDown circulam (Ctrl+W e Ctrl+Tab são do
  navegador, que não deixa a página interceptar). Renomear ou mover uma
  nota leva a aba junto. Só a faixa — sem dividir a tela em painéis.
- **Fixar página no topo da seção**: diferente de favoritar (que é global,
  aparece no Início), fixar só põe a página em primeiro na lista da
  própria seção. Um bit no índice, como a ordem manual.
- Página em markdown abre em modo leitura por padrão (renderizado, com
  realce de sintaxe), usando a tela toda — igual à largura da edição lado
  a lado. Um botão (`Ctrl+Shift+W`) estreita a prosa pra ~70 caracteres
  por linha e centraliza, pra quem prefere essa medida clássica de
  leitura; a preferência acompanha o zoom do texto e fica salva entre
  sessões. Um botão "Editar" abre a edição lado a lado (texto cru + prévia
  ao vivo), com a barra de formatação dentro da coluna do texto. O
  cabeçalho da nota tem duas linhas: título e ações; embaixo, trilha do
  caderno, etiquetas e "412 palavras · 2103 caracteres · 2 min". **Modo foco**
  (`Ctrl+Shift+F`) some com trilho, coluna e cabeçalho e deixa só o texto;
  Esc sai. Um **sumário** dos títulos aparece na margem direita a partir
  de três títulos (`]` alterna): em leitura o título na tela fica
  destacado e clicar rola até ele; em edição, clicar leva o cursor à linha. Um título ainda sem texto ("### " recém
  digitado) aparece na prévia como os próprios "#" em cinza, em vez de
  sumir da tela até o título ganhar palavras. Os `.txt` que sobraram de
  versões anteriores continuam abrindo no editor de texto puro, com a barra
  de formatação limitada ao que o formato suporta — mas o app não cria mais
  nenhum: página nova é sempre markdown.
- A coluna da árvore se recolhe numa faixa fina (`[`), e a faixa continua
  dizendo onde a pessoa está: caderno › seção, escritos de cima para
  baixo. Clicar no nome abre a coluna de volta.
- **O editor se comporta como um editor**, mesmo sendo um campo de texto:
  Enter continua a lista (numerada com o número seguinte, tarefa como
  tarefa) e um item vazio encerra a lista; Tab/Shift+Tab indentam; Alt+↑/↓
  movem a linha; Ctrl+D duplica; Ctrl+B/I formatam. Toda mudança feita por
  código (negrito, substituir todas, restaurar versão) entra no desfazer
  nativo — Ctrl+Z volta. Sugestões coladas no cursor: `[[` lista as páginas
  do vault e insere `[[Título]]`; `#` no meio de uma linha aplica uma
  etiqueta à nota (e some do texto — etiqueta é metadado, não palavra do
  arquivo; no começo da linha continua sendo título); `/` insere tarefa,
  tabela, data, hora, separador, citação, bloco de código, títulos, um
  modelo cadastrado ou abre o seletor de arquivo. `Ctrl+F` / `Ctrl+H` em
  edição buscam e substituem dentro da página ("3 de 12", uma ou todas).
- **Arrastar um arquivo para o editor** (PDF, planilha, texto, imagem)
  salva em `_anexos/` com o nome original e insere o link (imagem como
  `![]()`); a lista de tipos aceitos é a mesma que o app serve — SVG fica
  de fora por poder carregar script. Nomes com espaço ou acento vão
  codificados no markdown, que é link válido em qualquer leitor.
- **Callouts** `> [!nota]`, `[!dica]`, `[!aviso]`, `[!perigo]`, `[!info]`,
  `[!importante]` viram blocos com faixa colorida, ícone e título; a
  sintaxe é a do Obsidian, e noutro leitor continua sendo citação.
- **Histórico compara antes de restaurar**: ao lado da prévia de uma
  versão, "Comparar" mostra linha a linha o que restaurar devolve (verde)
  e apaga (vermelho), com o resumo "+1 −1". Com o histórico aberto, a
  prévia da edição cede a vez.
- **Imprimir / salvar em PDF** pelo botão da nota: folha de estilo de
  impressão do navegador, só o título e o texto, sem moldura — links
  impressos com o endereço ao lado.
- **Janela flutuante**: um item no menu da seção ("Nova página em janela
  flutuante") cria a página e abre
  ela numa janela por cima da tela atual, em vez de navegar pra longe —
  arrastável pela barra do topo, redimensionável pelo canto, posição e
  tamanho lembrados entre usos. Fechar não perde nada (o autosave já
  gravou); um botão "expandir" leva pra tela cheia quando a nota crescer
  além do que cabe flutuando.
- **Esconder a prévia** na edição lado a lado: um botão na barra de
  formatação tira a coluna da prévia e deixa o texto cru ocupar a largura
  toda — para quem já sabe o que está escrevendo e não precisa ver
  renderizado enquanto digita. Lembrado entre sessões.
- Etiquetas cadastráveis com cor, aplicáveis a qualquer página, que
  atravessam cadernos.
- Modelos de página cadastráveis (nome, descrição, conteúdo em markdown) —
  um botão à parte ("começar de um modelo") cria a página já com o modelo
  escolhido, só aparecendo quando existe algum modelo cadastrado.
  `/datadehoje` e `/horaagora` escritos dentro do conteúdo do modelo viram
  a data/hora reais nesse momento — uma vez só, na criação; depois é texto
  comum, não recalcula sozinho toda vez que a página é aberta.
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
- Busca global no título e no corpo de todas as notas — hoje uma das
  seções da paleta de comandos (`Ctrl+K`), ao lado de tarefas e links.
- **Busca inteligente**, por caderno (menu "⋯" do caderno → "Busca
  inteligente"): acha páginas por significado, não pela palavra exata —
  "quais anotações falam sobre X" em vez de precisar lembrar a palavra
  usada. Um vetor por página inteira (embeddings locais, `@huggingface/
  transformers` rodando em CPU, modelo baixado uma vez e cacheado fora de
  `node_modules`) — nenhum texto sai da máquina, nem pra indexar nem pra
  buscar. Reindexa sozinha depois de cada salvamento; a primeira busca
  num caderno com páginas nunca indexadas (ou editadas por fora do app)
  paga o preço de indexar o que faltar antes de responder. Devolve uma
  lista de páginas ordenada por relevância, não uma resposta em texto —
  sem chat, sem geração, de propósito.
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
  selecionado) direto para uma nota nova numa seção escolhida — o destino é
  configurável na própria tela do clipper (um `<select>` caderno → seção,
  lembrado entre recortes) e não fica mais preso a um caderno fixo. Sem
  extensão nenhuma para instalar.
- **Cor do caderno/quadro mais visível pela interface inteira**: além da
  bolinha na lista, o caderno (ou quadro, ou pasta de Links) aberto pinta
  uma faixa fina no topo do app inteiro, o item ativo na lista fica com
  fundo mais saturado, e os cartões (nota, tarefa, link) ganham fundo e
  borda tingidos dessa cor — o cartão aberto no momento fica com a cor
  ainda mais forte (faixa colorida no topo). Um popup de card (tarefa do
  Kanban, link) herda essa mesma cor forte em vez de ficar branco neutro.
- **Excluir caderno exige digitar o nome** antes de liberar o botão —
  mesma trava usada para excluir uma pasta de Links com conteúdo dentro;
  seção e página continuam só com confirmação de um clique.
- **Cor de fundo do editor de markdown** à escolha, independente do tema
  da interface: acompanhar o tema (padrão), sempre claro, sempre escuro ou
  sépia — lembrado entre sessões.
- **Seis temas** para a interface inteira (claro, escuro, sépia, escuro
  suave, cinza neutro, vibrante — este último saturado e com brilho,
  pensado pra quem quer uma tela com mais cor/contraste), escolhidos num
  menu; a tela nunca pisca no tema errado ao carregar.
- **Abrir uma aplicação em janela separada do navegador**: botão direito
  no ícone de uma aplicação (Anotações, Kanban, Senhas, Links) no trilho
  oferece "Abrir em nova janela" — para usar duas ao mesmo tempo lado a
  lado. A mesma ação existe na paleta de comandos. As duas janelas dividem
  o mesmo servidor e dados; uma mudança numa aparece na outra ao atualizar.
- **O app é um hub de aplicações independentes** — hoje Anotações, Kanban,
  Senhas e Links. Um **trilho de ícones** de 56 px na borda esquerda diz
  qual está aberta (nome e contagem no tooltip); cada aplicação carrega a
  própria coluna de navegação ao lado dele: Anotações tem cadernos +
  seções numa coluna e páginas noutra, Kanban tem a coluna de quadros,
  Senhas e Links navegam a própria árvore na área de conteúdo. Cada coluna
  recolhe pra uma faixa fina (`[` e `]` no teclado) e lembra a largura.
  As listas não se misturam em nada: excluir o quadro "Trabalho" não
  encosta no caderno "Trabalho", e vice-versa; excluir um cofre não mexe
  em nada de Links, e vice-versa. No rodapé do trilho ficam a folha de
  atalhos e o menu de Preferências (tema, densidade, avisos), visíveis em
  todas as aplicações. Abrir o app cai direto em Anotações.
- **Paleta de comandos** (`Ctrl+K` ou `/`, de qualquer aplicação): uma
  caixa só que mistura ações (nova página, novo quadro, trocar tema,
  densidade, recolher colunas, abrir em nova janela, trancar cofre…),
  "Ir para" (todas as telas fixas, cada caderno › seção, cada quadro, cada
  pasta de links) e as buscas de servidor em notas, tarefas do Kanban e
  links — tudo numa lista navegável por setas e Enter. Prefixos `>`, `#`,
  `@` e `!` restringem a ações, notas, tarefas ou links. Senhas ficam de
  fora da paleta: o cofre só é lido destrancado.
- **Atalhos de teclado consistentes**, registrados num lugar só e listados
  na folha `?` (que mostra apenas o que vale na tela atual): `Alt+1..4`
  troca de aplicação, `n` cria o item da tela (página, tarefa, senha,
  link), `e` edita a nota aberta, `Ctrl+S` salva, `[`/`]` recolhem as
  colunas, `Ctrl+L` tranca o cofre. Tecla solta nunca dispara dentro de um
  campo de texto.
- **Densidade** da interface (Confortável ou Compacta) no menu de
  Preferências: a compacta aperta o espaço interno dos cartões, o vão
  entre eles e a altura das linhas das árvores — para caber mais numa
  lista de 200 links ou 40 senhas — sem mexer no tamanho da fonte.
  Lembrada entre sessões e aplicada antes da primeira pintura, como o
  tema. Listas longas só fazem layout do que está na tela
  (`content-visibility`), sem biblioteca de virtualização.
- **Avisos de prazo do Kanban atravessam o hub**: o ícone do Kanban no
  trilho ganha um ponto vermelho quando alguma tarefa de qualquer quadro
  está com prazo estourado (a contagem no tooltip), visível de dentro de
  Links, Senhas ou Anotações; tarefa na coluna de conclusão não conta. Quem
  quiser liga "Avisar prazos do Kanban" em Preferências: o navegador pede
  permissão no clique e, dali em diante, mostra uma notificação com as
  atrasadas e as que vencem hoje — uma vez por dia para cada conjunto, e
  clicar nela abre o quadro. Desligado por padrão.
- **Instalável como aplicativo** (menu do Chrome/Edge → Instalar): abre em
  janela própria sem barra de endereço, com ícone na barra de tarefas e
  no menu Iniciar. Sem service worker — o app é local, offline é o normal.
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
    etiquetas de anotações — mesma interface, mas vale só para tarefas.
    Cada etiqueta é **geral** (aparece em todos os quadros) ou presa a um
    quadro específico (só aparece nele); a tela de cadastro mostra as duas
    listas separadas, e excluir um quadro leva junto as etiquetas que
    eram só dele. O editor de tarefa tem seu próprio seletor (gerais + as
    do quadro atual), que já linka pra lá quando falta cadastrar uma cor
    nova.
  - **Dependências ("Bloqueado por")**: uma tarefa pode depender de outras
    do mesmo quadro. O cartão mostra um cadeado com a contagem de
    dependências ainda não concluídas; arrastar a tarefa pra a coluna de
    conclusão enquanto sobrar alguma pendente é recusado, com um aviso
    explicando quais faltam. Mover ou renomear uma tarefa da qual outras
    dependem atualiza a referência sozinho, sem quebrar o vínculo.
  - **Colunas configuráveis por quadro**: as 4 colunas padrão (Backlog,
    Fazendo, Impedido, Feito) são só o ponto de partida — dá pra criar,
    renomear, reordenar e excluir coluna (só vazia) pelo menu de três
    pontos no cabeçalho de cada uma. Uma ou mais podem ser marcadas como
    "coluna de conclusão" (Feito, por padrão) — cada uma ligada desbloqueia
    dependentes, para de contar como atrasada, entra no arquivamento
    (manual e automático) e dispara a próxima ocorrência de tarefa
    repetida; pelo menos uma sempre fica ligada. Guardado em
    `_kanban/<Quadro>/config.json`.
  - **Prioridade** (Baixa/Média/Alta/Urgente, com cor) e **prazo** (data
    opcional, cartão destaca em vermelho quando atrasado e a tarefa ainda
    não está na coluna de conclusão) por tarefa.
  - **Sprints**: agrupador global — cria uma sprint com um nome, vincula
    tarefas de qualquer quadro a ela, filtra o quadro por sprint. Início e
    fim opcionais (só para saber quando é; sem burndown) e **"Fechar
    sprint"**, que pergunta o que fazer com o que sobrou: mover para outra
    sprint aberta ou soltar. Fechada some dos seletores.
  - **Identificador curto** por tarefa ("CLD-14"): sigla do quadro (primeira
    letra + duas consoantes) e um número sequencial que não se reusa —
    referência falável, como no Linear e no Jira. Tarefas de antes ganham o
    número na primeira abertura do quadro, na ordem de criação.
  - **Estimativa** P/M/G por tarefa (1/2/3 pontos), com a soma "Σ" no
    cabeçalho da coluna. **Cor própria do cartão** (faixa fina no topo, uma
    das seis da paleta) para agrupar sem criar etiqueta. **Repetir**
    (dia/semana/mês): ao entrar na coluna de conclusão, nasce uma cópia na
    primeira coluna com o próximo prazo, subtarefas desmarcadas.
  - **Filtro do quadro** por etiqueta, prioridade ou sprint — no topo do
    quadro, sem sair da tela; mostra quantas tarefas batem de quantas
    existem na coluna.
  - **Três visões sobre o mesmo filtro**: Quadro, **Lista** (tabela
    ordenável por qualquer coluna — "tudo que vence esta semana, por
    prioridade") e **Calendário** (o mês com cada tarefa no dia do prazo).
    Lembrado por quadro. A tela **Hoje** (`/kanban/hoje`) junta tudo que
    tem prazo, de todos os quadros, em Atrasadas · Hoje · Esta semana ·
    Depois; clicar leva ao quadro com a tarefa já aberta.
  - **Colunas** recolhem numa faixa fina (nome na vertical, contagem),
    têm **limite de WIP** opcional (o cabeçalho fica "4/3" em vermelho ao
    passar e mover mais uma para lá pede confirmação) e um "Adicionar
    tarefa" fixo no rodapé, sempre à vista.
  - **Arquivar**: tarefa concluída sai do quadro para `_arquivo/` — é
    histórico, não lixeira. Pelo menu do cartão, por "Arquivar tudo" na
    coluna de conclusão, ou sozinha depois de N dias lá (30 por padrão, 0
    desliga; só para tarefas movidas depois desta versão). A tela
    `/kanban/<Quadro>/arquivo` procura e desarquiva.
  - **Adição rápida**: no campo de tarefa nova, `Revisar !alta #financeiro
    @sexta ~sprint3 =M` já cria com prioridade, etiqueta, prazo (hoje,
    amanhã, dia da semana, 20/09), sprint e estimativa — as pastilhas
    aparecem embaixo do campo antes do Enter; o que não casa fica no título.
  - **Seleção múltipla**: Ctrl+clique soma, Shift+clique pega o intervalo
    na coluna; uma barra embaixo move, muda prioridade, arquiva ou exclui
    em lote. Esc limpa.
  - **Atalhos** sobre a tarefa aberta ou sob o mouse: `e` abre, `d` abre no
    prazo, `f` favorita, `1–4` prioridade, `←/→` movem de coluna; `n` cria.
  - **Envelhecimento**: parada há 14+ dias na mesma coluna, fora da
    conclusão, o cartão esmaece e diz "há N dias aqui" — é como se acha o
    que travou sem ninguém ter marcado impedimento.
  - **Menu de três pontos no cartão** (some ao passar o mouse): mover para
    outra coluna, mudar prioridade, duplicar tarefa (etiqueta/prioridade/
    prazo vêm junto, dependências não), favoritar e excluir — sem precisar
    abrir o editor da tarefa pra nada disso.
  - **Subtarefas**: checklist da tarefa, numa caixa própria no editor —
    digitar e dar Enter cria a próxima sem tirar a mão do teclado, marcar é
    um clique, renomear é dois cliques no texto (igual ao título da
    tarefa), e reordenar é arrastar pela alcinha que aparece ao passar o
    mouse. O cartão fechado mostra o progresso ("1/4") e uma barrinha
    aparece no editor. Ficam no índice, não no corpo em markdown: assim a
    contagem não depende de a pessoa ter escrito as caixinhas num formato
    específico.
  - **Comentários**: mural de recados da tarefa, separado da descrição —
    cada entrada carimbada com data e hora, só de acréscimo (a única edição
    possível é apagar um recado errado, nunca corrigir o texto de um já
    escrito). O cartão fechado mostra quantos tem.
  - **Impedimento com motivo**: marcar a tarefa como impedida e escrever o
    porquê. O cartão pequeno ganha uma faixa vermelha com o motivo e a
    borda vermelha, então dá para achar o que está travado varrendo o
    quadro de longe. Diferente de "Bloqueado por", que é dependência de
    outra tarefa: aqui o bloqueio é externo (esperando terceiro, faltando
    informação).
  - **Cartão com rodapé de posições fixas**: prazo · checklist ·
    comentários à esquerda, estimativa · cadeado · prioridade à direita;
    identificador em cima (a data de criação no tooltip dele). O olho acha
    o prazo no mesmo lugar em qualquer cartão.
  - **Renomear com dois cliques** no título — só com o cartão aberto. No
    cartão pequeno do quadro, o clique é sempre "abrir": a área é apertada
    demais para disputar com um duplo clique.
  - **A tarefa abre num painel lateral** de 460px ao lado do quadro, não
    num modal: o quadro continua visível e rolável, clicar noutro cartão
    troca o conteúdo, Esc fecha, e um botão expande para a tela cheia (o
    diálogo de antes, para descrições longas) — modo lembrado. No painel,
    as propriedades (impedimento, prioridade, prazo, sprint, etiquetas,
    "bloqueado por", estimativa, repetição, cor) vêm em cima, em duas
    colunas, e a descrição em markdown, as subtarefas e o mural de
    comentários embaixo. A descrição abre só com a caixa de edição — um
    "Salvar" grava e troca para a visualização renderizada.
- **Senhas** (`/senhas`): um cofre de senhas em `.kdbx` de verdade (formato
  do KeePass, Argon2id + AES-256) — o arquivo abre também no KeePassXC,
  KeePassDX etc., sem "exportar para outra plataforma", só copiar o
  arquivo. Tela de senha mestra cria um cofre novo ou importa um `.kdbx`
  que a pessoa já tem.
  - **Três colunas**: grupos (com os nós virtuais **Todas**, **Favoritas**
    e **Recentes** acima da árvore, e **Lixeira** no rodapé) · linhas de
    40px (favicon do site ou inicial colorida, título sobre usuário,
    copiar usuário/senha no hover) · um painel de detalhe fixo, onde
    "Editar" troca pra edição no lugar — o modal só aparece pra "Nova
    senha" e pro que é destrutivo. Busca em todos os grupos de uma vez
    (título, usuário, site, notas), com o nome do grupo em cada resultado.
    Favorita é uma tag do próprio `.kdbx` (o KeePassXC também mostra);
    Recentes vem do último uso de verdade (copiar a senha, abrir o site).
  - **Gerador de senha** embutido no formulário — aleatória (tamanho,
    classes de caractere, evitar ambíguos) ou frase-senha (palavras em
    português) — com **barra de força** (4 níveis) e aviso quando a senha
    já está em outra entrada. **Data de validade** opcional, avisada na
    tela quando vence ou já venceu. **Campos personalizados** (protegidos
    ou não) além dos cinco padrão, e **anexos** — arquivos pequenos
    guardados como binários do próprio `.kdbx` (até 5 MB).
  - **Favicon por entrada**, buscado do próprio site (mesmo mecanismo de
    Links) e guardado como ícone dentro do cofre — nunca em disco fora
    dele. **TOTP**: cola o segredo ou a URI `otpauth://` inteira, código
    de 6 dígitos com barra de tempo calculado no navegador. **Histórico**:
    cada edição empilha uma versão no próprio `.kdbx`, com "Restaurar"
    (a atual também vira histórico, então dá pra desfazer a
    restauração). **Lixeira do cofre** exposta — restaurar, apagar de
    vez ou esvaziar tudo, usando a lixeira interna do formato.
  - **Relatório de saúde**, calculado na hora a partir do que já está na
    tela: fracas, repetidas, sem trocar há mais de um ano, sem site e
    vencidas. **Verificação de vazamentos** (Have I Been Pwned, por
    k-anonimato — só 5 caracteres do hash saem da máquina) fica atrás de
    um botão com a explicação, nunca automática.
  - **Extensão de navegador** (pasta `extensao/`, Chrome/Manifest V3):
    percebe uma senha sendo enviada num site e oferece salvar no cofre
    (cria ou atualiza, por site + usuário); sugere preencher quando já
    existe uma entrada pro site aberto. Fala com o app por rotas locais
    dedicadas (`/senhas/extensao/…`), só funciona com o cofre destrancado.
  - Exibir/ocultar e copiar a senha com um clique (a área de transferência
    se limpa sozinha depois de um tempo); criar, renomear, mover e excluir
    grupo/senha por arrastar ou pelo menu. **Trava configurável** (5/15/30
    minutos ou nunca, mais "trancar ao fechar a aba") em
    `_senhas/config.json`, fora do `.kdbx` por não ser segredo; "Trocar
    senha mestra" recifra o cofre inteiro sem perder o conteúdo.
    Exportação em CSV texto puro existe como plano B, com aviso de que sai
    sem cifra nenhuma. Excluir o cofre inteiro é sem lixeira, sem desfazer
    — por isso exige digitar uma palavra de confirmação antes de liberar o
    botão. Escrita em disco é adiada ~1s após a última mudança (o KDF do
    Argon2id é caro de recalcular a cada save) — as mudanças aparecem na
    tela na hora, vindas da cópia em memória, então a navegação não fica
    lenta esperando o disco. "Manter aberto por" no cabeçalho (15 min a
    8 h) estende a trava só nesta sessão — recarregar a página ou
    reiniciar o app volta ao valor da config ("Trava e privacidade").
- **Links** (`/links`): um gerenciador de favoritos — pastas e subpastas
  (aninhamento livre, mesma forma de árvore do cofre de senhas, mas sem
  cifra: um único JSON, `_links/arvore.json`), cada uma com cor e ícone
  próprios. Um link guarda título, URL, favicon e capa (`og:image`,
  buscados sozinhos no próprio site ao colar a URL, sempre editáveis —
  nunca um serviço de terceiros), nota opcional (pré-preenchida da
  `og:description` quando existe), estrela de favorito e "ler depois".
  - **Navegação**: trilha de pastas clicável no cabeçalho da coluna,
    subpastas da pasta aberta como tiles antes dos links (desce sem
    precisar da árvore ao lado), contagem de links sempre visível na
    árvore. Colar (`Ctrl+V`) ou arrastar uma URL solta sobre a coluna cria
    o link ali na hora, sem diálogo — busca título e favicon sozinho.
    "Abrir todos" no cabeçalho (confirma acima de 8 links).
  - **Três visões** por pasta (Lista, Mosaico, Compacta — lembrada por
    pasta), e quatro ordenações (manual por arrastar, nome, data de
    criação, mais aberto). "Ler depois" marca link novo como não lido
    (bolinha na lista, filtro na tela inicial) até ele ser aberto pela
    primeira vez. Aviso de link repetido ao criar/editar, com o caminho
    da pasta onde já está. Seleção em lote (Ctrl/Shift+clique) move,
    favorita, marca lido ou exclui vários de uma vez.
  - **Manutenção**: "Verificar links quebrados" faz um HEAD (concorrência
    limitada) em cada link da pasta e sinaliza os que não responderam;
    exportar favoritos em `.html` (mesmo formato Netscape do importar,
    fecha o ciclo). Atalhos de teclado: `Ctrl+F` busca, `Backspace` sobe
    uma pasta, `n` cria link, e passando o mouse sobre uma linha da Lista:
    `o` abre, `e` edita, `f` favorita.
  - Um clique abre o link em nova aba e marca como lido; editar/mover/
    excluir é ação separada. Tela inicial mostra favoritos e recentes
    (achatando a árvore inteira) com um mosaico de não lidos. Na coluna,
    a raiz ("Geral") aparece como uma pasta comum só com os links soltos
    dela, e as pastas de primeiro nível ficam ao lado, não dentro — "nova
    pasta" no Início nasce na raiz de verdade. Toda pasta (raiz inclusive)
    renomeia, troca ícone e cor pelo menu. Trocar de pasta é
    `history.pushState`, não navegação do roteador: sem ida ao servidor,
    instantâneo mesmo com centenas de pastas. URL colada sem esquema
    ("www.google.com") ganha `https://` ao salvar, ao buscar favicon e ao
    checar duplicidade. Excluir sempre vai para uma lixeira própria
    (recuperável); pasta com conteúdo dentro exige digitar o nome pra
    confirmar, igual excluir um caderno. Dá para importar de uma vez um
    arquivo de favoritos exportado do navegador (`.html`, formato padrão
    Netscape), recriando a árvore de pastas.
  - **Atalhos de navegador** (`/links/atalho`, independentes do Web
    Clipper das Anotações): dois botões pra barra de favoritos — "Salvar
    como link" abre uma janela pop-up pequena por cima da página atual
    (escolhe a pasta, salva, fecha sozinha, sem trocar de aba nem virar
    nota) e "Abrir meus links" — este um endereço comum pra `/links-popup`
    (favorito `javascript:` não recebe ícone em navegador nenhum; um
    endereço normal ganha o ícone do app). A janelinha é a árvore de
    pastas toda fechada, sem favoritos nem recentes na frente: clicar numa
    pasta abre ela ali mesmo; clicar num link abre e fecha a janela
    sozinha. A extensão de navegador (ver Senhas, mesma pasta
    `extensao/`) ganhou uma aba "Links" no popup da barra e um painel
    lateral (`chrome.sidePanel`) com o mesmo `/links-popup` embutido —
    útil pra manter os favoritos à mão numa coluna fixa ao lado da aba.
- **Compras** (`/compras`): uma lista de desejos — o lugar de anotar o
  produto antes de esquecer. Um JSON só (`_compras/compras.json`, mesmo
  esquema de Links) e as imagens em `_compras/imagens/`. Cada produto tem
  nome, modelo/especificação livre (o detalhe que se esquece: tamanho,
  cor, versão), categoria única com cor, prioridade (quero muito / quero /
  talvez um dia), foto, observações e uma lista "onde comprar" opcional —
  URL, loja e preço visto por loja. Colar o primeiro link busca nome e
  foto na própria página (`og:title`/`og:image`, o mesmo fetch de Links);
  produto sem link é válido.
  - **Tela**: lista compacta agrupada por categoria, na ordem que a
    pessoa define (tela "Categorias": criar, renomear, cor, excluir —
    produtos ficam sem categoria, não somem —, subir/descer); dentro do
    grupo, prioridade primeiro e depois o mais recente. Cada linha:
    miniatura, nome, modelo, selo de prioridade, menor preço visto e a
    loja. Ações: comprei (data, preço pago e loja, pré-preenchidos com o
    melhor preço visto), desisti, editar, excluir (sem lixeira — "desisti"
    é o jeito de tirar da lista sem perder).
  - **Histórico**: comprados e desistidos, com data, preço pago e loja;
    "voltar para a lista" reabre. A busca global (`Ctrl K`, prefixo `$`)
    acha por nome, modelo ou loja e abre o produto; "Novo produto" também
    está na paleta de qualquer lugar; `n` cria dentro da tela; `Alt+5` vai
    pra Compras.
  - **Extensão** (mesma pasta `extensao/`): aba "Compras" no popup, que
    embute `/salvar-produto` com a URL e o título da aba aberta — nome e
    imagem já vêm buscados, resta escolher categoria, prioridade e anotar
    o preço. URL que já está em algum produto vira "adicionar como outra
    loja" em vez de duplicar.
- **Saúde** (`/saude`): o histórico médico pessoal — de uma pessoa só
  (sem campo "paciente"). A árvore começa pela **especialidade** (nome
  livre com ícone e cor: Cardiologia, Dentista, Fisioterapia — do jeito
  que se pensa, não a lista oficial) e dentro dela os **registros**:
  consulta, exame, procedimento ou vacina, cada um com título, data e
  hora, profissional, local, status (solicitado → agendado → realizado /
  cancelado; exame tem ainda "aguardando resultado"), observações em
  markdown e **anexos** (laudo, receita, foto — arquivos reais em
  `_saude/anexos/<registro>/`, sem cifra: a fricção de destrancar um cofre
  pra ver um exame de rotina mataria o uso; quem quer esconder algo anexa
  no cofre de Senhas). Um JSON só (`_saude/saude.json`), como Links e
  Compras. Upload é rota multipart, não Server Action (limite de 1 MB no
  corpo); o arquivo abre em nova aba.
  - **Cadastros de apoio**, no rodapé da coluna: **Locais** (nome,
    endereço, telefone, observações — "estacionamento pago") e
    **Profissionais** (nome, especialidade, local habitual, contato — o
    WhatsApp da secretária que se perde). Escolher o profissional num
    registro já preenche o local.
  - **Consulta cria o que vem depois**: "retorno em" gera a consulta de
    retorno já agendada; "pedidos" (um por linha) viram exames
    "solicitado", ligados à consulta que os pediu — o exame mostra "pedido
    em: …" e a consulta lista os pedidos com o status de cada um.
  - Layout de Senhas: coluna de especialidades, lista de registros da
    aberta (sem data no topo — o que falta marcar não pode sumir no
    rodapé), detalhe à direita com troca rápida de status. Data preenchida
    sugere "agendado", vazia "solicitado". Título vazio vira o nome do
    tipo. Busca global (`Ctrl K`, prefixo `+`) acha por título,
    observações, profissional ou especialidade e abre o registro; `n`
    cria dentro da tela; `Alt+6` vai pra Saúde.
  - **Próximos** (a tela que abre por padrão quando há registros — é o
    que se olha antes de ligar pra clínica): "Está na hora", agendados
    por data (os já passados esmaecidos), aguardando resultado e
    solicitados sem data. **Linha do tempo**: tudo, de todas as
    especialidades, por mês. Nas duas, a linha diz de qual especialidade
    é o registro.
  - **Alerta por especialidade** ("Alerta…" nas opções dela): N meses sem
    consulta *realizada* — exame não zera o relógio — e a especialidade
    aparece em "Está na hora" com a data da última consulta (ou "nenhuma
    registrada"), botão "Agendar" já com ela pré-escolhida e "Ajustar".
    Uma consulta agendada pra frente silencia o alerta. Só dentro do
    subapp: bolinha laranja no nó Próximos, nada no trilho.
  - **Lixeira** própria (`_saude/lixeira.json`): excluir um registro (ou
    uma especialidade com registros) manda pra lá com os anexos ainda em
    disco; restaurar volta pra especialidade de origem (ou por nome, se
    ela foi recriada); apagar de vez / esvaziar é o que apaga os arquivos.
  - **Pessoas**: o app cria "Eu" sozinho (renomeável) e adota o que já
    existia; a família entra em "Pessoas" (nome e data de nascimento —
    mostra a idade) ou pelo "+" do seletor. Só o **registro** é de uma
    pessoa; especialidades, locais e profissionais valem pra todos. O
    **seletor no cabeçalho** ("Todos · Eu · Maria"), lembrado no
    navegador, filtra tudo — árvore, Início, linha do tempo, alertas,
    exportação — e o registro novo já nasce da pessoa escolhida. Em
    "Todos" com mais de uma pessoa, cada linha diz de quem é. O alerta
    "está na hora" é **por pessoa** (Maria atrasada, você em dia), e só
    numa especialidade em que a pessoa tenha algum registro — o filho não
    está atrasado no cardiologista. Pessoa com registros não se exclui.
  - **Plano de saúde**: lista editável ("Planos de saúde" no rodapé),
    nascendo com Sulamérica, IPM e Particular. É campo do **registro**,
    sempre em branco até ser escolhido — a pessoa não tem plano: cada
    consulta diz por qual foi. Aparece no detalhe e no exportado; sem
    filtro por plano por enquanto.
  - **Exportar histórico** ("Exportar histórico…" nas opções da
    especialidade, "Exportar tudo" na linha do tempo), sempre da pessoa
    do filtro: **página para imprimir** (`/saude-imprimir`, Ctrl+P → PDF
    pra levar ao médico), **.md** (rota `/saude/exportar`) ou **.zip**
    com o .md e os anexos numa pasta por registro. Ordem cronológica
    crescente, como um prontuário se lê; cada registro com tipo, pessoa,
    status, profissional, local, plano, observações e anexos pelo nome.
    "Início" (o antigo Próximos) ganhou "Últimos registros" embaixo.
- **Cadernos e quadros reordenáveis arrastando** — mesmo gesto de arrastar
  seção/página, na lista da coluna esquerda. O primeiro da lista é o que
  abre quando se clica na aba da aplicação (Anotações ou Kanban) vindo de
  outro lugar do app.
- Histórico de versões automático durante a edição (restaurável) e lixeira
  para pastas e páginas excluídas.
- Se um arquivo `.md`/`.txt` for criado ou editado por fora do app
  (Explorador de Arquivos, outro editor), o app adota a mudança na próxima
  abertura — o disco manda, não o app. A varredura que reconcilia disco e
  índice vale por 1 segundo: uma tela que lê a árvore, os favoritos e os
  recentes de uma vez varre o disco uma vez só, em vez de três.
- **Cartão tem borda própria** (`--borda-cartao`), mais forte que a borda
  comum (`--linha`) só no tema claro — um cartão branco sobre o fundo
  levemente frio do papel quase se confundia com o fundo. No tema escuro é
  a mesma borda de sempre, porque ali o cartão já contrasta pela cor de
  fundo. Vale para os dois tipos de cartão do app: página nas Anotações e
  tarefa no Kanban.
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
