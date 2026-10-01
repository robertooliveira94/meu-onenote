// Copia as fontes do Excalidraw para `public/excalidraw/fonts`, de onde o
// editor de desenho as carrega (ver `window.EXCALIDRAW_ASSET_PATH` em
// `src/components/tela-desenho.tsx`). Sem isto ele as buscaria num CDN — e o
// app roda local, às vezes sem internet: o texto do desenho cairia numa fonte
// qualquer do sistema.
//
// Xiaolai (chinês/japonês, 13 MB) fica de fora: se um dia aparecer um
// ideograma, o Excalidraw ainda tenta o CDN como último recurso.
//
// Roda antes de `dev` e de `build` (ver package.json); a pasta de destino é
// gerada, fica no .gitignore.
import fs from "node:fs/promises";
import path from "node:path";

const origem = path.join("node_modules", "@excalidraw", "excalidraw", "dist", "prod", "fonts");
const destino = path.join("public", "excalidraw", "fonts");
const DE_FORA = new Set(["Xiaolai"]);

try {
  await fs.rm(destino, { recursive: true, force: true });
  for (const familia of await fs.readdir(origem)) {
    if (DE_FORA.has(familia)) continue;
    await fs.cp(path.join(origem, familia), path.join(destino, familia), { recursive: true });
  }
} catch (erro) {
  // Não derruba o build: sem as fontes locais o desenho ainda funciona (pelo CDN).
  console.warn("[excalidraw] não deu para copiar as fontes:", erro instanceof Error ? erro.message : erro);
}
