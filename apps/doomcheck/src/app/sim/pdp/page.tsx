import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sim PDP",
};

// Fixture page pour tests E2E v2 — PDP minimal.
// - JSON-LD Product force page_type=pdp (cascade JSON-LD du snippet)
// - Bouton ATC statique (class .add-to-cart, id sim-atc) présent dès le
//   load pour que findAtcButton() trouve le bouton à l'init du collector
//   add_to_cart_attempt. Sans ce bouton statique, le collector quitte
//   immédiatement et l'event add_to_cart_succeeded n'est jamais armé.
// - #sim-root reste vide : tests Playwright y injectent du DOM runtime.
const productJsonLd = {
  "@context": "https://schema.org/",
  "@type": "Product",
  name: "Simulation Product Alpha",
  sku: "SIM-001",
  image: "https://doomcheck.me/sim.jpg",
  description: "E2E test fixture product.",
  offers: {
    "@type": "Offer",
    price: 99.99,
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    url: "https://doomcheck.me/sim/pdp",
  },
};

export default function SimPdpPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <h1 className="text-2xl font-bold text-slate-100">Simulation PDP</h1>
      <p className="text-slate-400 mt-2">
        E2E fixture. Tests drive DOM via page.evaluate.
      </p>
      <div className="mt-8">
        <button
          type="button"
          id="sim-atc"
          className="add-to-cart px-4 py-2 bg-doom-red rounded"
        >
          Add to cart
        </button>
      </div>
      <div id="sim-root" data-testid="sim-root" className="mt-8" />
    </div>
  );
}
