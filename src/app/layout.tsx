import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Adrián Osuna — Desarrollador Web",
    template: "%s | Adrián Osuna",
  },
  description:
    "Portfolio de Adrián Osuna, desarrollador web full-stack especializado en React y Node.js. Aplicaciones web eficientes y escalables, de la base de datos a la interfaz.",
  keywords: ["Adrián Osuna", "desarrollador web", "full stack", "React", "Node.js", "Next.js", "portfolio"],
  // El canonical y og:url viven en la página de la landing (src/app/page.tsx):
  // aquí se heredarían en /login, /app/* y la 404, declarándolas "la home".
  openGraph: {
    title: "Adrián Osuna — Desarrollador Web",
    description:
      "Portfolio de Adrián Osuna, desarrollador web full-stack especializado en React y Node.js.",
    siteName: "Adrián Osuna",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Adrián Osuna — Desarrollador Web",
    description:
      "Portfolio de Adrián Osuna, desarrollador web full-stack especializado en React y Node.js.",
  },
};

export const viewport: Viewport = {
  // Tiñe la interfaz del navegador móvil con el fondo (el sitio es siempre oscuro).
  themeColor: "#0a1512",
};

// Datos estructurados (JSON-LD): resultado enriquecido en buscadores.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      name: "Adrián Osuna",
      alternateName: "Adrián Osuna Albalá",
      jobTitle: "Desarrollador Full-Stack",
      worksFor: { "@type": "Organization", name: "INTARCON" },
      url: SITE_URL,
      image: `${SITE_URL}/img/adrian.webp`,
      email: "mailto:adrianosunaalbala@gmail.com",
      knowsAbout: ["React", "Node.js", "Next.js", "TypeScript", "MySQL", "JavaScript"],
      sameAs: [
        // Percent-encoded (tildes): los validadores estrictos rechazan la URL cruda.
        "https://www.linkedin.com/in/adri%C3%A1n-osuna-albal%C3%A1",
        "https://github.com/adrianosuna",
      ],
      address: {
        "@type": "PostalAddress",
        addressLocality: "Moriles",
        addressRegion: "Andalucía",
        addressCountry: "ES",
      },
    },
    {
      "@type": "WebSite",
      name: "Adrián Osuna — Portfolio",
      url: SITE_URL,
      inLanguage: "es",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Tema oscuro permanente: los tokens de globals.css ya son los oscuros.
    // suppressHydrationWarning: extensiones y herramientas de automatización
    // inyectan atributos en <html> antes de hidratar (mismatch espurio).
    // data-scroll-behavior: le declara a Next el scroll suave para que pueda
    // desactivarlo durante las transiciones de ruta.
    <html
      lang="es"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          // JSON.stringify no escapa "</script>": se neutraliza todo `<` por si
          // el objeto incorpora algún día datos dinámicos.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
        {children}
      </body>
    </html>
  );
}
