import { test, expect } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// All tests run on athletedatahub (port 3001)
// Only tests that DIFFER from doomcheck — site-specific behaviors

const adh = getSiteConfig("athletedatahub")

const PAGE_TYPE_RULES = {
  plp: { url_contains: "/catalog" },
  search: { url_contains: "/search" },
  checkout: { url_contains: "/checkout" },
  cart: { url_contains: "/cart" },
}

// Axeptio simulation — athletedatahub's CMP (window.__korvusCMP) is NOT detected by snippet
async function simulateAxeptio(
  page: import("@playwright/test").Page,
  granted: boolean,
): Promise<void> {
  await page.addInitScript((consent: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w._axcb = []
    w.axeptio_settings = { cookies_consent: consent }
  }, granted)
}

// ---------------------------------------------------------------------------
// page_type detection
// ---------------------------------------------------------------------------

test.describe("ADH — page_type detection", () => {
  const cases = [
    { name: "home", path: "/", expected: "home" },
    { name: "pdp (JSON-LD)", path: "/products/pro-training-tshirt-black", expected: "pdp" },
    { name: "plp (pageTypeRules)", path: "/catalog", expected: "plp" },
    { name: "search (pageTypeRules)", path: "/search?q=protein", expected: "search" },
    { name: "checkout (pageTypeRules)", path: "/checkout", expected: "checkout" },
    { name: "cart (pageTypeRules)", path: "/cart", expected: "cart" },
  ]

  for (const c of cases) {
    test(`${c.name} → page_type = "${c.expected}"`, async ({ page }) => {
      const interceptor = new IngestInterceptor(page)
      await interceptor.attach()
      await injectSnippet(page, {
        ...adh,
        pageTypeRules: PAGE_TYPE_RULES,
      })

      await page.goto(c.path)
      await page.waitForTimeout(2000)

      await interceptor.triggerFlush()

      const pageviews = interceptor.getPageviews()
      expect(pageviews.length).toBeGreaterThan(0)
      expect(
        pageviews[0].page_type,
        `${c.path} should be detected as "${c.expected}"`,
      ).toBe(c.expected)
    })
  }
})

// ---------------------------------------------------------------------------
// structured_data_check (exempt)
// ---------------------------------------------------------------------------

test.describe("ADH — structured_data_check", () => {
  test("PDP with complete JSON-LD → has_product_schema: true", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, adh)

    await page.goto("/products/pro-training-tshirt-black")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("structured_data_check")
    expect(events.length).toBeGreaterThan(0)

    const evt = events[0]
    expect(evt.payload.has_product_schema).toBe(true)
    expect(evt.payload.has_offer_schema).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// product_seen (consent required)
// ---------------------------------------------------------------------------

test.describe("ADH — product_seen", () => {
  test("with consent on PDP → captures product from JSON-LD", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, adh)

    await page.goto("/products/pro-training-tshirt-black")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("product_seen")
    expect(
      events.length,
      "product_seen should be captured with consent on PDP",
    ).toBeGreaterThan(0)

    const evt = events[0]
    expect(evt.payload.product_id).toBeDefined()
    expect(evt.payload.product_name).toBeDefined()
    expect(evt.payload.price).toBeDefined()
    expect(evt.payload.currency).toBeDefined()
  })

  test("without consent → product_seen NOT sent", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, adh)

    await page.goto("/products/pro-training-tshirt-black")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("product_seen")
    expect(events.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// out_of_stock_viewed (exempt)
// ---------------------------------------------------------------------------

test.describe("ADH — out_of_stock_viewed", () => {
  test("OOS product (push-up-handles-rotating) fires event", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, adh)

    await page.goto("/products/push-up-handles-rotating")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("out_of_stock_viewed")
    expect(
      events.length,
      "out_of_stock_viewed should fire for OOS product",
    ).toBeGreaterThan(0)

    const evt = events[0]
    expect(evt.payload.product_id).toBe("28")
    expect(evt.payload.product_url).toContain("/products/push-up-handles-rotating")
  })

  test("in-stock product does NOT fire out_of_stock_viewed", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...adh,
      domSelectors: { add_to_cart: "button.gap-2" },
    })

    await page.goto("/products/pro-training-tshirt-black")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("out_of_stock_viewed")
    expect(events.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// search_performed (exempt)
// ---------------------------------------------------------------------------

test.describe("ADH — search_performed", () => {
  test("search with results → results_count > 0", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...adh,
      pageTypeRules: PAGE_TYPE_RULES,
      domSelectors: { search_results_count: "p.text-sm.text-gray-500.mt-1" },
    })

    await page.goto("/search?q=protein")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("search_performed")
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].payload.query).toBe("protein")
    expect(events[0].payload.results_count).toBeGreaterThan(0)
  })

  test("search zero results → results_count = 0", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...adh,
      pageTypeRules: PAGE_TYPE_RULES,
      domSelectors: { search_results_count: "p.text-sm.text-gray-500.mt-1" },
    })

    await page.goto("/search?q=xyzzznotfound")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("search_performed")
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].payload.results_count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// dataLayer — datalayer_validation + purchase (consent required)
// ---------------------------------------------------------------------------

test.describe("ADH — dataLayer validation", () => {
  test("manual purchase push → datalayer_validation is_valid: true + purchase event", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, adh)

    await page.goto("/")
    await page.waitForTimeout(2000)

    // Push a valid purchase to dataLayer
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "ADH-TEST-001",
          value: 89.99,
          currency: "USD",
          items: [
            {
              item_id: "1",
              item_name: "Whey Protein",
              price: 89.99,
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
    expect(purchaseValidation).toBeDefined()
    expect(purchaseValidation!.payload.is_valid).toBe(true)

    const purchases = interceptor.getEvents("purchase")
    expect(purchases.length).toBeGreaterThan(0)
    expect(purchases[0].payload.transaction_id).toBe("ADH-TEST-001")
  })

  test("without consent → datalayer_validation NOT sent", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, adh)

    await page.goto("/")
    await page.waitForTimeout(2000)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer = (window as any).dataLayer || []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "ADH-NOCONSENT",
          value: 50,
          currency: "USD",
          items: [{ item_id: "1", item_name: "Test", price: 50, quantity: 1 }],
        },
      })
    })
    await page.waitForTimeout(500)

    await interceptor.triggerFlush()

    expect(interceptor.getEvents("datalayer_validation").length).toBe(0)
    expect(interceptor.getEvents("purchase").length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Consent — CMP not detected, Axeptio simulation needed
// ---------------------------------------------------------------------------

test.describe("ADH — consent flow", () => {
  test("consent granted → UTMs captured, consent-gated events sent", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, adh)

    await page.goto("/?utm_source=google&utm_medium=cpc&utm_campaign=adh_test&gclid=test123")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const session = interceptor.getSession()
    expect(session).toBeDefined()
    expect(session!.consent_status).toBe("granted")
    expect(session!.utm_source).toBe("google")
    expect(session!.utm_medium).toBe("cpc")
    expect(session!.utm_campaign).toBe("adh_test")
    expect(session!.is_paid_traffic).toBe(true)
    expect(session!.has_gclid).toBe(true)
  })

  test("consent denied → UTMs absent, consent-gated events blocked", async ({
    page,
  }) => {
    await simulateAxeptio(page, false)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, adh)

    await page.goto("/?utm_source=google&utm_medium=cpc&gclid=test123")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const session = interceptor.getSession()
    expect(session).toBeDefined()
    expect(session!.consent_status).toBe("denied")
    expect(session!.utm_source).toBeNull()
    expect(session!.utm_medium).toBeNull()
    expect(session!.is_paid_traffic).toBe(false)
    expect(session!.has_gclid).toBe(false)
  })
})
