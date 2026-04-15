import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sim Checkout",
};

// Fixture page pour tests E2E v2 — checkout minimal.
// - Les tests passent pageTypeRules={ checkout: { url_contains: "/sim/checkout" } }
//   pour forcer page_type=checkout (nécessaire pour payment_method_selected,
//   shipping_method_selected, payment_attempted, 3ds_*, promo_applied DOM).
// - .sim-promo-code est statique pour le test promo_applied DOM. Le
//   collector promo-applied lit le sélecteur une seule fois au idle task
//   post-load, donc l'élément doit exister avant le boot du snippet.
// - #sim-root reste vide : tests Playwright y injectent du DOM runtime.
export default function SimCheckoutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-100">Simulation Checkout</h1>
      <p className="text-slate-400 mt-2">
        E2E fixture. Tests drive DOM via page.evaluate.
      </p>
      <div className="mt-6">
        <span className="sim-promo-code px-2 py-1 rounded bg-doom-800 font-mono text-xs">
          SUMMER20
        </span>
      </div>
      <div id="sim-root" data-testid="sim-root" className="mt-8" />
    </div>
  );
}
