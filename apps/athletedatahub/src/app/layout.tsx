import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const isFR = process.env.NEXT_PUBLIC_LOCALE === "FR";

export const metadata: Metadata = {
  title: {
    default: isFR
      ? "AthleteDataHub – Équipement Sport & Nutrition"
      : "AthleteDataHub – Sports Gear & Nutrition",
    template: "%s | AthleteDataHub",
  },
  description: isFR
    ? "Vêtements, équipements et nutrition premium pour athlètes engagés."
    : "Premium sports apparel, equipment, and nutrition for dedicated athletes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={isFR ? "fr" : "en"}>
      <head>
        {/* INJECT_SCRIPTS */}
      </head>
      <body className="min-h-screen flex flex-col bg-gray-50">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
