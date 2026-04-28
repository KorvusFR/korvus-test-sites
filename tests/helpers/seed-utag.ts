import type { Page } from "@playwright/test"

/**
 * Bridge Tealium (avril 2026) — seed window.utag AVANT que le snippet ne
 * monkey-patch link/view. Reproduit le scenario reel "utag.js charge en
 * `<head>` (synchrone via tags.tiqcdn.com) avant que le boot du snippet
 * (post-load + requestIdleCallback) ait lieu".
 *
 * Usage :
 * ```ts
 *   await seedUtag(page)               // pose un utag stub vide
 *   await injectSnippet(page, {        // injecte snippet + enableTealiumBridge
 *     ...doomcheck,
 *     enableTealiumBridge: true,
 *   })
 *   await page.goto(url)
 *   // ... plus tard, dans le test :
 *   await page.evaluate(() => {
 *     window.utag.link({tealium_event: "purchase", order_id: "X", ...})
 *   })
 * ```
 *
 * Le `addInitScript` de ce helper s'execute AVANT ceux de `injectSnippet`
 * (ordre d'enregistrement). Quand le snippet boot, il trouve `window.utag`
 * deja en place et wrap link/view immediatement.
 *
 * Pour tester le late-load (utag arrive APRES le boot du snippet), ne pas
 * appeler ce helper et faire un `page.evaluate(() => window.utag = {...})`
 * dans le test apres le boot — le tealiumPatcher retry 30s pour rattraper
 * l'apparition de utag.
 */
export async function seedUtag(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (!w.utag) {
      w.utag = {
        // Stubs no-op : Tealium en prod fait du tracking serveur derriere,
        // mais pour les tests on s'en fiche — le snippet observe les
        // arguments via le wrap, pas le comportement Tealium.
        link: function () {
          return undefined
        },
        view: function () {
          return undefined
        },
      }
    }
    if (!w.utag_data) {
      w.utag_data = {}
    }
  })
}
