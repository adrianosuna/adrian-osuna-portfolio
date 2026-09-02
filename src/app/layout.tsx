import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/site";
import { CONTENT } from "@/lib/landing/content";
import { LINKS_SPLASH } from "@/lib/splash";
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
  // Instalable en iPhone/iPad ("Añadir a pantalla de inicio"): se abre a
  // pantalla completa (sin la barra de Safari) y directo al dashboard. La barra
  // de estado en negro combina con el tema oscuro sin solaparse con el contenido.
  appleWebApp: {
    capable: true,
    title: "AO.",
    statusBarStyle: "black",
  },
  // Next emite el estándar moderno `mobile-web-app-capable`; el `apple-`
  // (deprecado, pero aún leído por iOS antiguos) lo añadimos a mano para que
  // "Añadir a pantalla de inicio" abra a pantalla completa también ahí.
  other: { "apple-mobile-web-app-capable": "yes" },
  // ⚠ Al declarar `icons`, Next DEJA DE inyectar los iconos por convención de
  // fichero (`app/icon.svg` y `app/apple-icon.tsx`) — y el favicon de la
  // pestaña desaparece sin más aviso. Por eso van los tres explícitos:
  //   · `icon`  — el de la pestaña del navegador (app/icon.svg).
  //   · `apple` — el del icono en la pantalla de inicio (app/apple-icon.tsx).
  //   · `other` — las pantallas de arranque de iOS: sin ellas, abrir la app
  //     instalada enseña un fogonazo blanco. Una por familia de pantalla (ver
  //     `lib/splash.ts`); las imágenes las genera `/splash/[dim]` en runtime.
  icons: {
    icon: { url: "/icon.svg", type: "image/svg+xml" },
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
  // `cover`: la página llega hasta los bordes físicos de la pantalla, que es lo
  // que se espera de una app instalada. A cambio, todo lo que se pega a un
  // borde tiene que respetar `env(safe-area-inset-*)` para no quedar debajo del
  // notch, de la isla dinámica o de la barra de gestos — eso lo hacen las
  // reglas `.safe-*` de globals.css.
  viewportFit: "cover",
};

// Datos estructurados (JSON-LD): resultado enriquecido en buscadores y
// contexto entendible para los motores de IA. Nodos enlazados por @id:
// la web es la ProfilePage de la Person, con sus proyectos como obras.
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
