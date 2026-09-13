import { Casca } from "@/components/casca";
import { lerArvore } from "@/lib/arquivos";
import { listarEtiquetas } from "@/lib/etiquetas";
import { obterArvore as obterArvoreDeLinks } from "@/lib/links-app";
import { listarModelos } from "@/lib/modelos";
import { listarQuadros } from "@/lib/quadros";

/** Moldura do app (barra de aplicações, coluna de seções) — todas as telas normais. */
export default async function LayoutDoApp({ children }: { children: React.ReactNode }) {
  const [cadernos, quadros, etiquetas, modelos, linksRaiz] = await Promise.all([
    lerArvore(),
    listarQuadros(),
    listarEtiquetas(),
    listarModelos(),
    obterArvoreDeLinks(),
  ]);

  return (
    <Casca cadernos={cadernos} quadros={quadros} etiquetas={etiquetas} modelos={modelos} linksRaiz={linksRaiz}>
      {children}
    </Casca>
  );
}
