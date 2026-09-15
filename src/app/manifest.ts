import type { MetadataRoute } from "next";

/**
 * Manifesto pra instalar o hub como aplicativo (menu do Chrome/Edge →
 * "Instalar"): abre em janela própria, sem barra de endereço, com ícone na
 * barra de tarefas e no menu Iniciar. Sem service worker de propósito — o
 * navegador não exige mais um pra instalar, e o app é local: "offline" é o
 * estado normal dele. As cores são as do tema claro; o tema salvo continua
 * sendo aplicado pelo script de layout.tsx assim que a janela abre.
 */
export default function manifesto(): MetadataRoute.Manifest {
  return {
    name: "Meu bloco de anotações",
    short_name: "Meu bloco",
    description: "Anotações, Kanban, senhas e links — tudo em arquivos locais.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f9",
    theme_color: "#0ea47c",
    lang: "pt-BR",
    icons: [
      // O PNG de 512 é o que o Chrome exige pra oferecer "Instalar"; foi
      // gerado do icon.svg (sharp, densidade 400). O SVG cobre os outros
      // tamanhos sem serrilhar.
      { src: "/icone-512.png", type: "image/png", sizes: "512x512", purpose: "any" },
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
