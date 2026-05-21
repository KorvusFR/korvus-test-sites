import { test, expect } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// ⚠️ MANUAL ONLY — ce spec n'est exécuté par AUCUN projet Playwright.
//
// Décision pérenne (pas un reste historique) : `taguardian-com` (port 3002,
// GTM dataLayer) est réservé aux tests manuels et au load testing côté
// utilisateur. Ne jamais l'ajouter à un `testMatch` dans `playwright.config.ts`.
//
// Voir :
//  - test_website/.claude/rules/tests-snippet.md (règle "Hors scope auto")
//  - platform/.claude/rules/testing.md ("réservé aux tests manuels")
//
// Ce fichier reste utile comme référence des cas site-specific qui diffèrent
// de doomcheck (cookie banner localStorage, dataLayer GA4, etc.) et sert de
// base pour les runs manuels. Il ne doit pas être supprimé — il doit juste
// rester orphelin du côté CI.

const tgd = getSiteConfig("taguardian-com")

// Axeptio simulation — taguardian-com's CookieBanner (localStorage) is NOT detected by snippet
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

test.describe("TGD — page_type detection", () => {
  const cases = [
    { name: "home", path: "/", expected: "home" },
    { name: "pdp (JSON-LD)", path: "/products/crowdstrike-falcon-pro-endpoint", expected: "pdp" },
    { name: "plp (URL pattern /catalog)", path: "/catalog", expected: "plp" },
    { name: "search (URL pattern /search)", path: "/search?q=firewall", expected: "search" },
    { name: "checkout (URL pattern /checkout)", path: "/checkout", expected: "checkout" },
    { name: "cart (URL pattern /cart)", path: "/cart", expected: "cart" },
    { name: "blog → other", path: "/blog/zero-trust-architecture-2025-guide", expected: "other" },
  ]

  for (const c of cases) {
    test(`${c.name} → page_type = "${c.expected}"`, async ({ page }) => {
      const interceptor = new IngestInterceptor(page)
      await interceptor.attach()
      await injectSnippet(page, tgd)

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
// out_of_stock_viewed (exempt)
// ---------------------------------------------------------------------------

test.describe("TGD — out_of_stock_viewed", () => {
  test("OOS product (corsair-kvm-secure-4k) fires event", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/products/corsair-kvm-secure-4k")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("out_of_stock_viewed")
    expect(
      events.length,
      "out_of_stock_viewed should fire for OOS product",
    ).toBeGreaterThan(0)

    const evt = events[0]
    expect(evt.payload.product_id).toBe("60")
    expect(evt.payload.product_url).toContain("/products/corsair-kvm-secure-4k")
  })

  test("in-stock product does NOT fire out_of_stock_viewed", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/products/crowdstrike-falcon-pro-endpoint")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("out_of_stock_viewed")
    expect(events.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// tag_fired — fake pixels (consent required)
// ---------------------------------------------------------------------------

test.describe("TGD — tag_fired (fake pixels)", () => {
  test("with consent → detects window.fbq and window.gtag as tag_fired", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/")
    await page.waitForTimeout(3000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("tag_fired")
    expect(
      events.length,
      "tag_fired events should be detected for fake pixels",
    ).toBeGreaterThan(0)

    const tagNames = events.map((e) => e.payload.tag_name)
    expect(
      tagNames.some((t) => String(t).toLowerCase().includes("meta") || String(t).toLowerCase().includes("facebook") || t === "fbq"),
      "Meta/Facebook pixel should be detected via window.fbq",
    ).toBe(true)
    expect(
      tagNames.some((t) => String(t).toLowerCase().includes("google") || String(t).toLowerCase().includes("ga4") || t === "gtag"),
      "Google/GA4 tag should be detected via window.gtag",
    ).toBe(true)
  })

  test("without consent → tag_fired NOT sent", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/")
    await page.waitForTimeout(3000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("tag_fired")
    expect(
      events.length,
      "tag_fired should NOT be sent without consent",
    ).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// dataLayer — native GTM events (consent required)
// ---------------------------------------------------------------------------

test.describe("TGD — dataLayer validation", () => {
  test("valid purchase push → datalayer_validation is_valid: true", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/")
    await page.waitForTimeout(2000)

    // Push a valid purchase to dataLayer
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "TGD-TEST-001",
          value: 1200,
          currency: "EUR",
          items: [
            {
              item_id: "1",
              item_name: "CrowdStrike Falcon Pro",
              price: 1200,
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
    expect(purchases[0].payload.transaction_id).toBe("TGD-TEST-001")
  })

  test("broken purchase (chaos mode) → is_valid: false, missing value + transaction_id", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/")
    await page.waitForTimeout(2000)

    // Simulate the broken_purchase chaos: missing value and transaction_id
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer.push({
        event: "purchase",
        ecommerce: {
          currency: "EUR",
          items: [
            {
              item_id: "1",
              item_name: "CrowdStrike Falcon Pro",
              price: 1200,
              quantity: 1,
            },
          ],
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
})

// ---------------------------------------------------------------------------
// structured_data_check (exempt)
// ---------------------------------------------------------------------------

test.describe("TGD — structured_data_check", () => {
  test("PDP with JSON-LD → has_product_schema: true", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/products/crowdstrike-falcon-pro-endpoint")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("structured_data_check")
    expect(events.length).toBeGreaterThan(0)
    expect(events[0].payload.has_product_schema).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// product_seen (consent required)
// ---------------------------------------------------------------------------

test.describe("TGD — product_seen", () => {
  test("with consent on PDP → captures product", async ({ page }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/products/crowdstrike-falcon-pro-endpoint")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("product_seen")
    expect(events.length).toBeGreaterThan(0)

    const evt = events[0]
    expect(evt.payload.product_id).toBeDefined()
    expect(evt.payload.price).toBe(1200)
    expect(evt.payload.currency).toBe("EUR")
  })

  test("without consent → product_seen NOT sent", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/products/crowdstrike-falcon-pro-endpoint")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("product_seen")
    expect(events.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Consent flow
// ---------------------------------------------------------------------------

test.describe("TGD — consent flow", () => {
  test("consent granted → UTMs captured", async ({ page }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/?utm_source=linkedin&utm_medium=cpc&utm_campaign=b2b_security&fbclid=fb123")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const session = interceptor.getSession()
    expect(session).toBeDefined()
    expect(session!.consent_status).toBe("granted")
    expect(session!.utm_source).toBe("linkedin")
    expect(session!.utm_medium).toBe("cpc")
    expect(session!.utm_campaign).toBe("b2b_security")
    expect(session!.has_fbclid).toBe(true)
  })

  test("consent denied → UTMs absent", async ({ page }) => {
    await simulateAxeptio(page, false)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, tgd)

    await page.goto("/?utm_source=linkedin&utm_medium=cpc&fbclid=fb123")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const session = interceptor.getSession()
    expect(session).toBeDefined()
    expect(session!.consent_status).toBe("denied")
    expect(session!.utm_source).toBeNull()
    expect(session!.has_fbclid).toBe(false)
  })
})
