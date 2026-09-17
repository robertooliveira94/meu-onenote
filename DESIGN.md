---
name: Meu bloco de anotações
description: Bloco de anotações pessoal local, no espírito do OneNote — cadernos, seções e páginas como pastas e arquivos de verdade.
colors:
  papel: "#f3f5f9"
  superficie: "#ffffff"
  superficie-alta: "#ffffff"
  tinta: "#16202e"
  tinta-secundaria: "#5b6a7f"
  tinta-discreta: "#909cad"
  linha: "#e4e9f0"
  linha-forte: "#c9d2df"
  realce-verde-agua: "#0ea47c"
  realce-azul: "#2d7ff9"
  realce-violeta: "#7c5cfc"
  realce-rosa: "#e93d82"
  realce-laranja: "#f5822c"
  realce-vermelho: "#e5484d"
  etiqueta-ambar: "#f5b921"
  etiqueta-verde: "#46a758"
  perigo: "#e5484d"
typography:
  titulo-pagina:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "25px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  titulo-dialogo:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  corpo:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  leitura:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.72
    letterSpacing: "normal"
  rotulo:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.realce-verde-agua}"
    textColor: "#ffffff"
    typography: "{typography.corpo}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "34px"
  button-primary-hover:
    backgroundColor: "{colors.realce-verde-agua}"
  button-secondary:
    backgroundColor: "{colors.superficie-alta}"
    textColor: "{colors.tinta}"
    typography: "{typography.corpo}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "34px"
  button-secondary-hover:
    backgroundColor: "{colors.papel}"
  input:
    backgroundColor: "{colors.superficie-alta}"
    textColor: "{colors.tinta}"
    typography: "{typography.corpo}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "38px"
  card:
    backgroundColor: "{colors.superficie-alta}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  tag:
    textColor: "{colors.tinta}"
    typography: "{typography.rotulo}"
    rounded: "{rounded.sm}"
    padding: "2.5px 8px"
---

# Design System: Meu bloco de anotações

## Overview

**Creative North Star: "A Lombada Colorida"**

O app é uma sala branca — superfícies neutras, bordas finas e visíveis,
quase nenhuma sombra em repouso — onde a única cor com licença para
aparecer sem pedir desculpas é a de cada caderno. Essa cor nasce como uma
bolinha discreta na árvore da barra lateral e depois viaja: vira a barra
vertical do item ativo, o carimbo de 3px no topo do cartão da página aberta
e, na leitura, a margem esquerda que corre ao lado do texto inteiro — como
a lombada de um caderno de verdade te lembrando, o tempo todo, onde você
está. Nenhuma outra cor de marca compete com ela; interface, ícones e texto
ficam em tons neutros de tinta sobre papel.

O caráter dos componentes é preciso na forma — bordas finas, cantos
generosos mas comedidos (8–16px), nada arredondado a mais — e tátil na
resposta: todo elemento clicável confirma o toque visivelmente (o cartão
sobe 1px e ganha sombra no hover, o botão primário clareia no hover e
escurece no clique, o campo de texto ganha um anel de foco na cor do
caderno ativo). A firmeza vem da forma; o calor vem do feedback.

**Key Characteristics:**
- Uma cor de destaque por caderno/quadro/pasta, nunca uma paleta de marca
  fixa — a cor muda com o contexto e atravessa a interface inteira, hoje
  nas quatro aplicações do hub (Anotações, Kanban, Senhas, Links).
- Fundo branco de verdade no tema Claro (não bege, não cinza-escuro por
  padrão); o branco só existe como "cartão" porque o `--papel` ao redor
  dele é levemente mais frio/escuro. Os outros cinco temas trocam essa
  base, sempre preservando a mesma relação entre papel/superfície/tinta.
- Camada plana em repouso; sombra é sempre uma resposta a estado (hover)
  ou uma propriedade de flutuar acima do conteúdo (menu, diálogo) — em
  qualquer um dos seis temas, incluindo o Vibrante, onde a sombra de hover
  fica colorida em vez de neutra, mas continua só existindo em resposta a
  estado.
- Tipografia única — Plus Jakarta Sans cobre interface e leitura; a
  diferenciação vem do tamanho e peso, não de trocar de família.

## Colors

Paleta de sala branca: neutros dominam a área construída (fundo, bordas,
texto), e seis cores saturadas circulam como identidade de caderno — nunca
como decoração fixa de tela.

### Primary
- **Verde-Água** (`#0EA47C`): a cor padrão do primeiro caderno criado, do
  botão de ação primária ("Novo caderno", "Criar", "Salvar") e do anel de
  foco em campos de texto quando nenhum caderno está com o contexto aberto.

### Secondary — paleta de cadernos (cíclica)
- **Azul** (`#2D7FF9`)
- **Violeta** (`#7C5CFC`)
- **Rosa** (`#E93D82`)
- **Laranja** (`#F5822C`)
- **Vermelho** (`#E5484D`) — coincide com a cor de perigo; ao aparecer como
  caderno, o vermelho é identidade, não alarme; como `--perigo`, é sempre
  ação destrutiva. O contexto (ícone de lixeira vs. bolinha de caderno)
  nunca deixa ambíguo qual dos dois está em jogo.

Cada caderno recebe uma dessas seis na criação, em ordem cíclica, e pode
trocar livremente depois. Duas cores extra (`#F5B921` âmbar e `#46A758`
verde) só aparecem no cadastro de etiquetas, que tem paleta própria e mais
ampla que a de cadernos.

### Neutral
- **Papel** (`#F3F5F9` · escuro `#0E1420`): fundo da página, atrás de tudo.
- **Superfície** (`#FFFFFF` · escuro `#151D2B`): barra lateral e painéis.
- **Superfície Alta** (`#FFFFFF` · escuro `#1B2434`): cartões, campos,
  diálogos, menus — o que "flutua" um nível acima do painel.
- **Tinta** (`#16202E` · escuro `#E9EEF6`): texto principal.
- **Tinta Secundária** (`#5B6A7F` · escuro `#9FADC0`): texto de apoio,
  legendas, metadados.
- **Tinta Discreta** (`#909CAD` · escuro `#71809A`): placeholders, dicas,
  texto quase decorativo.
- **Linha** (`#E4E9F0` · escuro `#243044`): borda padrão de tudo.
- **Linha Forte** (`#C9D2DF` · escuro `#35455E`): borda em hover.

No tema escuro, todo neutro troca de valor mas a relação entre eles se
preserva; `--realce` (a cor do caderno) é a única variável que muda de
significado por contexto, não por tema — ela é redefinida por JavaScript
por cima do CSS, não pela media query de tema.

### Named Rules
**A Regra da Lombada.** A cor de um caderno (ou quadro, ou pasta de Links)
nunca fica presa a um só lugar. Ela precisa aparecer em pelo menos três
destes cinco pontos para estar "completo" visualmente: a bolinha/ícone na
árvore, a barra do item ativo, o carimbo do cartão aberto, a margem da
leitura, e a faixa fina de 3px atravessando o topo do app inteiro
(`casca.tsx`) — o ponto mais recente, e o único que existe fora da área de
conteúdo da própria aplicação.

**A Regra da Cor Única.** No máximo uma cor saturada de caderno está
"ativa" (definida em `--realce`) por vez, em toda a tela. Duas cores de
caderno nunca competem lado a lado como decoração — quando aparecem juntas
(ex.: lista de cadernos na barra lateral), é sempre como bolinhas pequenas
e discretas, nunca como blocos de fundo.

### Seis Temas
Cada tema redefine o mesmo conjunto de neutros (`--papel`, `--superficie`,
`--superficie-alta`, `--tinta`, `--tinta-2`, `--tinta-3`, `--linha`,
`--linha-forte`, `--borda-cartao`, `--perigo`, as três sombras) atrás de
`[data-tema]` — a relação entre eles se preserva, só o valor muda:
- **Claro** (`#F3F5F9` papel): o padrão, descrito acima.
- **Escuro** (`#0E1420` papel, `#E9EEF6` tinta): inversão direta do claro.
- **Escuro Suave** (`#2A2F3A` papel): a mesma família do escuro, em
  cinza-azulado, sem chegar perto do preto — para quem acha o escuro
  padrão contrastado demais à noite.
- **Sépia** (`#EFE4CF` papel, `#392F21` tinta marrom): pensado para leitura
  longa, mesmo espírito de um papel envelhecido.
- **Cinza Neutro** (`#ECECEC` papel): como o Claro, mas sem o azul frio do
  papel — um branco/cinza mais neutro.
- **Vibrante** (`#191033` papel roxo-profundo, `#F4ECFF` tinta clara):
  o tema mais saturado da família — `--realce-fraco`/`--realce-medio`
  misturam mais forte (26%/44%, contra 12%/24% no Claro) e a sombra de
  cartão passa a brilhar na cor do caderno/quadro aberto
  (`0 0 18px color-mix(in srgb, var(--realce) 32%, transparent)`) em vez
  de neutra — é a mesma Regra do Plano em Repouso (sombra só em resposta a
  hover), só que a cor da sombra deixa de ser neutra e vira a cor ativa.
  `data-escuro` marca Escuro, Escuro Suave e Vibrante como família escura
  para os poucos ajustes que valem pros três juntos (o realce de sintaxe
  do código).

O fundo da área de escrita (editor de markdown/texto puro) pode ser fixado
à parte do tema da interface — Claro, Escuro, Sépia ou "acompanhar o
tema" (padrão) — via `[data-fundo-editor]`, sua própria variável
(`--fundo-editor`/`--tinta-editor`). É a única superfície do sistema com
essa independência do tema, porque uma pessoa pode preferir escrever num
fundo diferente do resto da interface (ex.: sépia para os olhos, mesmo
com o app inteiro no tema escuro).

## Typography

**Interface e Leitura:** Plus Jakarta Sans (com `ui-sans-serif, system-ui,
sans-serif` como reserva)
**Monoespaçada:** JetBrains Mono (com `ui-monospace, monospace` como
reserva)

**Character:** Uma família só cobre interface e leitura — a diferenciação
entre "isto é a ferramenta" e "isto é o texto que você escreveu" vem do
tamanho, peso e entrelinha, não de trocar para uma serifada. A mono entra
só onde o conteúdo é literalmente código ou texto cru (editor de markdown,
blocos de código, atalhos de teclado).

### Hierarchy
- **Título de página** (800, 25px, `line-height: 1.2`, `-0.03em`): título
  das telas de nível superior (Início, Etiquetas, Lixeira) e da página
  aberta (24px ali, levemente menor por dividir espaço com os botões de
  ação ao lado).
- **Título de diálogo** (700, 16–17px, `-0.02em`): cabeçalho de modal e de
  estado vazio.
- **Nome de seção** (700, 14px, `-0.02em`): cabeçalho da lista de páginas.
- **Corpo/interface** (400, 13px, `line-height: 1.5`): texto padrão de
  botões, menus, listas — a maior parte da UI.
- **Leitura** (400, 15.5px, `line-height: 1.72`): corpo de uma página em
  modo leitura; medida generosa para conforto de leitura longa. Títulos
  dentro do markdown renderizado usam 700 e `-0.02em`, com h1 em 1.66em,
  h2 em 1.32em, h3 em 1.12em relativos ao corpo da prosa.
- **Rótulo** (500, 11px, `letter-spacing: 0.02em`, versalete): legendas de
  campo de formulário, sempre em caixa alta.

### Named Rules
**A Regra da Família Única.** Nunca introduzir uma segunda família
tipográfica para "elevar" uma tela. Peso e tamanho carregam toda a
hierarquia; a mono é a única exceção, reservada a conteúdo literal.

## Layout

Até quatro colunas em telas de trabalho de Anotações: o trilho de
aplicativos (56px, fixo, só ícones) fica sempre mais à esquerda; depois
dele, a coluna de seções (248px de partida — carrega cadernos em cima e
seções embaixo) e a lista de páginas (292px de partida) são
**redimensionáveis arrastando a borda direita**, como uma coluna de
planilha; a área de conteúdo sempre ocupa o resto do espaço. Num notebook
de 1366px a moldura toda soma 596px e sobram ~770px pra nota (a coluna
larga de aplicativos de antes, 214px, comia 158px disso). Kanban tem a
própria coluna de quadros (220px de partida) no lugar da de seções;
Senhas e Links dispensam coluna — a área de conteúdo delas já tem a
própria navegação (árvore de grupos/pastas) embutida. Sem grade
responsiva além disso; o app assume uma janela de desktop (é um serviço
local, não uma página pública).

**Nota:** cabeçalho de duas linhas (título 24px extrabold + ações;
metadados em 11.5px `tinta-3`), 86px de altura. Em leitura, o `<article>`
leva `.coluna-leitura` — `max-width: calc(36 * 15.5px * var(--escala-texto))`,
~70 caracteres por linha, centralizado, com a `.spinha-lombada` acompanhando.
A edição lado a lado não limita: cada painel já é estreito. Modo foco é um
`data-foco="1"` no `<html>`; tudo que some leva `.esconde-no-foco`, e uma
regra só de CSS esconde. Callouts: `.callout` com faixa esquerda de 3px em
`--cor-callout`, fundo de 8% da mesma cor, título em versalete com ícone;
uma cor por tipo (nota = `--realce`, dica ciano `#0e9aa7`, aviso âmbar
`#c98a1a`, perigo `--perigo`, info azul `#2d7ff9`, importante roxo
`#8a5cf6`). Diff de versões: linha que volta em wash de `--realce`, linha
que some em wash de `--perigo` riscada.

**Densidade** é uma preferência da pessoa, não uma classe por tela: quatro
variáveis em `:root` (`--esp-cartao-y: 10px`, `--esp-cartao-x: 14px`,
`--esp-lista: 6px`, `--esp-nav-y: 6px`) dão o padding interno de `.cartao`,
o vão de `.lista-cartoes` e o padding vertical de `.linha-nav`;
`[data-densidade="compacta"]` no `<html>` aperta pra 6/10/3/3. Nada de
fonte muda. Aplicada antes da primeira pintura pelo mesmo script do tema
(`localStorage` chave `densidade`). Altura de controle padrão continua
34–38px. `.lista-cartoes > *` leva `content-visibility: auto` — listas
longas só fazem layout do que está na tela.

A largura de cada coluna é lembrada por painel (`localStorage`, chaves
`largura-coluna-secoes`, `largura-lista-paginas` e
`largura-coluna-quadros`), clampada entre um mínimo e um máximo por painel
para nunca colapsar nem engolir a tela inteira. Duplo clique na borda volta
ao valor de partida.

O modo de edição de uma nota em markdown divide a área de conteúdo em duas
colunas iguais — texto cru à esquerda, prévia renderizada à direita — sem
proporção assimétrica.

**Recolher para escrever**: cada coluna (seções, páginas, quadros) recolhe
por conta própria pra uma faixa de 40px com o nome na vertical — o botão
de reabrir nunca some. `[` recolhe a coluna da aplicação (seções ou
quadros), `]` a lista de páginas. O trilho de aplicativos nunca recolhe.
Estado por coluna (`localStorage`, chaves `coluna-secoes-recolhida`,
`coluna-paginas-recolhida`, `coluna-quadros-recolhida`); enquanto
recolhida, o conteúdo fica com `inert` — não só invisível, também fora da
ordem de tab.

**Zoom do texto**: três controles no cabeçalho da nota (`-`, percentual,
`+`) e `Ctrl`/`⌘` + roda do mouse sobre a área de texto aumentam ou diminuem
o tamanho de leitura, prévia e editor juntos — uma preferência da pessoa
(`--escala-texto`, `documentElement`), não da nota. Clicar no percentual
volta a 100%.

## Elevation & Depth

Sistema quase todo plano: superfícies se diferenciam por cor de fundo e
borda de 1px, não por sombra. Sombra real existe só como resposta a
estado — hover de cartão — ou como propriedade de camadas que flutuam
acima do conteúdo — menu suspenso, diálogo modal, painel de busca. Nada
tem sombra "de repouso" perceptível além de um traço quase invisível
(`--sombra-cartao`) que separa cartão de fundo sem chamar atenção para si.

### Shadow Vocabulary
- **Cartão em repouso** (`0 1px 2px #16202e0a`): quase imperceptível,
  só o suficiente para o cartão não se fundir ao fundo.
- **Cartão em hover / ativo** (`0 2px 4px #16202e0d, 0 8px 20px #16202e14`):
  a resposta ao hover, junto com a subida de 1px do cartão.
- **Flutuante** (`0 2px 4px #16202e0d, 0 16px 40px #16202e1a`): diálogos,
  menus suspensos, painel de busca — a sombra mais forte do sistema,
  reservada a coisas que estão literalmente por cima de tudo.

No tema escuro os três valores usam preto puro em vez de `--tinta`
(`#00000040`, `#0000004d`, `#00000073`), porque uma sombra colorida em
tinta clara não lê como profundidade sobre um fundo já escuro. No tema
Vibrante a sombra de cartão vai um passo além: continua só aparecendo em
hover/estado, mas a cor deixa de ser neutra e passa a ser a própria
`--realce` (`0 0 18px color-mix(in srgb, var(--realce) 32%, transparent)`)
— o cartão brilha na cor do caderno/quadro aberto em vez de só ganhar
profundidade neutra. Mesma regra (sombra é resposta a estado), só que a
paleta de sombra do tema é saturada em vez de neutra.

### Named Rules
**A Regra do Plano em Repouso.** Nada tem sombra visível parado. Se uma
sombra aparece, é porque algo mudou de estado (hover) ou está flutuando
acima da camada normal de conteúdo.

## Shapes

Escala de cantos em quatro passos, sempre generosa mas nunca ao ponto de
parecer um app infantil ou lúdico: 6px em elementos pequenos e densos
(etiqueta, item de menu), 8px no padrão de botão/campo/emblema de caderno,
12px em cartões e no painel do menu suspenso, 16px em diálogos e no
selo-ícone do estado vazio. Bordas de 1px em quase tudo que não é
totalmente plano contra o fundo — o traço, não a sombra, é o que separa
uma superfície da outra.

Um detalhe recorrente: bordas de um lado só (`border-left`) marcam
continuidade de cor sem fechar uma caixa — é como a margem da leitura e a
citação em bloco do markdown comunicam "isto pertence a esta cor" sem
desenhar um cartão inteiro ao redor.

## Components

### Buttons
- **Shape:** cantos de 8px (`rounded-lg`), altura de 34px.
- **Primário:** fundo sólido na cor de destaque ativa (`--realce`), texto
  branco, sombra quase nula (`0 1px 2px`). Usado no máximo uma vez por
  contexto — criar caderno, criar página, confirmar uma ação.
- **Normal/Secundário:** fundo `superficie-alta`, borda `linha`, texto
  `tinta`. É o padrão para tudo que não é a ação principal da tela.
- **Sutil:** sem fundo nem borda em repouso; só ganha um wash de cor
  (`realce-medio`) no hover. Usado em "Cancelar" e ações de baixo
  compromisso dentro de diálogos.
- **Perigo:** texto e borda na cor de perigo, sem preenchimento — reserva
  o vermelho sólido só para dentro de um diálogo de confirmação, nunca
  como botão de ação direta na tela.
- **Hover / Focus:** `brightness(1.08)` no primário, troca de fundo/borda
  nos demais; sempre uma transição curta (~150ms). Clique aplica
  `brightness(0.95)` — o toque sempre recebe confirmação visível.

### Icon Buttons
- **Shape:** quadrado de 28px, cantos de 8px.
- **Estado:** transparente em repouso, wash `realce-medio` no hover;
  sempre com `aria-label` — nunca um ícone sozinho sem nome acessível.

### Cards
- **Corner Style:** 12px.
- **Background:** `superficie-alta` (branco/quase-branco mesmo sobre o
  papel levemente frio ao redor).
- **Border:** 1px `linha`, vira `linha-forte` (misturada com a cor do
  caderno a 45%) no hover.
- **Shadow Strategy:** ver Elevation — quase nula em repouso, sobe junto
  com a elevação de 1px no hover.
- **Estado ativo (página aberta):** ganha um carimbo de 3px na cor do
  caderno encostado no topo interno do cartão (`inset 0 3px 0 --realce`),
  além da sombra de hover permanente — o cartão "sabe" que está selecionado
  sem precisar mudar de cor de fundo.
- **Internal Padding:** 12–14px.

### Tags / Chips
- **Style:** pastilha de cantos 6px, fundo na cor da etiqueta a 14% de
  opacidade, texto na mesma cor misturada a 82% com a tinta do tema (nunca
  a cor pura — sempre escurecida/clareada o suficiente para contraste).
- **State:** um `×` de remoção só aparece quando a etiqueta está aplicada
  a algo removível; senão a pastilha é só rótulo.

### Inputs / Fields
- **Style:** fundo `superficie-alta`, borda 1px `linha`, cantos 8px,
  altura 38px.
- **Focus:** a borda muda para a cor de destaque ativa e ganha um anel
  suave de 3px na mesma cor a baixa opacidade (`realce-medio`) — nunca um
  contorno genérico do navegador.
- **Rótulo:** sempre acima do campo, em versalete 11px.

### Alça de Redimensionar
- **Onde aparece:** coluna de seções, coluna de páginas, e agora também
  entre o texto cru e a prévia na edição lado a lado de uma página em
  markdown — mesmo componente, mesmo comportamento, só mudando qual painel
  ele ajusta.
- **Faixa clicável:** 6px, encostada na borda direita do painel, com
  `cursor: col-resize`. Mais larga que a
  linha visível — não exige mirar num traço de 1px, como em qualquer app de
  planilha.
- **Estado:** invisível em repouso (a borda de 1px do painel já marca a
  divisão); no hover ou durante o arraste, um traço de 2px na cor de
  destaque ativa (`--realce`) aparece por cima da borda — o mesmo sinal
  visual do anel de foco dos campos, então já é um vocabulário reconhecido.
- **Duplo clique:** volta a largura ao valor de partida do painel.
- **Persistência:** por painel, em `localStorage` — reabrir o app mantém o
  ajuste.

### Navigation
- **Trilho de aplicativos (56px, sempre o mais à esquerda):** um botão
  quadrado de 40px por aplicativo (Anotações, Kanban, Senhas, Links), só
  ícone de 18px — nome e contagem vão pro tooltip/`aria-label` ("Kanban ·
  3 quadros"); sem nome/logo do produto por cima. O ativo ganha fundo
  sólido escurecido na cor de destaque (`color-mix(in srgb, var(--realce)
  70%, black)`) e ícone branco. Botão direito abre um `Menu` com "Abrir em
  nova janela" — o botãozinho de hover da coluna larga não cabe aqui. O
  ícone do Kanban recebe um ponto de 8px em `--perigo` (com anel de 2px na
  cor da superfície) no canto superior direito quando há tarefa atrasada em
  qualquer quadro; a contagem vai pro tooltip. Rodapé: botão da folha de
  atalhos (`Keyboard`) e o menu de Preferências (`Palette`) — tema (6
  opções), densidade (2) e o liga/desliga de "Avisar prazos do Kanban" —
  visível em qualquer aplicativo.
- **Coluna de seções (só em Anotações):** botão "Buscar" (abre a paleta),
  a lista de cadernos (até 38% da altura, rolagem própria), depois as
  seções do caderno aberto, e os atalhos fixos no rodapé (Início,
  Etiquetas, Grafo, Tarefas, Modelos, Web Clipper, Exportar tudo, Lixeira).
  Item de seção ativo ganha a mesma barra vertical de 2.5px na cor do
  caderno + wash de fundo que o resto do sistema usa pra "você está aqui".
  Recolhida, a faixa mostra "caderno › seção" na vertical.
- **Coluna de quadros (só no Kanban):** mesmo esqueleto — cabeçalho, a
  lista de quadros com a cor de cada um, rodapé com "Hoje" e "Etiquetas do
  Kanban".
- **Painel da tarefa (Kanban):** `aside` de 460px à direita das colunas,
  com o `cartao-aberto` (wash forte do realce) como fundo, borda esquerda
  `--linha`; cabeçalho com identificador em mono 10px `tinta-3`, título
  editável 15px bold, botões de expandir e fechar. Campos curtos em
  `grid-cols-2`; os largos (impedimento, etiquetas, bloqueado por,
  repetir, cor) em `col-span-2`. A tela cheia é o `Dialogo` `max-w-4xl` com
  `grid-cols-[1fr_220px]`.
- **Cartão do Kanban:** identificador mono 10px em cima, título 13px
  medium, chips de etiqueta/sprint, e um rodapé de 10.5px `tinta-3` com
  posições fixas — prazo · checklist · comentários à esquerda, estimativa
  (caixinha com borda) · cadeado · bandeira de prioridade à direita.
  Borda esquerda de 3px na cor da coluna (vermelha se impedida); cor
  própria como `inset 0 3px 0` no topo; selecionado = `ring-2` em
  `--realce`; envelhecido = `opacity-85`. Coluna recolhida = faixa de 40px
  com `.texto-vertical`; acima do WIP = contagem "4/3" e borda em
  `--perigo`.
- **Visões do Kanban:** alternador segmentado (borda `--linha`, item ativo
  `bg-realce-medio`) na barra de filtros. Lista = `table` de 12.5px com
  cabeçalho versalete `sticky`; calendário = grade `grid-cols-7` com
  `gap-px` sobre `bg-linha`, dia de hoje em bolinha `--realce`, chip de
  tarefa 10.5px com borda esquerda na cor da prioridade (vermelho se
  atrasada, riscado se concluída). Barra de ações em lote = pílula
  flutuante `surgir` centrada embaixo, `bg-superficie-alta` com sombra.
- **Abas de notas (só em Anotações):** faixa acima do conteúdo, `bg-superficie`
  com borda embaixo; cada aba é um `role="tab"` de 12px, `rounded-t-lg`, a
  ativa em `bg-papel` com borda `--linha` e uma faixinha da cor do papel
  apagando a borda de baixo — a aba "desce" para o conteúdo. Inativas sem
  borda, `text-tinta-2`, com o `×` só no hover. Linha de encaixe de 2px em
  `--realce` na borda esquerda/direita da aba sobrevoada ao arrastar. Some
  quando não há aba nenhuma.
- **Sumário da nota:** `aside` de 200px à direita, `bg-superficie`, borda
  esquerda; itens de 11.5px com um degrau de 10px por nível a partir do
  menor nível da nota; o ativo em `bg-realce-medio`. Só com 3+ títulos.
- **Caixa de sugestões do editor** (`[[`, `#`, `/`): `role="listbox"` de
  280px colado ao cursor (posicionado por um espelho invisível do campo),
  `bg-superficie-alta`, `rounded-xl`, cabeçalho em versalete com ícone do
  tipo, itens de 12.5px com detalhe à direita em `tinta-3`, rodapé com
  "↑↓ escolhe · Enter aplica · Esc fecha". O ativo em `bg-realce-medio`.
- **Barra de buscar/substituir:** uma linha acima do editor, dois campos
  de 150px, contagem "3 de 12" em `tinta-3` tabular, setas e botões de
  texto; some com Esc.
- **Paleta de comandos (`Ctrl+K`, `/`):** um `Dialogo` com campo de busca
  e uma lista única de resultados em seções rotuladas (`RotuloMenu`):
  Ações, Ir para, Notas, Tarefas, Links. Ações e Ir para filtram na hora
  por palavras (sem acento); as três buscas de servidor disparam juntas
  com debounce de 220ms. Linha selecionada mostra "Enter" à direita;
  rodapé lista os prefixos `>` `#` `@` `!`. É a única caixa de busca do
  hub — não há campo de busca em coluna nenhuma.
- **Folha de atalhos (`?`):** `Dialogo` com os atalhos ativos na tela,
  agrupados (Hub, Anotações, Kanban…), cada combo em `<kbd>` monoespaçado
  com borda `--linha` e `rounded-sm`. Atalhos vêm de um registro central
  (`useAtalho`), então a folha nunca lista o que não funciona ali.
- **Recolher coluna a coluna:** a coluna de seções e a de páginas
  recolhem cada uma por conta própria (não é mais um "modo foco" único que
  esconde as duas juntas) — cada botão de recolher vira uma barra fina de
  40px com só o ícone pra abrir de novo, nunca desaparece de vez. Ter
  sempre uma faixa visível é o que faz o botão de reabrir nunca ficar
  "perdido" em outro lugar da tela.
- **Mobile:** não há tratamento mobile — o app assume uso em desktop, como
  serviço local sempre aberto numa janela de navegador.

### Arrastar para reordenar e mover
- **Linha de encaixe (reordenar):** um traço de 2px na cor de destaque
  ativa (`--realce`), encostado no topo ou na base da linha sobrevoada
  (conforme o cursor está na metade de cima ou de baixo dela) — mesmo
  vocabulário visual do anel de foco e da alça de redimensionar, então já é
  um sinal reconhecido de "algo vai encaixar aqui" antes mesmo de soltar.
- **Alvo inteiro destacado (mover para outro pai):** quando o item
  arrastado é de um tipo diferente do que a linha representa (uma página
  sobre uma seção, uma seção sobre um chip de caderno), a linha de encaixe
  não faz sentido — a seção ou caderno inteiro ganha o mesmo fundo
  `realce-medio` do estado ativo, porque a soltura ali não troca de posição
  entre irmãos, muda de dono.
- **Cursor:** `cursor-grab` em repouso sobre qualquer linha arrastável,
  `cursor-grabbing` durante o arraste — a mudança de cursor já avisa que
  aquele item pode ser pego, sem precisar de um ícone de "grip" extra
  ocupando espaço numa coluna estreita.

### Kanban
- **Colunas fixas, cor só de acento:** cada coluna ganha um traço de 2px no
  topo do cartão (`box-shadow: inset`), não um fundo colorido inteiro —
  Backlog em `tinta-3` (neutro), Fazendo na cor de destaque do caderno,
  Impedido em vermelho-terracota, Feito em verde. Cor demais nas 4 colunas
  ao mesmo tempo cansaria; um traço já basta pra escanear "que coluna é
  essa" de relance.
- **Cartão:** mesma classe `.cartao` das páginas na lista — branco, borda
  sutil, sobe 1px no hover. O quadro usa o mesmo vocabulário de cartão do
  resto do app em vez de inventar um estilo próprio de "cartão Kanban".
- **Adicionar rápido:** um campo de texto que nasce direto na coluna (sem
  diálogo) — Enter cria, Esc cancela, perder o foco também confirma. Uma
  tarefa é rápida de anotar; abrir um diálogo pra isso seria atrito
  desnecessário. Detalhar (descrição, checklist) fica pro editor, que abre
  só ao clicar num cartão já criado.
- **Editor de tarefa:** diálogo largo (`max-w-3xl`) de duas colunas —
  markdown cru à esquerda, prévia ao vivo à direita — o mesmo par
  edição+prévia do editor de página, só que sem as ferramentas extras
  (zoom, barra de formatação, histórico) que uma tarefa curta não precisa.

### Wikilinks e Backlinks
- **Link resolvido (`[[Nome]]` com página correspondente):** link comum do
  `next/link`, sem estilo extra — o texto já deixa claro que é um link; a
  única diferença de um `<a>` de markdown normal é o `title` com a trilha
  completa (`Caderno › Seção › Página`) que aparece ao passar o mouse, para
  dar contexto sem precisar clicar.
- **Link não resolvido (`[[Nome]]` sem página correspondente):** texto na
  cor `tinta-3` com sublinhado tracejado (`border-b border-dashed`),
  `cursor: default`. Nunca herda a cor de link nem o cursor de ponteiro —
  clicável sem levar a lugar nenhum é pior que não clicável.
- **Painel "Notas que apontam para esta":** só aparece em modo leitura, e só
  quando há pelo menos um backlink — sem cabeçalho vazio prometendo algo que
  não existe. Ícone `Link2` + lista de links simples, mesmo tratamento
  visual de uma lista de resultados.

### Grafo
- **Nós:** um círculo por página, preenchido na cor do caderno dela — a
  mesma "lombada" que aparece na árvore lateral e na margem de leitura.
  Raio maior (8px) só no nó sob o mouse; os demais ficam em 6px.
- **Arestas:** `linha-forte` em repouso; ao passar o mouse num nó, as
  arestas conectadas a ele ganham a cor de destaque ativa e as
  desconectadas caem para 0.15 de opacidade — o grafo "explica" as
  conexões de uma nota sem precisar de painel lateral separado.
- **Notas órfãs:** grade abaixo do SVG, só renderizada quando existe pelo
  menos uma; cada item é um cartão simples com o título e o caminho
  completo como `title`.

### Painel de Tarefas
- **Lista por nota:** cartão de cantos 12px (`superficie-alta`, borda `linha`),
  um item por linha com borda inferior entre eles — mesmo vocabulário visual
  de um cartão de página, aplicado a uma lista em vez de uma grade.
- **Tarefa concluída:** texto em `tinta-3` com risco (`line-through`) — sem
  cor de sucesso separada; risco + esmaecido já é o sinal reconhecido de
  "feito" em qualquer lista de tarefas.
- **Filtro "Mostrar concluídas":** desligado por padrão — a tela abre já
  mostrando só o que falta, que é o que a pessoa veio ver.

### O Carimbo de Cor do Cartão (componente de assinatura)
A combinação de `inset 0 3px 0 var(--realce)` mais a sombra de hover
permanente é o único lugar do sistema onde uma cor sólida entra dentro de
um cartão branco sem ser conteúdo (ícone, etiqueta). É reservada
exclusivamente ao cartão da página que está aberta no momento — nunca usada
como decoração ou para chamar atenção para outra coisa. O mesmo carimbo
existe como uma opção do diálogo genérico (`realcado`): quando um popup
representa o detalhe de um cartão específico (a tarefa aberta no Kanban,
um link), ele herda esse mesmo fundo tingido + faixa no topo em vez de
ficar branco neutro — o popup "é" o cartão, só expandido.

### Cofre de Senhas e Links (aplicações com árvore própria)
As duas partem do mesmo vocabulário do resto do sistema em vez de inventar
um próprio: uma árvore de grupos/pastas (aninhamento livre, sem
profundidade fixa) numa coluna à esquerda. Links tinge a árvore com a cor
da pasta ativa (mesma `--realce`) e lista os links à direita como
`.cartao`, com o favicon do próprio site como ícone quando existe, caindo
no mesmo emblema colorido (`realce-medio` + ícone) que os outros cartões
usam quando não existe. O cofre de senhas fica neutro (sem cor por grupo)
porque a segurança do conteúdo, não a identidade visual, é o que importa
ali, e usa três colunas em vez de duas: grupos (mais os nós virtuais
Todas/Favoritas/Recentes acima da árvore e Lixeira no rodapé, mesmo
`linha-nav`) · linhas compactas de 40px (não `.cartao` — densas demais pra
isso, com favicon/inicial, título sobre usuário, ações só no hover) · um
painel de detalhe fixo à direita, onde "Editar" troca pra edição no
próprio painel em vez de abrir um modal (o modal, ali, fica só pra "Nova
senha" e pro que é destrutivo).

## Do's and Don'ts

### Do:
- **Do** deixar a cor do caderno (`--realce`) definir o acento de toda tela
  que abrir dentro dele — botões primários, anel de foco, barra ativa,
  margem de leitura seguem essa variável, nunca uma cor fixa hardcoded.
- **Do** manter bordas de 1px como o separador padrão entre superfícies;
  sombra é exceção de estado, não regra.
- **Do** usar `color-mix()` para qualquer wash/tint de cor dinâmica (cor
  de etiqueta, cor de caderno) em vez de pré-computar variantes fixas —
  é assim que o sistema aceita qualquer uma das seis cores de caderno sem
  precisar de uma classe CSS por cor.
- **Do** dar peso 700–800 e tracking negativo a títulos; é a única
  ferramenta de hierarquia tipográfica do sistema, então precisa ser usada
  com convicção nos títulos de página.

### Don't:
- **Don't** introduzir uma segunda família tipográfica de "destaque" —
  o sistema inteiro depende de uma família só carregando toda a hierarquia.
- **Don't** aplicar sombra de repouso em nada que não esteja flutuando ou
  em hover. Um cartão ou painel parado nunca projeta sombra visível.
- **Don't** usar a cor de um caderno como fundo de área grande (banner,
  seção inteira). Ela é sempre sinal pontual — bolinha, barra, carimbo,
  margem — nunca preenchimento.
- **Don't** misturar a cor de perigo (`--perigo`) com a paleta cíclica de
  cadernos fora do contexto de exclusão; mesmo que o vermelho de caderno e
  o vermelho de perigo compartilhem o hex, o ícone/contexto ao redor é o
  que desambigua, e isso não pode depender só da cor.
