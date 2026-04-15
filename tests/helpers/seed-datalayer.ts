import type { Page } from "@playwright/test"

/**
 * Phase 7 B2 — seed window.dataLayer AVANT que le snippet ne monkey-patch
 * `push`. Reproduit le scénario réel "GTM tire un purchase en `<head>`
 * avant que le boot du snippet (post-load + requestIdleCallback) ait lieu".
 *
 * Usage :
 * ```ts
 *   await seedDataLayer(page, [
 *     { event: "purchase", ecommerce: { ... } }
 *   ])
 *   await injectSnippet(page, site)
 *   await page.goto(url)
 * ```
 *
 * Le `addInitScript` de ce helper s'exécute AVANT ceux de `injectSnippet`
 * (car il est appelé avant dans l'ordre d'enregistrement), donc le
 * dataLayer est peuplé avant que le snippet ne monkey-patch `push`.
 * Quand le snippet boot et itère les entrées existantes (le "replay"
 * dans [collectors/datalayer.ts](../../../platform/snippet/src/collectors/datalayer.ts)),
 * il retrouve les events seedés et les traite normalement.
 */
export async function seedDataLayer(
  page: Page,
  events: Array<Record<string, unknown>>,
): Promise<void> {
  await page.addInitScript((evts: Array<Record<string, unknown>>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (!Array.isArray(w.dataLayer)) {
      w.dataLayer = []
    }
    for (const e of evts) {
      w.dataLayer.push(e)
    }
  }, events)
}
