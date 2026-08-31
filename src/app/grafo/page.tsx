import { GrafoDeNotas } from "@/components/grafo-notas";
import { listarGrafo, listarOrfas } from "@/lib/links";

export const dynamic = "force-dynamic";

export default async function TelaDoGrafo() {
  const [{ nos, arestas }, orfas] = await Promise.all([listarGrafo(), listarOrfas()]);
  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <GrafoDeNotas nos={nos} arestas={arestas} orfas={orfas} />
    </div>
  );
}
