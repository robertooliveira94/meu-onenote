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

Um bloco de anotações pessoal no espírito do OneNote — cadernos, seções e
subseções — mas onde a hierarquia é a estrutura real de pastas do sistema
operacional, e cada página é um arquivo `.md` ou `.txt` comum, sem formato
proprietário. Existe para resolver a desorganização do Bloco de Notas sem
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
pastas de primeiro nível, seções e subseções são subpastas, páginas são
arquivos `.md` (markdown) ou `.txt` (texto puro) — a pessoa escolhe o
formato ao criar cada página. Metadados que não cabem num arquivo de texto
(etiquetas, favoritos, ordem manual, cor/ícone do caderno) ficam num índice
à parte (`dados/_sistema/indice.json`), para as notas em si continuarem
limpas e abríveis em qualquer editor.

## Capabilities and Constraints

- **Sem banco de dados.** O sistema de arquivos é a fonte da verdade; o
  índice em `_sistema/` é reconstruído sozinho a partir do disco se for
  apagado (só etiquetas e favoritos se perdem nesse caso).
- Cadernos, seções e subseções em profundidade livre; criar, renomear,
  mover, reordenar e excluir (vai para uma lixeira própria, recuperável).
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
- Busca global (`Ctrl+K`) no título e no corpo de todas as notas.
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
