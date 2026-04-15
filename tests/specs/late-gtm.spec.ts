import { test, expect, type Page } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"
import { seedDataLayer } from "../helpers/seed-datalayer"

// All tests run on doomcheck (port 3003).
// V2 audit item (c) — GTM injecté tardivement :
// Scénario réel : le CMS du client charge GTM en `defer`, ou bien des
// events dataLayer sont poussés plusieurs secondes après le boot du
// snippet. Le monkey-patch sur dataLayer.push doit persister et capter
// tous les pushes à venir, peu importe quand ils arrivent.

const doomcheck = getSiteConfig("doomcheck")

async function simulateAxeptio(page: Page, granted: boolean): Promise<void> {
  await page.addInitScript((consent: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w._axcb = []
    w.axeptio_settings = { cookies_consent: consent }
  }, granted)
}

test.describe("V2 — dataLayer late push (audit item c)", () => {
  test("purchase poussé 3s après boot du snippet → datalayer_validation + purchase émis", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000) // boot du snippet

    // Simule un GTM qui arrive 3s après le boot et pousse un event.
    await page.waitForTimeout(3000)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "TX-LATE-001",
          value: 199.99,
          currency: "EUR",
          items: [
            {
              item_id: "SIM-001",
              item_name: "Sim Product",
              price: 199.99,
              quantity: 1,
            },
          ],
        },
      })
    })

    await page.waitForTimeout(500)
    await interceptor.triggerFlush()

    const validations = interceptor.getEvents("datalayer_validation")
    const purchaseValidation = validations.find(
      (e) => e.payload.event_name === "purchase",
    )
    expect(
      purchaseValidation,
      "datalayer_validation for late purchase should be captured",
    ).toBeDefined()
    expect(purchaseValidation!.payload.is_valid).toBe(true)

    const purchases = interceptor.getEvents("purchase")
    expect(purchases.length).toBeGreaterThan(0)
    expect(purchases[0].payload.transaction_id).toBe("TX-LATE-001")
    expect(purchases[0].payload.value).toBe(199.99)
  })

  test("plusieurs pushes espacés dans le temps sont tous captés", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000)

    // Push #1 à T+1s
    await page.waitForTimeout(1000)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "add_to_cart",
        ecommerce: {
          value: 49.99,
          currency: "EUR",
          items: [
            { item_id: "SIM-A", item_name: "A", price: 49.99, quantity: 1 },
          ],
        },
      })
    })

    // Push #2 à T+3s (GTM injecté tard)
    await page.waitForTimeout(2000)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "TX-SEQ-002",
          value: 99.99,
          currency: "EUR",
          items: [
            { item_id: "SIM-B", item_name: "B", price: 99.99, quantity: 1 },
          ],
        },
      })
    })

    await page.waitForTimeout(500)
    await interceptor.triggerFlush()

    const atcEvents = interceptor.getEvents("add_to_cart")
    expect(atcEvents.length, "add_to_cart should be captured").toBeGreaterThan(0)
    expect(atcEvents[0].payload.value).toBe(49.99)

    const purchases = interceptor.getEvents("purchase")
    expect(purchases.length, "late purchase should be captured").toBeGreaterThan(0)
    expect(purchases[0].payload.transaction_id).toBe("TX-SEQ-002")
  })
})

// ---------------------------------------------------------------------------
// Phase 7 B2 — DataLayer pre-boot replay
// ---------------------------------------------------------------------------
//
// Scénario réel : GTM tourne dans `<head>` et pousse des events purchase /
// add_to_cart AVANT que le snippet Korvus (loaded en `defer` ou en post-load)
// ait bouté et monkey-patché `dataLayer.push`. Le collector doit itérer les
// entrées déjà présentes dans `window.dataLayer` au moment du monkey-patch
// et les traiter comme si elles venaient d'arriver — sinon l'event le plus
// important de la session (purchase) est perdu sur un checkout rapide.
//
// Wiring snippet : [collectors/datalayer.ts](../../../platform/snippet/src/collectors/datalayer.ts)
// iterate sur `window.dataLayer` existant dans `attach({ replay: true })`.

test.describe("Phase 7 B2 — DataLayer pre-boot replay", () => {
  test("events poussés AVANT boot du snippet sont replayés au monkey-patch", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    // Seed le dataLayer AVANT injectSnippet. L'ordre des addInitScript est
    // important : seed → config window.__korvus → snippet code. Le snippet
    // voit dataLayer déjà populé quand il boot et itère les entrées.
    await seedDataLayer(page, [
      {
        event: "purchase",
        ecommerce: {
          transaction_id: "TX-PREBOOT-001",
          value: 299.99,
          currency: "EUR",
          items: [
            {
              item_id: "PREBOOT-A",
              item_name: "Pre-boot Product",
              price: 299.99,
              quantity: 1,
            },
          ],
        },
      },
      {
        event: "add_to_cart",
        ecommerce: {
          value: 49.99,
          currency: "EUR",
          items: [
            {
              item_id: "PREBOOT-B",
              item_name: "Pre-boot ATC",
              price: 49.99,
              quantity: 1,
            },
          ],
        },
      },
    ])

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    // Navigation — à ce moment dataLayer contient déjà 2 events seedés.
    // Le snippet boot post-load, monkey-patche push, et replay les entrées.
    await page.goto("/")
    await page.waitForTimeout(1500) // boot + replay

    await interceptor.triggerFlush()

    // --- Assertions ---

    // La purchase pré-boot doit avoir été replayée et validée.
    const purchases = interceptor.getEvents("purchase")
    const preBootPurchase = purchases.find(
      (e) => e.payload.transaction_id === "TX-PREBOOT-001",
    )
    expect(
      preBootPurchase,
      "pre-boot purchase should be replayed when snippet boots and monkey-patches dataLayer.push",
    ).toBeDefined()
    expect(preBootPurchase!.payload.value).toBe(299.99)

    // L'add_to_cart pré-boot doit aussi avoir été replayé.
    const atcs = interceptor.getEvents("add_to_cart")
    const preBootAtc = atcs.find((e) => e.payload.product_id === "PREBOOT-B")
    expect(
      preBootAtc,
      "pre-boot add_to_cart should also be replayed",
    ).toBeDefined()
    expect(preBootAtc!.payload.value).toBe(49.99)
  })
})
