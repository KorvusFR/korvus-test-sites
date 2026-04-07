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
        <script dangerouslySetInnerHTML={{ __html: `window.__korvus={websiteId:"00000000-0000-4000-a000-000000001013",apiKey:"kv_test_0000000000000000000000000000000000000000000000000000000000000001",endpoint:"/api/ingest",platform:"custom"};` }} />
        <script src="/api/snippet/korvus.min.js" defer />
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
