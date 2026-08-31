import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { Casca } from "@/components/casca";
import { lerArvore } from "@/lib/arquivos";
import { listarEtiquetas } from "@/lib/etiquetas";
import { listarModelos } from "@/lib/modelos";

import "./globals.css";

// Uma sans só, da interface ao texto lido, e monoespaçada para o markdown cru.
const fonteUi = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--fonte-ui",
  display: "swap",
});
const fonteLeitura = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--fonte-leitura",
  display: "swap",
});
const fonteMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--fonte-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Meu bloco de anotações",
  description: "Anotações pessoais em seções e subseções, salvas em arquivos locais.",
};

/** Aplica o tema salvo antes da primeira pintura, para não piscar branco. */
const scriptDoTema = `
try {
  var t = localStorage.getItem("tema");
  if (!t) t = matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  document.documentElement.dataset.tema = t;
} catch (e) {}
`;

export default async function LayoutRaiz({ children }: { children: React.ReactNode }) {
  const [cadernos, etiquetas, modelos] = await Promise.all([
    lerArvore(),
    listarEtiquetas(),
    listarModelos(),
  ]);

  return (
    // As variáveis de fonte ficam no <html> para que o CSS possa montar as
    // pilhas de fonte já em :root — no <body> elas chegariam tarde demais.
    <html
      lang="pt-BR"
      data-tema="claro"
      suppressHydrationWarning
      className={`${fonteUi.variable} ${fonteLeitura.variable} ${fonteMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptDoTema }} />
      </head>
      <body className="antialiased">
        <Casca cadernos={cadernos} etiquetas={etiquetas} modelos={modelos}>
          {children}
        </Casca>
      </body>
    </html>
  );
}
