import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

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

/**
 * Aplica o tema salvo antes da primeira pintura, para não piscar. Aceita
 * qualquer um dos temas (ver src/lib/tema.ts) e marca `data-escuro` para os
 * de família escura, que compartilham alguns ajustes.
 */
const scriptDoTema = `
try {
  var validos = ["claro","escuro","escuro-suave","sepia","cinza","vibrante"];
  var t = localStorage.getItem("tema");
  if (validos.indexOf(t) < 0) t = matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  var r = document.documentElement;
  r.dataset.tema = t;
  if (t === "escuro" || t === "escuro-suave" || t === "vibrante") r.dataset.escuro = "1";
} catch (e) {}
`;

/**
 * Casca do documento inteiro — fontes, tema, `<html>`/`<body>`. De propósito
 * sem a moldura do app (barra de aplicações, coluna de seções): a janela
 * flutuante da nota (`/nota-flutuante/...`) usa este mesmo layout, mas sem
 * aquela moldura em volta, porque abre numa janela separada do navegador. A
 * moldura em si vive em `(app)/layout.tsx`, aplicada só às telas normais.
 */
export default function LayoutRaiz({ children }: { children: React.ReactNode }) {
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
