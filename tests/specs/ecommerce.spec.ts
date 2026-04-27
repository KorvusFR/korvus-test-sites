import { test, expect } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// All tests run on doomcheck (port 3003)

const doomcheck = getSiteConfig("doomcheck")

// ---------------------------------------------------------------------------
// Test 10 — add_to_cart_attempt (exempt)
// ---------------------------------------------------------------------------

test.describe("Test 10 — add_to_cart_attempt", () => {
  test("captures ATC click with product_id from JSON-LD", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(1500)

    // Click the ATC button
    await page.click("button.gap-2")
    // Wait for the 2s PerformanceObserver timeout to fire
    await page.waitForTimeout(2500)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("add_to_cart_attempt")
    expect(events.length, "add_to_cart_attempt should be captured").toBeGreaterThan(0)

    const evt = events[0]
    expect(evt.payload.product_id).toBe("1")
    expect(evt.payload.product_name).toBe("NovaPro X12 Smartphone")
    expect(evt.payload).toHaveProperty("success")
    expect(evt.payload.page_url).toContain("/products/novapro-x12")
  })

  test("success: false when no cart endpoint request detected", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(1500)

    // Click ATC — doomcheck only writes to localStorage, no network request
    await page.click("button.gap-2")
    await page.waitForTimeout(2500)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("add_to_cart_attempt")
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].payload.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Test 11 — search_performed (exempt)
// ---------------------------------------------------------------------------

test.describe("Test 11 — search_performed", () => {
  test("captures query from search page (consent granted)", async ({ page }) => {
    // V2 — search_performed.query est consent-gated (strippé sans consent).
    // Ce test vérifie qu'avec consent granted, la query est bien présente.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w._axcb = []
      w.axeptio_settings = { cookies: { google_analytics: true } }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/search?q=NovaPro")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("search_performed")
    expect(
      events.length,
      "search_performed should be captured",
    ).toBeGreaterThan(0)

    const evt = events[0]
    expect(evt.payload.query).toBe("NovaPro")
  })

  test("captures results_count with custom domSelector", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    // Search with results
    await page.goto("/search?q=NovaPro")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("search_performed")
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].payload.results_count).toBeGreaterThan(0)
  })

  test("results_count is 0 for no-match search", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/search?q=xyznonexistent")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("search_performed")
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].payload.results_count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test 12 — pageviews.product_available (OOS signal, V2)
// V2 supprime l'event out_of_stock_viewed. Le signal OOS vit désormais dans
// la colonne dénormalisée pageviews.product_available (cascade Schema.org →
// ATC disabled → sélecteur → texte visible). Ces tests asservissent cette
// colonne, pas un event raw_events.
// ---------------------------------------------------------------------------

test.describe("Test 12 — pageviews.product_available (OOS)", () => {
  test("OOS product via Schema.org OutOfStock → product_available = false", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    // glitchbuds-ultra is out of stock with OutOfStock in JSON-LD
    // Note: 2800ms wait parce que la cascade product est en scheduleIdleTask
    // qui fallback sur setTimeout(2000) sur WebKit (pas de requestIdleCallback).
    await page.goto("/products/glitchbuds-ultra")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const pv = interceptor
      .getPageviews()
      .find((p) => p.path.includes("/products/glitchbuds-ultra"))
    expect(pv, "pageview for glitchbuds-ultra should be captured").toBeDefined()
    expect(pv!.product_id).toBe("11")
    expect(pv!.product_name).toContain("GlitchBuds")
    expect(pv!.product_available).toBe(false)
  })

  test("in-stock product → product_available = true", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const pv = interceptor
      .getPageviews()
      .find((p) => p.path.includes("/products/novapro-x12"))
    expect(pv, "pageview for novapro-x12 should be captured").toBeDefined()
    expect(pv!.product_available).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 13 — structured_data_check (exempt)
// ---------------------------------------------------------------------------

test.describe("Test 13 — structured_data_check", () => {
  test("complete JSON-LD → has_product_schema: true, no missing fields", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("structured_data_check")
    expect(events.length).toBeGreaterThan(0)

    const evt = events[0]
    expect(evt.payload.has_product_schema).toBe(true)
    expect(evt.payload.has_offer_schema).toBe(true)
    expect(evt.payload.missing_fields).toEqual([])
  })

  test("broken JSON-LD → missing price, availability, image", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    // glitchphone-9 has intentionally broken JSON-LD (no price, no availability, no image)
    await page.goto("/products/glitchphone-9")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("structured_data_check")
    expect(events.length).toBeGreaterThan(0)

    const evt = events[0]
    expect(evt.payload.has_product_schema).toBe(true)
    expect(evt.payload.has_offer_schema).toBe(true)
    const missing = evt.payload.missing_fields as string[]
    expect(missing).toContain("image")
    expect(missing).toContain("offers.price")
    expect(missing).toContain("offers.availability")
  })
})

// ---------------------------------------------------------------------------
// Test 14 — datalayer_validation (consent required)
// ---------------------------------------------------------------------------

test.describe("Test 14 — datalayer_validation", () => {
  test("valid purchase push → is_valid: true", async ({ page }) => {
    // Simulate Axeptio consent GRANTED before snippet boots
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w._axcb = []
      w.axeptio_settings = { cookies: { google_analytics: true } }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(2000)

    // Push a valid purchase event to dataLayer
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "TX-TEST-001",
          value: 449,
          currency: "EUR",
          items: [
            {
              item_id: "1",
              item_name: "NovaPro X12",
              price: 449,
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
      "datalayer_validation for purchase should be captured",
    ).toBeDefined()
    expect(purchaseValidation!.payload.is_valid).toBe(true)
    expect(purchaseValidation!.payload.missing_fields).toEqual([])

    // purchase enriched event should also be emitted
    const purchases = interceptor.getEvents("purchase")
    expect(purchases.length).toBeGreaterThan(0)
    expect(purchases[0].payload.transaction_id).toBe("TX-TEST-001")
    expect(purchases[0].payload.value).toBe(449)
  })

  test("purchase without value → is_valid: false, missing_fields includes value", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w._axcb = []
      w.axeptio_settings = { cookies: { google_analytics: true } }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(2000)

    // Push a broken purchase event (missing value and transaction_id)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer.push({
        event: "purchase",
        ecommerce: {
          currency: "EUR",
          items: [{ item_id: "1", item_name: "Test", price: 10, quantity: 1 }],
        },
      })
    })
    await page.waitForTimeout(500)

    await interceptor.triggerFlush()

    const validations = interceptor.getEvents("datalayer_validation")
    const broken = validations.find(
      (e) => e.payload.event_name === "purchase",
    )
    expect(broken, "broken purchase validation should be captured").toBeDefined()
    expect(broken!.payload.is_valid).toBe(false)
    const missing = broken!.payload.missing_fields as string[]
    expect(missing).toContain("value")
    expect(missing).toContain("transaction_id")
  })

  test("without consent → datalayer_validation NOT sent", async ({ page }) => {
    // No Axeptio simulation → consent stays "unknown" (not granted)
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/")
    await page.waitForTimeout(2000)

    // Push purchase event — should be ignored since dataLayer collector is not initialized
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "TX-NOCONSENT",
          value: 100,
          currency: "EUR",
          items: [{ item_id: "1", item_name: "Test", price: 100, quantity: 1 }],
        },
      })
    })
    await page.waitForTimeout(500)

    await interceptor.triggerFlush()

    const validations = interceptor.getEvents("datalayer_validation")
    expect(
      validations.length,
      "datalayer_validation should NOT be sent without consent",
    ).toBe(0)

    const purchases = interceptor.getEvents("purchase")
    expect(
      purchases.length,
      "purchase event should NOT be sent without consent",
    ).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Test 15 — pageviews.product_* columns (V2, product_seen supprimé)
// V2 supprime l'event product_seen. Les infos produit vivent désormais
// directement dans les colonnes dénormalisées de pageviews :
//   - exempts : product_id, product_id_source, product_name, product_name_source
//   - consent required : product_price_visible, product_currency
// ---------------------------------------------------------------------------

test.describe("Test 15 — pageviews.product_* columns", () => {
  test("PDP without consent → id/name captured, price/currency stripped", async ({
    page,
  }) => {
    // No consent simulation — consent stays "unknown"
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    // novapro-x12 has complete JSON-LD (sku "1", price 449, EUR)
    // Note: 2800ms parce que la cascade product passe par scheduleIdleTask
    // qui fallback sur setTimeout(2000) quand requestIdleCallback est
    // absent (Safari). 2000ms seul = race condition flaky sur WebKit.
    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const pv = interceptor
      .getPageviews()
      .find((p) => p.path.includes("/products/novapro-x12"))
    expect(pv, "pageview for novapro-x12 should be captured").toBeDefined()
    expect(pv!.page_type).toBe("pdp")
    expect(pv!.product_id).toBe("1")
    expect(pv!.product_name).toBe("NovaPro X12 Smartphone")
    // Consent-gated : strippé côté snippet sans consent granted
    expect(pv!.product_price_visible ?? null).toBeNull()
    expect(pv!.product_currency ?? null).toBeNull()
  })

  test("PDP with consent granted → price and currency present", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w._axcb = []
      w.axeptio_settings = { cookies: { google_analytics: true } }
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const pv = interceptor
      .getPageviews()
      .find((p) => p.path.includes("/products/novapro-x12"))
    expect(pv, "pageview for novapro-x12 should be captured").toBeDefined()
    expect(pv!.product_id).toBe("1")
    expect(pv!.product_price_visible).toBe(449)
    expect(pv!.product_currency).toBe("EUR")
  })
})
