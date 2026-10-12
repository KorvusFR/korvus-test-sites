import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChaosEngine } from "@/components/ChaosEngine";
import { GTMPageView } from "@/components/GTMPageView";
import { CookieBanner } from "@/components/CookieBanner";
import { hasFlag } from "@/lib/chaos";

export const metadata: Metadata = {
  title: {
    default: "doomcheck.me — Electronics & Gadgets",
    template: "%s | doomcheck.me",
  },
  description:
    "Electronics and gadgets for those who operate in the margins. Phones, audio, gaming, laptops, accessories.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const slowSnippet = hasFlag("slow_snippet");
  const brokenScript = hasFlag("broken_script");
  const brokenCss = hasFlag("broken_css");

  return (
    <html lang="en">
      <head>
        {slowSnippet && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var d=3000+Math.floor(Math.random()*5000);var s=Date.now();while(Date.now()-s<d){}console.warn("[doomcheck chaos] slow_snippet: blocked for "+d+"ms");})();`,
            }}
          />
        )}
        {brokenScript && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script src="/nonexistent-chaos.js" />
        )}
        {brokenCss && (
          // eslint-disable-next-line @next/next/no-css-tags
          <link href="/nonexistent-chaos.css" rel="stylesheet" />
        )}
        <script dangerouslySetInnerHTML={{ __html: "window.dataLayer=window.dataLayer||[];" }} />
        {/* INJECT_SCRIPTS */}
        {/*
          Balise finale du moteur V2 (platform : docs/snippet-install-site-config.md),
          posee telle que le guide la donne : UNE balise en ligne.

          - apiKey est le SEUL champ de window.__korvus : la cle de l'organisation
            de test, sans laquelle le moteur ne demarre pas.
          - La cle d'organisation ne vit que dans le chargeur. Il demande le fichier
            du DOMAINE de la page, v2/o/<org_key>/<hote>.js, qui pose la config de
            ce site (window.__korvusSite). Elle ne doit PAS entrer dans
            window.__korvus : le moteur y lirait la demande d'un fichier commun a
            toute l'organisation, et ignorerait la config du domaine.

          Volontairement absents :
          - websiteId : sans lui l'ingestion retrouve le site par l'Origin de la
            requete, parmi les sites actifs de l'organisation. C'est le mode de la
            balise finale, donc celui qu'il faut eprouver ici.
          - endpoint : le moteur vise deja https://app.korvus.fr/api/ingest par
            defaut.
          - platform : le moteur ne lit pas ce champ, il detecte la plateforme
            dans la page.

          Les scripts sont asynchrones : ni la config ni le moteur ne retiennent la
          page. Le moteur part des que la config a repondu ou echoue, et au plus
          tard apres 3 s si elle reste muette. Un seul gabarit, sans interpolation.
        */}
        {process.env.NODE_ENV === "production" && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
window.__korvus = {
  apiKey: "kv_test_0000000000000000000000000000000000000000000000000000000000000001"
};
(function (orgKey) {
  var engineStarted = false;
  function loadEngine() {
    if (engineStarted) return;
    engineStarted = true;
    var engine = document.createElement("script");
    engine.src = "https://cdn.korvus.fr/v2/korvus.min.js";
    engine.async = true;
    document.head.appendChild(engine);
  }
  var host = location.hostname;
  if (!/^[0-9a-f]{16}$/.test(orgKey) || !/^[a-z0-9.-]{1,253}$/.test(host)) {
    loadEngine();
    return;
  }
  var config = document.createElement("script");
  config.src = "https://cdn.korvus.fr/v2/o/" + orgKey + "/" + host + ".js";
  config.async = true;
  config.onload = loadEngine;
  config.onerror = loadEngine;
  setTimeout(loadEngine, 3000);
  document.head.appendChild(config);
})("a1ffd7744be8b248");
`,
            }}
          />
        )}
      </head>
      <body className="min-h-screen flex flex-col bg-doom-900 text-slate-200 scan-overlay">
        <CartProvider>
          <Suspense fallback={null}>
            <GTMPageView />
          </Suspense>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ChaosEngine />
          <CookieBanner />
        </CartProvider>
      </body>
    </html>
  );
}
