import { test, expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// All tests run on doomcheck (port 3003)

const doomcheck = getSiteConfig("doomcheck")

// Helper: simulate Axeptio CMP with consent granted or denied
async function simulateAxeptio(page: Page, granted: boolean): Promise<void> {
  await page.addInitScript((consent: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w._axcb = []
    w.axeptio_settings = { cookies_consent: consent }
  }, granted)
}

// ---------------------------------------------------------------------------
// Test 16 — Mode exempt (consent denied)
// ---------------------------------------------------------------------------

test.describe("Test 16 — Mode exempt (denied)", () => {
  test("exempt events are sent when consent is denied", async ({ page }) => {
    await simulateAxeptio(page, false)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...doomcheck,
      domSelectors: { add_to_cart: "button.gap-2" },
    })

    // Navigate to PDP (JSON-LD auto-detects as pdp)
    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    // Inject a JS error (exempt event)
    await page.evaluate(() => {
      window.onerror?.(
        "Exempt mode test error",
        "test.js",
        1,
        1,
        new Error("Exempt mode test error"),
      )
    })
    await page.waitForTimeout(500)

    await interceptor.triggerFlush()

    // Exempt events should be present
    const jsErrors = interceptor.getEvents("js_error")
    expect(
      jsErrors.some((e) => e.payload.message === "Exempt mode test error"),
      "js_error (exempt) should be sent when consent is denied",
    ).toBe(true)

    const sdcEvents = interceptor.getEvents("structured_data_check")
    expect(
      sdcEvents.length,
      "structured_data_check (exempt) should be sent when consent is denied",
    ).toBeGreaterThan(0)
  })

  test("consent-required events are NOT sent when consent is denied", async ({
    page,
  }) => {
    await simulateAxeptio(page, false)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    // Push dataLayer purchase (should be ignored — datalayer collector not initialized)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "TX-DENIED-001",
          value: 100,
          currency: "EUR",
          items: [{ item_id: "1", item_name: "Test", price: 100, quantity: 1 }],
        },
      })
    })
    await page.waitForTimeout(500)

    await interceptor.triggerFlush()

    // Consent-required events should NOT be present
    expect(
      interceptor.getEvents("product_seen").length,
      "product_seen should NOT be sent when consent is denied",
    ).toBe(0)

    expect(
      interceptor.getEvents("datalayer_validation").length,
      "datalayer_validation should NOT be sent when consent is denied",
    ).toBe(0)

    expect(
      interceptor.getEvents("purchase").length,
      "purchase should NOT be sent when consent is denied",
    ).toBe(0)

    expect(
      interceptor.getEvents("tag_fired").length,
      "tag_fired should NOT be sent when consent is denied",
    ).toBe(0)
  })

  test("session UTM fields are absent when consent is denied", async ({
    page,
  }) => {
    await simulateAxeptio(page, false)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    // Navigate with UTM params — should be ignored since consent is denied
    await page.goto(
      "/?utm_source=google&utm_medium=cpc&utm_campaign=test&gclid=abc123",
    )
    await page.waitForTimeout(1500)

    await interceptor.triggerFlush()

    const session = interceptor.getSession()
    expect(session, "Session should be received").toBeDefined()
    expect(session!.consent_status).toBe("denied")
    expect(session!.utm_source).toBeNull()
    expect(session!.utm_medium).toBeNull()
    expect(session!.utm_campaign).toBeNull()
    expect(session!.is_paid_traffic).toBe(false)
    expect(session!.has_gclid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Test 17 — Mode consent (granted)
// ---------------------------------------------------------------------------

test.describe("Test 17 — Mode consent (granted)", () => {
  test("all events (exempt + consent-gated) are sent", async ({ page }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    // Inject a JS error (exempt event)
    await page.evaluate(() => {
      window.onerror?.(
        "Consent granted test error",
        "test.js",
        1,
        1,
        new Error("Consent granted test error"),
      )
    })

    // Push a valid purchase event (consent-gated)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).dataLayer.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "TX-GRANTED-001",
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

    // Exempt events
    const jsErrors = interceptor.getEvents("js_error")
    expect(
      jsErrors.some(
        (e) => e.payload.message === "Consent granted test error",
      ),
      "js_error (exempt) should be sent with consent granted",
    ).toBe(true)

    const sdcEvents = interceptor.getEvents("structured_data_check")
    expect(
      sdcEvents.length,
      "structured_data_check (exempt) should be sent",
    ).toBeGreaterThan(0)

    // Consent-gated events
    const productSeen = interceptor.getEvents("product_seen")
    expect(
      productSeen.length,
      "product_seen should be sent with consent granted",
    ).toBeGreaterThan(0)

    const validations = interceptor.getEvents("datalayer_validation")
    expect(
      validations.length,
      "datalayer_validation should be sent with consent granted",
    ).toBeGreaterThan(0)

    const purchases = interceptor.getEvents("purchase")
    expect(
      purchases.length,
      "purchase should be sent with consent granted",
    ).toBeGreaterThan(0)
  })

  test("UTMs and click IDs are captured with consent granted", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto(
      "/?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale&gclid=CjTest123&fbclid=fb_test",
    )
    await page.waitForTimeout(1500)

    await interceptor.triggerFlush()

    const session = interceptor.getSession()
    expect(session, "Session should be received").toBeDefined()
    expect(session!.consent_status).toBe("granted")
    expect(session!.utm_source).toBe("google")
    expect(session!.utm_medium).toBe("cpc")
    expect(session!.utm_campaign).toBe("spring_sale")
    expect(session!.is_paid_traffic).toBe(true)
    expect(session!.has_gclid).toBe(true)
    expect(session!.has_fbclid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 18 — Opt-out cookie
// ---------------------------------------------------------------------------

test.describe("Test 18 — Opt-out", () => {
  test("korvus_optout=1 cookie prevents all collection", async ({
    page,
    context,
  }) => {
    // Set the opt-out cookie BEFORE navigation
    await context.addCookies([
      {
        name: "korvus_optout",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ])

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    // Inject an error to prove collection would normally work
    await page.evaluate(() => {
      window.onerror?.(
        "Optout test error",
        "test.js",
        1,
        1,
        new Error("Optout test error"),
      )
    })
    await page.waitForTimeout(500)

    // Try to flush — should get nothing
    await interceptor.triggerFlush()

    expect(
      interceptor.getBatchCount(),
      "No batches should be sent with opt-out cookie",
    ).toBe(0)

    expect(
      interceptor.getEvents().length,
      "No events should be captured with opt-out cookie",
    ).toBe(0)
  })
})
