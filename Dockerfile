# syntax=docker/dockerfile:1
#
# Build em três estágios: instala dependências, compila em modo produção
# (output "standalone" do Next.js — só o necessário para rodar, sem o
# node_modules inteiro) e monta a imagem final, enxuta, sem ferramenta de
# build nenhuma dentro dela.
#
# As anotações NUNCA entram na imagem (.dockerignore exclui `dados/`).
# Elas vivem só no volume montado em /app/dados — ver docker-compose.yml.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Liga o output "standalone" só aqui — ver o comentário em next.config.ts
# sobre por que isso não pode ficar ligado fora do build Docker.
ENV DOCKER_BUILD=1
# Sem isto, o build cairia no padrão do Windows definido em caminhos.ts (que
# nem existe dentro do container Linux) durante a coleta de dados da página.
ENV DADOS_PATH=/app/dados
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Alpine não vem com fuso horário nenhum instalado — sem isto, toda data
# mostrada na interface (criada em, alterada em, nota do dia) sai em UTC,
# horas adiantada do horário de quem está usando o app. TZ tem um padrão
# aqui, mas dá para trocar pelo `.env` do docker-compose (ver TZ ali).
RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo

# Roda como usuário sem privilégio — não precisa de root pra servir HTTP.
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 meuonenote

COPY --from=builder /app/public ./public
COPY --from=builder --chown=meuonenote:nodejs /app/.next/standalone ./
COPY --from=builder --chown=meuonenote:nodejs /app/.next/static ./.next/static

# Ponto de montagem do volume de dados — criado aqui só para garantir que a
# pasta exista com o dono certo antes do volume ser montado por cima.
RUN mkdir -p /app/dados && chown meuonenote:nodejs /app/dados

USER meuonenote

# Dentro do container o processo precisa escutar em todas as interfaces
# (0.0.0.0) — é o `docker run -p 127.0.0.1:3100:3100` (ou o docker-compose.yml)
# que restringe o acesso a só a própria máquina, não este bind interno.
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"
# Sempre aponta pro ponto de montagem do volume — nunca pro padrão do
# Windows em caminhos.ts, que não faz sentido dentro do container.
ENV DADOS_PATH=/app/dados
EXPOSE 3100

CMD ["node", "server.js"]
