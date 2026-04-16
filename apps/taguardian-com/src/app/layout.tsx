import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CookieBanner } from "@/components/CookieBanner";
import { GTMPageView } from "@/components/GTMPageView";
import { ThemeScript } from "@/components/ThemeScript";


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

        {/* Google Tag Manager */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${process.env.NEXT_PUBLIC_GTM_ID}');`
          }}
        />
        {/* End Google Tag Manager */}
        {/* Fake Meta Pixel (fbq) — simulates pixel presence for testing */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.fbq=function(){window.__korvusTagLog=window.__korvusTagLog||[];window.__korvusTagLog.push({tag:"meta_pixel",args:[].slice.call(arguments),ts:Date.now()});};`,
          }}
        />
        {/* Fake GA4 (gtag) — simulates pixel presence for testing */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.gtag=function(){window.__korvusTagLog=window.__korvusTagLog||[];window.__korvusTagLog.push({tag:"ga4",args:[].slice.call(arguments),ts:Date.now()});};`,
          }}
        />
        {/* INJECT_SCRIPTS — snippet Korvus installé via GTM, plus de tag en dur */}
      </head>
      <body className="min-h-screen flex flex-col">
        {/* Google Tag Manager (noscript) */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${process.env.NEXT_PUBLIC_GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
          }}
        />
        {/* End Google Tag Manager (noscript) */}

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
