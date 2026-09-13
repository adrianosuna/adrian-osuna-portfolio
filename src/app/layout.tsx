import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import { CONTENT } from "@/lib/landing/content";
import { LINKS_SPLASH } from "@/lib/splash";
import { BarraScroll } from "@/components/ui/barra-scroll";
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
    "Portfolio de Adrián Osuna, desarrollador web Full-Stack especializado en React y Node.js. Aplicaciones web eficientes y escalables, de la base de datos a la interfaz.",
  keywords: ["Adrián Osuna", "desarrollador web", "Full-Stack", "React", "Node.js", "Next.js", "portfolio"],
  // Instalable en iPhone/iPad: pantalla completa y directo al dashboard. Barra de
  // estado en negro, a tono con el tema oscuro.
  appleWebApp: {
    capable: true,
    title: "AO",
    statusBarStyle: "black",
  },
  // Next emite `mobile-web-app-capable`; el `apple-` (deprecado, aún leído por iOS
  // antiguos) se añade a mano.
  other: { "apple-mobile-web-app-capable": "yes" },
  // Al declarar `icons`, Next deja de inyectar los iconos por convención de fichero:
  // por eso van los tres explícitos (icon, apple y las splash de `lib/splash.ts`).
  icons: {
    // Dos formatos para `icon`: el SVG (escala y lo prefieren los navegadores
    // modernos) y el .ico de respaldo.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
    ],
    apple: "/apple-icon",
    other: LINKS_SPLASH,
  },
  // Sin límite de snippet e imágenes grandes en previsualizaciones: los
  // resúmenes generativos (AI Overviews y similares) citan mejor sin recortes.
  robots: {
    index: true,
    follow: true,
    "max-snippet": -1,
    "max-image-preview": "large",
    "max-video-preview": -1,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  // El canonical y og:url viven en la página de la landing (src/app/page.tsx):
  // aquí se heredarían en /login, /app/* y la 404, declarándolas "la home".
  openGraph: {
    title: "Adrián Osuna — Desarrollador Web",
    description:
      "Portfolio de Adrián Osuna, desarrollador web Full-Stack especializado en React y Node.js.",
    siteName: "Adrián Osuna",
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Adrián Osuna — Desarrollador Web",
    description:
      "Portfolio de Adrián Osuna, desarrollador web Full-Stack especializado en React y Node.js.",
  },
};

export const viewport: Viewport = {
  // Tiñe la interfaz del navegador móvil con el fondo (el sitio es siempre oscuro).
  themeColor: "#0a1512",
  // `cover`: la página llega a los bordes físicos, como una app instalada. Lo pegado
  // a un borde respeta `env(safe-area-inset-*)` con las reglas `.safe-*`.
  viewportFit: "cover",
};

// Datos estructurados (JSON-LD): la web es la ProfilePage de la Person, con sus
// proyectos como obras enlazadas por @id.
const personId = `${SITE_URL}/#persona`;
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": personId,
      name: "Adrián Osuna",
      alternateName: "Adrián Osuna Albalá",
      jobTitle: "Desarrollador Full-Stack",
      description: CONTENT.hero.tagline,
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
      description: CONTENT.footer.blurb,
      author: { "@id": personId },
    },
    {
      "@type": "ProfilePage",
      url: SITE_URL,
      inLanguage: "es",
      mainEntity: { "@id": personId },
    },
    // Los casos de estudio, como obras creadas por la persona.
    ...CONTENT.projects.map((p) => ({
      "@type": "CreativeWork" as const,
      name: p.title,
      ...(p.url ? { url: p.url } : {}),
      description: `${p.context} ${p.built}`,
      creator: { "@id": personId },
      keywords: p.stack.join(", "),
    })),
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Tema oscuro permanente. suppressHydrationWarning por los atributos que inyectan
    // las extensiones; data-scroll-behavior declara a Next el scroll suave.
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
        <BarraScroll />
      </body>
    </html>
  );
}
