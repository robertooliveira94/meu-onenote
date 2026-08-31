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
- Uma cor de destaque por caderno, nunca uma paleta de marca fixa — a cor
  muda com o contexto e atravessa a interface inteira.
- Fundo branco de verdade (não bege, não cinza-escuro por padrão); o
  branco só existe como "cartão" porque o `--papel` ao redor dele é
  levemente mais frio/escuro.
- Camada plana em repouso; sombra é sempre uma resposta a estado (hover)
  ou uma propriedade de flutuar acima do conteúdo (menu, diálogo).
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
**A Regra da Lombada.** A cor de um caderno nunca fica presa a um só
lugar. Ela precisa aparecer em pelo menos três destes quatro pontos para
um caderno estar "completo" visualmente: a bolinha/ícone na árvore, a
barra do item ativo, o carimbo do cartão aberto, a margem da leitura.

**A Regra da Cor Única.** No máximo uma cor saturada de caderno está
"ativa" (definida em `--realce`) por vez, em toda a tela. Duas cores de
caderno nunca competem lado a lado como decoração — quando aparecem juntas
(ex.: lista de cadernos na barra lateral), é sempre como bolinhas pequenas
e discretas, nunca como blocos de fundo.

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

Três colunas em telas de trabalho: barra lateral (árvore de cadernos, 248px
de partida) e lista de páginas (292px de partida) são **redimensionáveis
arrastando a borda direita**, como uma coluna de planilha; a área de
conteúdo sempre ocupa o resto do espaço. Sem grade responsiva além disso; o
app assume uma janela de desktop (é um serviço local, não uma página
pública). Densidade compacta: paddings típicos de 8–16px, altura de
controle padrão de 34–38px.

A largura de cada uma é lembrada por painel (`localStorage`, chaves
`largura-barra-lateral` e `largura-lista-paginas`), clampada entre um
mínimo e um máximo por painel para nunca colapsar nem engolir a tela
inteira. Duplo clique na borda volta ao valor de partida.

O modo de edição de uma nota em markdown divide a área de conteúdo em duas
colunas iguais — texto cru à esquerda, prévia renderizada à direita — sem
proporção assimétrica.

**Recolher para escrever**: um botão no topo da barra lateral (`PanelLeftClose`)
esconde a barra lateral e a lista de páginas de uma vez, dando à área de
conteúdo o máximo de espaço — o mesmo botão, como `PanelLeftOpen` flutuando
no canto superior esquerdo, traz as duas de volta. Estado único
(`localStorage`, chave `colunas-recolhidas`) compartilhado entre os dois
painéis porque moram em componentes diferentes; enquanto recolhidas, ficam
com `inert` — não só invisíveis, também fora da ordem de tab.

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
tinta clara não lê como profundidade sobre um fundo já escuro.

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
- **Faixa clicável:** 6px, encostada na borda direita do painel (barra
  lateral e lista de páginas), com `cursor: col-resize`. Mais larga que a
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
- **Árvore de cadernos:** item ativo ganha uma barra vertical de 2.5px na
  cor do caderno, encostada na borda esquerda da linha, mais um fundo
  `realce-medio` fraco atrás de todo o texto — a combinação de barra +
  wash é o que sinaliza "você está aqui" sem depender só de cor de fundo.
- **Atalhos fixos (Início, Etiquetas, Lixeira):** mesmo padrão de
  wash + peso de fonte para o item ativo, sem a barra lateral (reservada à
  árvore de cadernos).
- **Mobile:** não há tratamento mobile — o app assume uso em desktop, como
  serviço local sempre aberto numa janela de navegador.

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

### O Carimbo de Cor do Cartão (componente de assinatura)
A combinação de `inset 0 3px 0 var(--realce)` mais a sombra de hover
permanente é o único lugar do sistema onde uma cor sólida entra dentro de
um cartão branco sem ser conteúdo (ícone, etiqueta). É reservada
exclusivamente ao cartão da página que está aberta no momento — nunca usada
como decoração ou para chamar atenção para outra coisa.

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
