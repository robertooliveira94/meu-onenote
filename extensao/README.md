# Extensão do navegador

Extensão do Chrome (Manifest V3) que fala com o app rodando localmente.
Duas partes: **senhas** (frente 4) — captura senhas enviadas em
formulários e oferece salvar no cofre, e sugere preencher quando já existe
uma entrada para o site aberto — e **links** (frente 5) — mostra
favoritos e recentes no popup da barra e num painel lateral, pra abrir sem
sair da aba.

## Como instalar (modo desenvolvedor, sem publicar)

1. Abra `chrome://extensions`.
2. Ligue **"Modo do desenvolvedor"** (canto superior direito).
3. **"Carregar sem compactação"** → escolha esta pasta (`extensao/`).
4. Deixe o app rodando (`npm run dev`, porta 3100 por padrão). Se você
   rodar noutra porta, abra as **opções** da extensão (clique direito no
   ícone → "Opções", ou pela página `chrome://extensions`) e ajuste o
   endereço.

O ícone na barra do navegador mostra se o cofre está destrancado,
trancado, ou se o app não está aberto.

### O aviso do Windows sobre "extensões de desenvolvedor"

O Windows, de tempos em tempos, mostra um aviso oferecendo desativar
extensões carregadas sem compactação — é uma política do Chrome pra
Windows, não algo desta extensão. Duas saídas:

- Ignorar o aviso (a extensão continua funcionando, só volta a aparecer
  depois de um tempo).
- Publicar como **não listada** na Chrome Web Store (não aparece em busca,
  só quem tem o link instala) — taxa única de registro de desenvolvedor de
  US$ 5, sem revisão de conteúdo pesada por ser uso pessoal.

## Como funciona

- `content.js` roda em toda página (menos o próprio app). Ao enviar um
  formulário com campo de senha, guarda os dados temporariamente
  (`chrome.storage.local`) e mostra "Salvar esta senha?" assim que a
  próxima página do mesmo site carrega — como a maioria dos logins navega
  antes da pessoa ver qualquer coisa, isso evita perder o momento.
- `background.js` (service worker) é quem realmente conversa com o app —
  um content script batendo direto no `localhost` esbarraria em CORS numa
  página de terceiro; o service worker, com `host_permissions`, não.
- As rotas do lado do app ficam em `src/app/(app)/senhas/extensao/`:
  `status` (destrancado?), `buscar` (credenciais por domínio, pro
  autopreenchimento) e `salvar` (cria ou atualiza uma entrada). Todas
  exigem o cofre destrancado — se estiver trancado, a extensão oferece
  abrir o app.
- A aba **Links** do popup e o **painel lateral** (`sidepanel.html`, clique
  direito no ícone → "Abrir painel lateral") mostram a mesma janelinha:
  `/links-popup` do próprio app, carregada num `<iframe>`. Não existe rota
  de extensão própria pra Links — o app já serve essa página pronta (é a
  mesma que o bookmarklet "Abrir meus links" abre), então a extensão só
  precisa embuti-la.
- Sem servidor nenhum além do seu: nada disso fala com a internet, exceto
  o "Verificar vazamentos" do relatório de saúde (dentro do app), que é
  outra funcionalidade, separada e sob pedido.

## Limitações conhecidas

- Detecta login por `input[type="password"]` + `submit` do formulário —
  formulários muito não convencionais (tudo em JavaScript, sem `<form>`
  de verdade) podem não disparar a captura.
- O autopreenchimento sugere só a primeira entrada que bate com o domínio;
  com mais de uma conta no mesmo site, abra o cofre e copie a que quiser.
- As entradas capturadas caem num grupo "Do navegador", criado sozinho na
  primeira vez — mover pra outro grupo é manual, pelo cofre.
