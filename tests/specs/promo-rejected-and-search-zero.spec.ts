import { test, expect, type Page } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// Vague 2 — Worker B4.4 — promo rejected + search zero results.
//
// Deux fuites métier critiques regroupées :
//   1. promo_code_rejected : le visiteur tape un code promo que le serveur
//      rejette → fuite « promo cassé » qui démontre la perte de confiance
//      à l'étape paiement (mauvaise config marketing OU code expiré).
//   2. search_performed avec has_zero_results=true : recherche sans
//      résultat → fuite catalogue. La query n'est dans le payload QUE si
//      consent_status='granted' (cf. cnil-conformite.md).

const doomcheck = getSiteConfig("doomcheck")

const PAGE_TYPE_RULES = {
  checkout: { url_contains: "/sim/checkout" },
}

async function simulateAxeptio(page: Page, granted: boolean): Promise<void> {
  await page.addInitScript((consent: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w._axcb = []
    w.axeptio_settings = { cookies: { google_analytics: consent } }
  }, granted)
}

// ---------------------------------------------------------------------------
// promo_code_rejected
// ---------------------------------------------------------------------------

test.describe("Worker B4.4 — promo_code_rejected", () => {
  test("submit code promo invalide + message DOM 'promo invalide' → promo_code_rejected", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...doomcheck,
      pageTypeRules: PAGE_TYPE_RULES,
    })

    await page.goto("/sim/checkout")
    await page.waitForTimeout(800)

    // Construit un formulaire avec un input nommé `promo` (le snippet
    // détecte `name=promo|coupon|discount|...`). On le submit puis on
    // injecte le message d'erreur DOM dans la fenêtre 2s du collector.
    await page.evaluate(() => {
      const root = document.querySelector("#sim-root") as HTMLElement
      const form = document.createElement("form")
      form.id = "promo-form"
      form.onsubmit = (e) => e.preventDefault()
      const input = document.createElement("input")
      input.type = "text"
      input.name = "promo"
      input.id = "promo-input"
      input.value = "EXPIRED2024"
      form.appendChild(input)
      const btn = document.createElement("button")
      btn.type = "submit"
      btn.id = "promo-submit"
      btn.textContent = "Apply"
      form.appendChild(btn)
      root.appendChild(form)
    })

    await page.click("#promo-submit")
    await page.waitForTimeout(150)

    // Message DOM "promo invalide" — keyword multilingue normalisé par
    // PROMO_REJECTION_KEYWORDS (cf. lib/patterns/promo-rejection.ts).
    await page.evaluate(() => {
      const input = document.getElementById("promo-input") as HTMLInputElement
      input.classList.add("error", "is-invalid")
      const errorMsg = document.createElement("div")
      errorMsg.className = "error-text promo-error"
      errorMsg.textContent = "Code promo invalide ou expiré"
      input.parentElement?.appendChild(errorMsg)
    })

    await page.waitForTimeout(800)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("promo_code_rejected")
    expect(
      events.length,
      "promo_code_rejected devrait être émis",
    ).toBeGreaterThan(0)
    expect(events[0].payload.promo_code).toBe("EXPIRED2024")
    const rejectionText = String(events[0].payload.rejection_text || "")
    expect(rejectionText.length).toBeGreaterThan(0)
    expect(rejectionText.toLowerCase()).toMatch(/invalide|expir/)
  })
})

// ---------------------------------------------------------------------------
// search_performed — has_zero_results
// ---------------------------------------------------------------------------

test.describe("Worker B4.4 — search_performed (zero results)", () => {
  test("query 0 résultats avec consent granted → has_zero_results=true + query incluse", async ({
    page,
  }) => {
    // Doomcheck a une page /search qui rend les résultats. Une query
    // qui ne matche aucun produit → results_count=0.
    await simulateAxeptio(page, true)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...doomcheck,
      pageTypeRules: { search: { url_contains: "/search" } },
      domSelectors: { search_results_count: "div.mb-8 > p.text-sm" },
    })

    await page.goto("/search?q=xyznonexistentquery")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("search_performed")
    expect(events.length, "search_performed devrait être émis").toBeGreaterThan(0)
    const evt = events[0]
    expect(evt.payload.results_count).toBe(0)
    expect(evt.payload.has_zero_results).toBe(true)
    // Avec consent granted, la query est incluse (sinon strippée à null).
    expect(evt.payload.query).toBe("xyznonexistentquery")
  })

  test("query 0 résultats sans consent → has_zero_results=true mais query=null", async ({
    page,
  }) => {
    // CNIL : la structure (results_count, has_zero_results) reste exempt,
    // mais le texte de la query est strippé sans consent.
    await simulateAxeptio(page, false)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...doomcheck,
      pageTypeRules: { search: { url_contains: "/search" } },
      domSelectors: { search_results_count: "div.mb-8 > p.text-sm" },
    })

    await page.goto("/search?q=xyznonexistentquery")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("search_performed")
    expect(events.length).toBeGreaterThan(0)
    const evt = events[0]
    // Structure toujours captée.
    expect(evt.payload.results_count).toBe(0)
    expect(evt.payload.has_zero_results).toBe(true)
    // Query strippée car consent != granted.
    expect(evt.payload.query).toBeNull()

    // Sanity check : la session a bien consent_status=denied (ou unknown
    // selon la timing du callback Axeptio — l'important est que ce ne
    // soit PAS granted).
    const session = interceptor.getSession()
    expect(session, "session payload should be present").toBeDefined()
    expect(session!.consent_status).not.toBe("granted")
  })
})
