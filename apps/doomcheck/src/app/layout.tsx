import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChaosEngine } from "@/components/ChaosEngine";
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
        {/* INJECT_SCRIPTS */}
      </head>
      <body className="min-h-screen flex flex-col bg-doom-900 text-slate-200 scan-overlay">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ChaosEngine />
        </CartProvider>
      </body>
    </html>
  );
}
