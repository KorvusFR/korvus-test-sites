import { test, expect } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// Vague 2 — Worker B4.2 — payment failed.
//
// Quand un paiement échoue (carte refusée, PSP 5xx, message d'erreur DOM),
// le snippet doit produire AU MOINS UN signal exploitable par le detector
// `payment_page_error` :
//   - `request_error` 4xx/5xx vers une URL PSP / endpoint /pay ; OU
//   - `ux_error` avec un texte contenant un message d'échec
//     (« decline », « refused », « failed », « payment refused », ...).
//
// Doomcheck (port 3003) ne supporte pas un vrai paiement Stripe, on simule
// donc côté DOM + via des fetch interceptés. La page support est /sim/checkout
// (page_type forcé via pageTypeRules).

const doomcheck = getSiteConfig("doomcheck")

const PAGE_TYPE_RULES = {
  checkout_payment: { url_contains: "/sim/checkout" },
}

test.describe("Worker B4.2 — payment failed signals", () => {
  test("PSP 4xx response → request_error capturé", async ({ page }) => {
    // On mock une URL PSP qui répond 402 (Payment Required) — un classique
    // Stripe quand la carte est refusée par la banque émettrice.
    await page.route("**/api/sim/charge", (route) =>
      route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({
          error: "card_declined",
          message: "Your card was declined.",
        }),
      }),
    )

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...doomcheck,
      pageTypeRules: PAGE_TYPE_RULES,
    })

    await page.goto("/sim/checkout")
    await page.waitForTimeout(800)

    // Submit du formulaire de paiement → fetch vers PSP qui retourne 402.
    await page.evaluate(async () => {
      try {
        await fetch("/api/sim/charge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            card: "4000000000000002",
            amount: 9999,
          }),
        })
      } catch {
        // ignore — le snippet observe via fetch monkey-patch
      }
    })

    await page.waitForTimeout(800)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("request_error")
    const evt = events.find((e) =>
      String(e.payload.url_path || "").includes("/api/sim/charge"),
    )
    expect(evt, "request_error pour /api/sim/charge devrait être capturé").toBeDefined()
    expect(evt!.payload.status_code).toBe(402)
    // 402 → http_4xx côté snippet (payment-attempted lit ce signal pour
    // le derive du detector côté serveur).
    expect(evt!.payload.error_type).toBe("http_4xx")
  })

  test("PSP 5xx + message d'erreur DOM 'declined' → request_error + ux_error capturés", async ({
    page,
  }) => {
    // Cas combiné : la PSP renvoie 503 ET le front affiche un message
    // d'échec dans une div role=alert. Le snippet doit capturer les deux
    // signaux indépendants.
    await page.route("**/checkout/pay", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "service_unavailable" }),
      }),
    )

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...doomcheck,
      pageTypeRules: PAGE_TYPE_RULES,
    })

    await page.goto("/sim/checkout")
    await page.waitForTimeout(800)

    // Trigger : formulaire de paiement, fetch vers PSP qui plante en 503,
    // puis on injecte le message d'erreur visible dans le DOM (comme le
    // ferait le front-end après réception de la 503).
    await page.evaluate(async () => {
      try {
        await fetch("/checkout/pay", {
          method: "POST",
          body: JSON.stringify({ card: "4000000000000002" }),
        })
      } catch {
        /* ignore */
      }
      const root = document.querySelector("#sim-root") as HTMLElement
      const errBox = document.createElement("div")
      errBox.setAttribute("role", "alert")
      errBox.className = "alert alert-danger payment-error"
      errBox.textContent = "Your card was declined. Payment refused by issuer."
      root.appendChild(errBox)
    })

    // ux_error a une fenêtre de détection un peu plus large (visibility
    // observer) — on attend 1s.
    await page.waitForTimeout(1200)
    await interceptor.triggerFlush()

    // 1) request_error : PSP 503
    const reqErrors = interceptor.getEvents("request_error")
    const psp503 = reqErrors.find((e) =>
      String(e.payload.url_path || "").includes("/checkout/pay"),
    )
    expect(psp503, "request_error 503 devrait être capturé").toBeDefined()
    expect(psp503!.payload.status_code).toBe(503)
    expect(psp503!.payload.error_type).toBe("http_5xx")

    // 2) ux_error : message DOM "declined" / "refused"
    const uxErrors = interceptor.getEvents("ux_error")
    const declined = uxErrors.find((e) => {
      const txt = String(e.payload.text || "").toLowerCase()
      return (
        txt.includes("decline") ||
        txt.includes("refused") ||
        txt.includes("failed")
      )
    })
    expect(
      declined,
      "ux_error avec message d'échec ('decline' | 'refused' | 'failed') devrait être capturé",
    ).toBeDefined()
  })

  test("formulaire avec carte de test 4000... + message DOM 'payment failed' → ux_error capturé", async ({
    page,
  }) => {
    // Cas pure-DOM : le PSP n'est pas mocké, le test simule directement
    // le rendu d'un message d'erreur post-submit. Couvre les sites qui
    // gèrent le paiement entièrement client-side (Apple Pay, wallets).
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...doomcheck,
      pageTypeRules: PAGE_TYPE_RULES,
    })

    await page.goto("/sim/checkout")
    await page.waitForTimeout(800)

    // Formulaire de paiement avec carte test 4000 0000 0000 0002 (Stripe
    // declined). Submit → message d'erreur visible.
    await page.evaluate(() => {
      const root = document.querySelector("#sim-root") as HTMLElement
      const form = document.createElement("form")
      form.id = "pay-form"
      form.action = "/checkout/pay"
      form.onsubmit = (e) => e.preventDefault()
      const input = document.createElement("input")
      input.type = "text"
      input.name = "card_number"
      input.value = "4000000000000002"
      input.id = "card-number"
      form.appendChild(input)
      const btn = document.createElement("button")
      btn.type = "submit"
      btn.id = "pay-btn"
      btn.textContent = "Pay 99.99 €"
      form.appendChild(btn)
      root.appendChild(form)
    })

    await page.click("#pay-btn")
    await page.waitForTimeout(200)

    // Le front affiche un message d'erreur post-submit (mock du retour
    // PSP "declined").
    await page.evaluate(() => {
      const root = document.querySelector("#sim-root") as HTMLElement
      const err = document.createElement("div")
      err.className = "alert alert-error payment-failed"
      err.setAttribute("role", "alert")
      err.textContent = "Payment failed: your card was declined by the bank."
      root.appendChild(err)
    })

    await page.waitForTimeout(1200)
    await interceptor.triggerFlush()

    const uxErrors = interceptor.getEvents("ux_error")
    const failedMsg = uxErrors.find((e) => {
      const txt = String(e.payload.text || "").toLowerCase()
      return txt.includes("failed") || txt.includes("declined")
    })
    expect(
      failedMsg,
      "ux_error avec 'failed'/'declined' devrait être capturé",
    ).toBeDefined()
    expect(String(failedMsg!.payload.text).toLowerCase()).toMatch(
      /failed|declined|refused/,
    )
  })
})
