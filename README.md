# Meu bloco de anotações

Bloco de anotações pessoal, no estilo do OneNote, rodando só na sua máquina.
Cadernos, seções e subseções são pastas de verdade; cada página é um arquivo
`.md` ou `.txt` dentro delas.

O projeto fica em `C:\DEV\meu-onenote` e roda como **serviço do Windows**:
inicia sozinho quando o computador liga, reinicia sozinho se cair, e fica
sempre disponível em `http://localhost:3100` — sem terminal, sem Docker.

O serviço escuta só em `127.0.0.1` (a própria máquina) — nenhum outro
computador na mesma rede consegue acessá-lo, mesmo sem firewall. Isso importa
principalmente em redes com mais gente (trabalho, por exemplo), já que o app
não tem login: quem alcançasse a porta veria e editaria as anotações.

## Uso do dia a dia

Só abrir o navegador em **http://localhost:3100** — ou dar dois cliques no
atalho "Meu Bloco de Anotacoes" na Área de Trabalho. O serviço já está
rodando em segundo plano; não precisa abrir nada antes.

## Onde ficam as anotações

Por padrão, em `C:\Users\rober\OneDrive\Documentos\notas` — **dentro do
OneDrive de propósito**, para o backup na nuvem acontecer sozinho, sem
precisar copiar a pasta na mão de vez em quando. Não é dentro da pasta do
projeto (`C:\DEV\meu-onenote`); código e anotações vivem separados.

```
notas/
  Pessoal/                      <- caderno
    Financeiro/                 <- seção
      Metas 2026/                <- subseção
        Orçamento 2026.md        <- página em markdown
        Lembretes.txt            <- página em texto simples
  _Entrada/                     <- caixa de entrada da captura rápida
  _sistema/                     <- uso interno do aplicativo
    indice.json                  <- etiquetas, favoritos, datas, ordem
    etiquetas.json                <- cadastro de etiquetas
    historico/                    <- versões anteriores de cada página
    lixeira/                      <- itens excluídos, com o caminho de origem
```

Os arquivos são texto comum: dá para abrir qualquer um no Bloco de Notas, copiar
para um pendrive ou mandar por e-mail. Se você criar um `.txt` direto pelo
Explorador de Arquivos dentro de uma dessas pastas, o aplicativo o adota na
próxima vez que abrir.

**Mudar esse local**: copie `.env.example` para `.env` (raiz do projeto) e
defina `DADOS_PATH` com o caminho completo que quiser — o Next.js lê esse
arquivo sozinho, tanto no `npm run dev` quanto no `npm run build` +
`next start` (o que o serviço usa via NSSM), sem precisar de mais nada.

```powershell
cd C:\DEV\meu-onenote
copy .env.example .env
notepad .env
```

Alternativa, só para o serviço do Windows: preencher `$PastaDados` em
`scripts/install-service.ps1` antes de instalar — fica registrado direto no
serviço (`nssm get MeuOneNote AppEnvironmentExtra`) e tem prioridade sobre o
`.env` se os dois existirem ao mesmo tempo. Sem nenhum dos dois, cai no
padrão embutido em `src/lib/caminhos.ts` (o valor acima).

No modo Docker é diferente — lá quem manda é `DADOS_HOST_PATH`, não
`DADOS_PATH` (o `.env.example` já separa os dois; ver "Rodando via Docker"
mais abaixo).

## O que dá para fazer

| Ação | Como |
| --- | --- |
| Buscar em todas as notas | Ctrl + K |
| Anotar uma ideia solta | Ctrl + Shift + N (vai para a caixa de entrada) |
| Salvar agora | Ctrl + S (o salvamento automático já roda sozinho) |
| Sair da edição | Esc ou o botão Concluir |
| Trocar o tema | Botão de lua/sol no alto à direita |

Markdown abre formatado para leitura; o botão Editar divide a tela em
texto cru e visualização. Texto simples abre direto no editor, porque não há
nada para formatar. Dá para converter de um para o outro pelo menu da página.

Etiquetas atravessam cadernos: cadastre em Etiquetas, aplique no alto de
cada página e clique numa etiqueta para ver tudo que a usa.

Histórico: a cada poucos minutos de edição, a versão anterior da página é
guardada. O ícone de relógio na página lista as últimas 20 e restaura qualquer
uma — o texto atual vira uma versão antes da troca.

Lixeira: excluir manda para a lixeira com etiquetas e favoritos preservados.
Só "Esvaziar lixeira" apaga de verdade.

Exportar: no menu de uma seção, "Exportar em markdown" baixa a seção inteira
(com as subseções) num único arquivo. Para PDF, abra a página em modo leitura e
use Ctrl + P → Salvar como PDF.

## Como o serviço funciona

O app roda em modo produção (build otimizado, sem recompilar a cada
acesso) através do NSSM (Non-Sucking Service Manager), registrado como
serviço nativo do Windows chamado `MeuOneNote`:

- Inicia sozinho no boot (não precisa logar para o serviço rodar).
- Reinicia sozinho se o processo cair (espera 3s e sobe de novo).
- Logs de saída e erro ficam em `C:\DEV\meu-onenote\logs\stdout.log` e
  `stderr.log`, com rotação automática a cada 10 MB (não crescem para sempre).

Para ver o status a qualquer momento: abra o `services.msc` do Windows e
procure por "Meu Bloco de Anotacoes", ou rode `Get-Service MeuOneNote`
num PowerShell.

### Instalar o serviço (primeira vez)

Abra um PowerShell **como Administrador** e rode:

```powershell
cd C:\DEV\meu-onenote\scripts
.\install-service.ps1
```

Isso gera o build de produção, registra o serviço, inicia e testa se
respondeu em `http://localhost:3100`. As anotações vão para o padrão de
`src\lib\caminhos.ts` (hoje `C:\Users\rober\OneDrive\Documentos\notas`); para
usar outro lugar, crie um `.env` com `DADOS_PATH` (veja "Onde ficam as
anotações" acima) antes de instalar, ou preencha `$PastaDados` no topo deste
script.

### Atualizar depois de mudar o código

Sempre que você (ou alguém) alterar algo em `src/`, rode num PowerShell
**como Administrador**:

```powershell
cd C:\DEV\meu-onenote\scripts
.\update-service.ps1
```

Isso para o serviço, gera um build novo com o código atualizado e sobe o
serviço de novo. Leva de 1 a 3 minutos.

### Desinstalar

Duas opções, dependendo do quanto você quer tirar da máquina. Como as
anotações moram fora da pasta do projeto por padrão, os dois caminhos
preservam suas notas a menos que você peça explicitamente para apagá-las.

**Só tirar o serviço de segundo plano, mantendo tudo no disco**
(ex.: para rodar manualmente depois, ou investigar algo com calma):

```powershell
cd C:\DEV\meu-onenote\scripts
.\uninstall-service.ps1
```

Remove só o registro do serviço no Windows — o projeto em
`C:\DEV\meu-onenote` e suas anotações continuam intactos.

**Remover o serviço e o código do projeto**
(ex.: para tirar o app de vez de uma máquina, como um PC de trabalho):

```powershell
cd C:\DEV\meu-onenote\scripts
.\desinstalar-tudo.ps1
```

Remove o serviço e apaga a pasta `C:\DEV\meu-onenote` (o código) — pede uma
confirmação explícita (`APAGAR`) antes. As anotações **não** entram nisso:
o script descobre onde elas estão (lendo a configuração do serviço, ou o
padrão do código) e, **numa segunda pergunta separada**, oferece apagá-las
também (`APAGAR NOTAS`) — só se você confirmar essa segunda vez, isto é, tem
duas chances de recuar antes de perder alguma nota. Não desinstala o Node.js
nem o NSSM (são ferramentas de uso geral, não só deste projeto) — isso é
opcional, pelo Painel de Controle.

### Modo desenvolvimento (para editar o código)

Se for mexer no código, não use o serviço — ele serve um build fixo.
Dê dois cliques em "Rodar em modo desenvolvimento.bat": abre numa porta
diferente (3101) para não brigar com o serviço, com recarregamento
automático a cada mudança (mas mais lento, como todo modo de
desenvolvimento). Feche a janela para encerrar.

## Rodando via Docker (alternativa ao serviço do Windows)

Onde dá para rodar containers (ex.: um PC de trabalho onde instalar o NSSM
como serviço não é bem-vindo pelo TI), o mesmo projeto roda dentro de um
container — sem precisar de Node.js instalado na máquina, só o Docker.

### Escolhendo onde as anotações ficam guardadas

Antes de subir pela primeira vez, copie `.env.example` para `.env` (mesma
pasta do `docker-compose.yml`) e aponte `DADOS_HOST_PATH` para onde quiser
— não precisa ser `./dados`, pode ser qualquer pasta da máquina, inclusive
fora do projeto:

```powershell
cd C:\DEV\meu-onenote
copy .env.example .env
notepad .env
```

```dotenv
# .env
DADOS_HOST_PATH=C:\Users\SeuUsuario\Documents\MeuOneNote\dados
PORTA_HOST=3100
TZ=America/Sao_Paulo
```

Se a pasta ainda não existir, o Docker cria sozinho na primeira subida. Sem
um `.env`, o padrão é `./dados`, do lado do `docker-compose.yml` — funciona
igual, só não fica num lugar escolhido por você. O `.env` é específico desta
máquina e fica de fora do Git (`.gitignore` já cuida disso); quem só quer
copiar o código para configurar do zero usa o `.env.example` como modelo.

**Rodando de dentro do WSL, com as notas fora dele** (testado e funciona):
se `docker compose` roda de dentro de uma distro WSL (Ubuntu, por exemplo) em
vez do PowerShell, o Docker Desktop com integração WSL2 compartilha o mesmo
daemon — o comando é idêntico. A única diferença é o formato do caminho em
`DADOS_HOST_PATH`: o WSL já monta o disco do Windows sozinho em `/mnt/c/...`,
então `C:\Users\SeuUsuario\Documents\MeuOneNote\dados` vira
`/mnt/c/Users/SeuUsuario/Documents/MeuOneNote/dados`. O volume grava direto
nesse caminho — sem cópia, sem sincronia, o arquivo aparece no Explorador do
Windows no instante em que é salvo.

```bash
# de dentro do WSL
cd /mnt/c/DEV/meu-onenote
docker compose up -d --build
```

O `TZ` no `.env` importa mais ainda aqui: um container Linux não herda o
fuso horário do Windows sozinho — sem ele, as datas na interface (criada em,
nota do dia) apareceriam em UTC, horas adiantadas da hora local. O
`docker-compose.yml` já usa `America/Sao_Paulo` como padrão mesmo sem essa
variável definida.

### Subindo o container

```powershell
cd C:\DEV\meu-onenote
docker compose up -d --build
```

Isso sobe o app em `http://localhost:3100` (ou a porta que você definiu em
`PORTA_HOST`), só acessível da própria máquina — a porta é publicada em
`127.0.0.1`, igual ao serviço do Windows, então outros computadores da rede
não alcançam. As anotações ficam **fora da imagem**, no caminho que você
escolheu com `DADOS_HOST_PATH`: reconstruir a imagem (`docker compose up -d
--build` de novo, depois de atualizar o código) nunca apaga nem sobrescreve
o que está lá.

Comandos do dia a dia:

| Ação | Comando |
| --- | --- |
| Subir (ou atualizar depois de mudar o código) | `docker compose up -d --build` |
| Ver logs | `docker logs -f meu-onenote` |
| Parar | `docker compose down` (a imagem some, `dados/` continua no disco) |
| Reiniciar sozinho no boot | Ligue o Docker Desktop para iniciar com o Windows — o container sobe de novo sozinho (`restart: unless-stopped`) |

**Por que as notas nunca vão para dentro da imagem**: o `.dockerignore`
exclui a pasta `dados/` do que é enviado para o build — o Next.js nem chega
a saber que ela existe durante `docker compose build`. É diferente do
`npm run build` do serviço do Windows, que roda direto na pasta do projeto
(por isso o `output: "standalone"` do `next.config.ts`, usado só dentro do
Docker, fica atrás de uma variável de ambiente que só o `Dockerfile` liga —
sem essa trava, o build local também tentaria empacotar `dados/` para
dentro de `.next/`, o que não queremos de jeito nenhum).

## Backup

A pasta de anotações é tudo — não existe banco de dados nem nada guardado
fora dali. Copiá-la já é um backup completo.

No local padrão (`C:\Users\rober\OneDrive\Documentos\notas`), o backup na
nuvem já é automático: o OneDrive sincroniza sozinho a cada alteração,
sem precisar copiar nada na mão. Isso é intencional — só a pasta do
**projeto** (`C:\DEV\meu-onenote`, com `node_modules` e afins) fica de fora
do OneDrive, para não travar builds com sincronização de milhares de
arquivos pequenos; as **anotações**, sendo poucos arquivos de texto, não têm
esse problema e ganham o backup de graça.

Se você mudou `DADOS_PATH` para um lugar fora do OneDrive, essa sincronização
automática não existe mais — volte a copiar a pasta de vez em quando para
algum lugar com backup.

**Se for versionar o código com Git**: o `.gitignore` já exclui a pasta
`dados/` (usada só como fallback local em dev, se existir) e o arquivo
`.env` — suas anotações e a configuração desta máquina nunca vão para um
repositório, nem mesmo privado. Isso é de propósito: ao levar o código para
outra máquina (um PC de trabalho, por exemplo) por Git, você quer só o
código. Confirme com `git status` antes de qualquer `git push`.

## Solução de problemas

**A página não abre em `http://localhost:3100`**
Confira se o serviço está rodando: `Get-Service MeuOneNote` num PowerShell.
Se aparecer "Stopped", tente iniciar com `Start-Service MeuOneNote` (precisa
de Administrador) e olhe `C:\DEV\meu-onenote\logs\stderr.log` para o motivo.

**Depois de reiniciar o computador, o app não abre sozinho**
Confirme que o tipo de inicialização do serviço está "Automático": abra
`services.msc`, ache "Meu Bloco de Anotacoes", clique com o botão direito →
Propriedades → Tipo de inicialização deve estar como "Automático".

**Apareceu "uma política de Controle de Aplicativo bloqueou este arquivo"
durante o build**
Isso é o Smart App Control do Windows bloqueando o compilador nativo do
Next.js (não é um erro do projeto). O Next.js detecta isso sozinho e cai
para uma versão mais lenta em WASM — o build funciona normalmente, só demora
um pouco mais (1 a 3 minutos em vez de segundos). Pode ignorar o aviso.

**A porta 3100 já está em uso por outra coisa**
Veja o que está usando a porta:
`Get-Process -Id (Get-NetTCPConnection -LocalPort 3100).OwningProcess`
Se for um servidor de desenvolvimento antigo aberto sem querer, feche a
janela dele. Se quiser usar outra porta para o serviço, troque o valor de
`$Porta` em `install-service.ps1` e `update-service.ps1` e reinstale o
serviço.

**Preciso mexer no código mas o serviço já está usando os arquivos**
Sem problema: o modo desenvolvimento ("Rodar em modo desenvolvimento.bat")
roda numa porta separada (3101) e lê os mesmos arquivos em `src/`. Só rode
`update-service.ps1` depois, como Administrador, quando quiser publicar a
mudança no serviço de verdade. Atenção: o modo desenvolvimento lê e escreve
nas **mesmas anotações** do serviço (mesmo `DADOS_PATH`/padrão) — editar por
ali mexe nas notas de verdade, não numa cópia de teste.

## Detalhes técnicos

Next.js 15, React 19, TypeScript e Tailwind 4. Não há banco de dados: o disco
é a fonte da verdade e `_sistema/indice.json` guarda apenas o que não cabe
dentro de um arquivo de texto (etiquetas, favoritos, ordem manual). Se esse
índice for apagado, o aplicativo o reconstrói a partir dos arquivos — só as
etiquetas e os favoritos se perdem.

Todo caminho vindo da interface passa por `src/lib/caminhos.ts`, que resolve
a raiz das anotações (`RAIZ`) a partir de `DADOS_PATH`, com um padrão local
embutido se a variável não existir, e recusa qualquer coisa que tente
escapar dessa pasta.

Serviço do Windows via NSSM (`scripts/install-service.ps1`,
`update-service.ps1`, `uninstall-service.ps1`, `desinstalar-tudo.ps1`), nome
do serviço `MeuOneNote`, escutando em `127.0.0.1:3100` (só a própria
máquina), logs em `logs/stdout.log` e `logs/stderr.log` com rotação a cada
10 MB.

Alternativa em container: `Dockerfile` (build multi-estágio, imagem final
roda como usuário sem privilégio) e `docker-compose.yml` (porta e caminho do
volume configuráveis por `.env`, veja `.env.example` — `PORTA_HOST` e
`DADOS_HOST_PATH`, ambos com um padrão sensato se o `.env` não existir).
`.dockerignore` garante que `dados/` e `.env` nunca entram no contexto de
build.
