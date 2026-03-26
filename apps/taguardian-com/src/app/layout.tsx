import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CookieBanner } from "@/components/CookieBanner";
import { GTMPageView } from "@/components/GTMPageView";
import { ThemeScript } from "@/components/ThemeScript";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "";

export const metadata: Metadata = {
  title: {
    default: "TagGuardian – Enterprise Cybersecurity Solutions",
    template: "%s | TagGuardian",
  },
  description:
    "High-ticket enterprise cybersecurity software, hardware, and managed services for security-first organisations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Theme initialisation – prevents flash of wrong theme */}
        <ThemeScript />

        {/* ── dataLayer initialised BEFORE GTM snippet ── */}
        <Script id="gtm-datalayer-init" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];`}
        </Script>

        {/* ── GTM snippet (disabled when no GTM_ID configured) ── */}
        {GTM_ID && (
          <Script id="gtm-script" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        )}
      </head>
      <body className="min-h-screen flex flex-col">
        {/* GTM noscript fallback */}
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}

        <CartProvider>
          {/* Route-change pageview events */}
          <Suspense fallback={null}>
            <GTMPageView />
          </Suspense>

          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <CookieBanner />
        </CartProvider>
      </body>
    </html>
  );
}
