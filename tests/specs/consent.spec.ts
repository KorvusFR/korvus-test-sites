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
    w.axeptio_settings = { cookies: { google_analytics: consent } }
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
    await injectSnippet(page, doomcheck)

    // Navigate to PDP (JSON-LD auto-detects as pdp)
    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    // Inject a JS error (exempt event)
    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent("error", {
        message: "Exempt mode test error",
        filename: "test.js",
        lineno: 1,
        colno: 1,
        error: new Error("Exempt mode test error"),
      }))
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

    // Consent-required events should NOT be present.
    // Note V2 — `product_seen` est supprimé (remplacé par les colonnes
    // `pageviews.product_*`). Le check « pas de price/currency PDP sans
    // consent » est couvert par ecommerce.spec.ts Test 15, on ne le
    // duplique pas ici.
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
      window.dispatchEvent(new ErrorEvent("error", {
        message: "Consent granted test error",
        filename: "test.js",
        lineno: 1,
        colno: 1,
        error: new Error("Consent granted test error"),
      }))
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

    // V2 — product_seen est supprimé. Le signal vit dans
    // pageviews.product_price_visible (consent required). Vérifier que la
    // colonne est présente quand le consent est granted.
    const pv = interceptor
      .getPageviews()
      .find((p) => p.path.includes("/products/novapro-x12"))
    expect(pv, "PDP pageview should be captured").toBeDefined()
    expect(
      pv!.product_price_visible,
      "product_price_visible should be present with consent granted",
    ).toBeGreaterThan(0)
    expect(pv!.product_currency).toBeTruthy()

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
      window.dispatchEvent(new ErrorEvent("error", {
        message: "Optout test error",
        filename: "test.js",
        lineno: 1,
        colno: 1,
        error: new Error("Optout test error"),
      }))
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

// ---------------------------------------------------------------------------
// Phase 7 B1 — CMP tardif : consent denied → granted en cours de session
// ---------------------------------------------------------------------------
//
// Scénario réel : l'utilisateur arrive sur le site, le CMP (Axeptio) charge
// en parallèle, le banner s'affiche quelques secondes plus tard, et le visiteur
// clique "Accepter". Le snippet doit re-évaluer le consent et activer les
// collectors consent-gated (dataLayer) à la volée, sinon le premier purchase
// de la session est perdu.
//
// Wiring côté snippet : [platform/snippet/src/index.ts:72](../../../platform/snippet/src/index.ts#L72)
// appelle `onConsentChange` qui lazily initialise `initDataLayerCollector`
// quand le consent bascule à "granted" pour la première fois.

test.describe("Phase 7 B1 — Consent mid-session (CMP tardif)", () => {
  test("consent denied → granted active les collectors gated pour les events à venir", async ({
    page,
  }) => {
    // Init Axeptio en mode denied — le snippet doit boot, voir denied,
    // et ne PAS initialiser le collector dataLayer.
    await simulateAxeptio(page, false)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/products/novapro-x12")
    await page.waitForTimeout(2000)

    // --- Phase 1 : consent denied ---
    // Push une purchase AVANT la bascule → doit être perdue (collector non init).
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "TX-PRE-CONSENT",
          value: 100,
          currency: "EUR",
          items: [{ item_id: "X", item_name: "X", price: 100, quantity: 1 }],
        },
      })
    })
    await page.waitForTimeout(200)

    // --- Phase 2 : bascule consent denied → granted ---
    // Axeptio fire le callback `_axcb` quand l'utilisateur accepte.
    // Le snippet a subscribé à `_axcb.push(sdk => sdk.on("cookies:complete", ...))`.
    // On update `axeptio_settings` PUIS on appelle le callback comme Axeptio
    // le fait en prod quand l'utilisateur interagit avec le banner.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.axeptio_settings = { cookies: { google_analytics: true } }
      // Simule Axeptio qui fire le callback cookies:complete.
      // Le snippet a fait `_axcb.push(sdk => sdk.on("cookies:complete", cb))`
      // pendant detectAxeptio, donc _axcb[0] est ce pusher. On lui passe un
      // faux SDK qui appelle immédiatement son callback on "cookies:complete".
      if (Array.isArray(w._axcb) && w._axcb.length > 0) {
        const fakeSdk = {
          on: (event: string, cb: () => void) => {
            if (event === "cookies:complete") cb()
          },
        }
        for (const pusher of w._axcb) {
          try {
            pusher(fakeSdk)
          } catch {
            /* ignore */
          }
        }
      }
    })
    await page.waitForTimeout(300) // laisse onConsentChange propager

    // --- Phase 3 : consent granted — push une nouvelle purchase ---
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "purchase",
        ecommerce: {
          transaction_id: "TX-POST-CONSENT",
          value: 200,
          currency: "EUR",
          items: [{ item_id: "Y", item_name: "Y", price: 200, quantity: 1 }],
        },
      })
    })
    await page.waitForTimeout(400)
    await interceptor.triggerFlush()

    // --- Assertions ---

    // Session doit avoir consent_status = granted (mis à jour via
    // updateSessionPayload dans onConsentChange callback).
    const session = interceptor.getSession()
    expect(session, "session should be present").toBeDefined()
    expect(
      session!.consent_status,
      "session consent_status should reflect the grant",
    ).toBe("granted")

    // La purchase POST-consent doit être présente.
    const purchases = interceptor.getEvents("purchase")
    const postConsent = purchases.find(
      (e) => e.payload.transaction_id === "TX-POST-CONSENT",
    )
    expect(
      postConsent,
      "purchase pushed AFTER consent grant should be captured",
    ).toBeDefined()
    expect(postConsent!.payload.value).toBe(200)
  })
})
