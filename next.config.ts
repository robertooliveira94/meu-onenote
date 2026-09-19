import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A busca inteligente (embeddings locais) usa um runtime nativo
  // (onnxruntime-node, dentro de @huggingface/transformers) — o bundler do
  // Next não sabe lidar com o binário `.node` dele, então fica de fora,
  // carregado direto pelo Node em tempo de execução, como o `argon2` do
  // cofre de senhas.
  serverExternalPackages: ["@huggingface/transformers"],
  // As anotações vivem em disco, fora do controle do bundler.
  //
  // `standalone` só liga dentro do build Docker (ver Dockerfile, que passa
  // DOCKER_BUILD=1). Não é um detalhe cosmético: ligado sempre, o rastreador
  // de arquivos do Next, ao gerar esse pacote enxuto, segue os `fs.readdir`/
  // `readFile` que o app faz de verdade em `dados/` durante o build — e
  // como o `npm run build` do serviço do Windows roda na pasta que TEM suas
  // notas reais, elas (com histórico e tudo) acabavam copiadas para dentro
  // de `.next/standalone/dados`. Dentro do container Docker isso nunca
  // acontece porque `dados/` nem existe ali (.dockerignore cuida disso) —
  // mas fora dele, standalone ligado é vazamento de dados pessoais para um
  // artefato de build. Por isso fica atrás da variável, só para quem
  // realmente está construindo a imagem.
  ...(process.env.DOCKER_BUILD ? { output: "standalone" as const } : {}),
};

export default nextConfig;
