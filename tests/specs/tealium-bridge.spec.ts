import { test, expect, type Page } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"
import { seedUtag } from "../helpers/seed-utag"

// All tests run on doomcheck (port 3003).
// Bridge Tealium opt-in (avril 2026) — sites FR retail Tealium-driven (Fnac,
// Darty, Decathlon, OVS) remplacent window.dataLayer GTM par window.utag.link
// pour les fires e-commerce. Le snippet observe via tealiumPatcher + collectors/tealium.
//
// Spec coverage :
//   1. Bridge OFF par defaut -> aucun event capture
//   2. Bridge ON sans consent -> aucun event capture (consent gate)
//   3. Bridge ON + cart_add -> add_to_cart capture
//   4. Bridge ON + purchase complet -> purchase + datalayer_validation source=tealium
//   5. Bridge ON + purchase sans order_id -> datalayer_validation is_valid=false
//   6. Late-load utag -> capture les appels suivants

const doomcheck = getSiteConfig("doomcheck")

async function simulateAxeptio(page: Page, granted: boolean): Promise<void> {
  await page.addInitScript((consent: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w._axcb = []
    w.axeptio_settings = { cookies: { google_analytics: consent } }
  }, granted)
}

test.describe("Bridge Tealium — opt-in + consent gate", () => {
  test("Bridge OFF par defaut : utag.link({tealium_event: 'purchase'}) -> aucun event capture", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    await seedUtag(page)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    // Pas de enableTealiumBridge -> bridge OFF
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const utag = (window as any).utag
      utag.link({
        tealium_event: "purchase",
        order_id: "TX-OFF",
        order_total: 10,
        order_currency_code: "EUR",
        product_id: ["S"],
      })
    })

    await page.waitForTimeout(500)
    await interceptor.triggerFlush()

    // Aucun event Tealium capture (bridge OFF)
    const purchases = interceptor.getEvents("purchase")
    expect(purchases).toHaveLength(0)
    const validations = interceptor.getEvents("datalayer_validation")
    const tealiumValidations = validations.filter(
      (e) => e.payload.source === "tealium",
    )
    expect(tealiumValidations).toHaveLength(0)
  })

  test("Bridge ON sans consent : utag.link purchase -> aucun event (consent gate)", async ({
    page,
  }) => {
    await simulateAxeptio(page, false) // consent denied
    await seedUtag(page)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, { ...doomcheck, enableTealiumBridge: true })

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const utag = (window as any).utag
      utag.link({
        tealium_event: "purchase",
        order_id: "TX-DENIED",
        order_total: 10,
        order_currency_code: "EUR",
        product_id: ["S"],
      })
    })

    await page.waitForTimeout(500)
    await interceptor.triggerFlush()

    const purchases = interceptor.getEvents("purchase")
    expect(
      purchases,
      "purchase doit etre bloque par le consent gate (denied)",
    ).toHaveLength(0)
  })

  test("Bridge ON + consent granted + cart_add -> add_to_cart capture", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    await seedUtag(page)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, { ...doomcheck, enableTealiumBridge: true })

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const utag = (window as any).utag
      utag.link({
        tealium_event: "cart_add",
        product_id: ["SKU-T1"],
        product_name: ["Tealium Test Product"],
        order_total: "49.99",
        order_currency_code: "EUR",
      })
    })

    await page.waitForTimeout(500)
    await interceptor.triggerFlush()

    const atcs = interceptor.getEvents("add_to_cart")
    expect(atcs.length, "add_to_cart should be captured").toBeGreaterThan(0)
    expect(atcs[0].payload.product_id).toBe("SKU-T1")
    expect(atcs[0].payload.product_name).toBe("Tealium Test Product")
    expect(atcs[0].payload.value).toBe(49.99)
    expect(atcs[0].payload.currency).toBe("EUR")
  })

  test("Bridge ON + purchase complet -> purchase + datalayer_validation source=tealium", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    await seedUtag(page)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, { ...doomcheck, enableTealiumBridge: true })

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const utag = (window as any).utag
      utag.link({
        tealium_event: "purchase",
        order_id: "TX-FNAC-001",
        order_total: "199.99",
        order_currency_code: "EUR",
        order_promo_code: "SUMMER10",
        order_discount_amount: "20",
        product_id: ["SKU-A", "SKU-B"],
        product_name: ["Item A", "Item B"],
        // Champs identifiants — DOIVENT etre ignores par le bridge
        customer_email: "leak@example.com",
        tealium_visitor_id: "VID-ABCDEF",
      })
    })

    await page.waitForTimeout(500)
    await interceptor.triggerFlush()

    // purchase emit avec les bonnes donnees
    const purchases = interceptor.getEvents("purchase")
    expect(purchases.length, "purchase should be captured").toBeGreaterThan(0)
    expect(purchases[0].payload.transaction_id).toBe("TX-FNAC-001")
    expect(purchases[0].payload.value).toBe(199.99)
    expect(purchases[0].payload.currency).toBe("EUR")
    expect(purchases[0].payload.items_count).toBe(2)
    expect(purchases[0].payload.promo_code).toBe("SUMMER10")
    expect(purchases[0].payload.discount_value).toBe(20)

    // datalayer_validation marque source=tealium et is_valid=true
    const validations = interceptor.getEvents("datalayer_validation")
    const tealiumPurchaseValidation = validations.find(
      (e) =>
        e.payload.event_name === "purchase" && e.payload.source === "tealium",
    )
    expect(tealiumPurchaseValidation).toBeDefined()
    expect(tealiumPurchaseValidation!.payload.is_valid).toBe(true)

    // CNIL : aucun champ identifiant ne fuite dans aucun event
    const allBatches = interceptor.getAllBatches()
    const dump = JSON.stringify(allBatches)
    expect(
      dump,
      "leak@example.com ne doit JAMAIS apparaitre dans un payload",
    ).not.toContain("leak@example.com")
    expect(
      dump,
      "VID-ABCDEF ne doit JAMAIS apparaitre dans un payload",
    ).not.toContain("VID-ABCDEF")
  })

  test("Bridge ON + purchase sans order_id -> datalayer_validation is_valid=false", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    await seedUtag(page)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, { ...doomcheck, enableTealiumBridge: true })

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const utag = (window as any).utag
      utag.link({
        tealium_event: "purchase",
        // Pas d'order_id ni transaction_id
        order_total: "10",
        order_currency_code: "EUR",
        product_id: ["S"],
      })
    })

    await page.waitForTimeout(500)
    await interceptor.triggerFlush()

    const validations = interceptor.getEvents("datalayer_validation")
    const tealiumValidation = validations.find(
      (e) =>
        e.payload.event_name === "purchase" && e.payload.source === "tealium",
    )
    expect(tealiumValidation).toBeDefined()
    expect(tealiumValidation!.payload.is_valid).toBe(false)
    expect(tealiumValidation!.payload.missing_fields).toContain(
      "transaction_id",
    )
  })

  test("Late-load utag : utag arrive 2s apres boot -> cart_add capture", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    // PAS de seedUtag — utag absent au boot

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, { ...doomcheck, enableTealiumBridge: true })

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000) // boot du snippet, utag pas encore la

    // utag materialise apres 2s — le tealiumPatcher retry 500ms x 30s
    await page.waitForTimeout(2000)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.utag = {
        link: function () {
          return undefined
        },
        view: function () {
          return undefined
        },
      }
    })

    // Laisse le retry tiquer (max 500ms)
    await page.waitForTimeout(700)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const utag = (window as any).utag
      utag.link({
        tealium_event: "cart_add",
        product_id: ["LATE-SKU"],
        order_total: 25,
        order_currency_code: "EUR",
      })
    })

    await page.waitForTimeout(500)
    await interceptor.triggerFlush()

    const atcs = interceptor.getEvents("add_to_cart")
    expect(
      atcs.length,
      "late-load utag.link should be captured by retry",
    ).toBeGreaterThan(0)
    expect(atcs[0].payload.product_id).toBe("LATE-SKU")
  })
})
