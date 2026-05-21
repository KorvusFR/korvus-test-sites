import { test, expect, type Page } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// purchase_observed — fallback DOM exempt CNIL pour les sites Tealium-driven
// / custom mid-market sans dataLayer GA4 standard.
//
// Tests sur doomcheck (port 3003), URL /checkout/confirmation existante.
// La page renvoie deja <h1>Order Confirmed</h1> + <title>Order Confirmed</title>
// (keyword EN match) ; on injecte le JSON-LD Order via addInitScript.
//
// Verifications cle :
//   - Event purchase_observed emis avec 3 corroborations (has_url, has_keyword, has_jsonld)
//   - Aucun champ valeur dans le payload (CNIL strict : pas de value, currency, transaction_id)
//   - Event est exempt (passe meme avec consent_status != granted)

const doomcheck = getSiteConfig("doomcheck")

async function waitBoot(page: Page, ms = 2000): Promise<void> {
  await page.waitForTimeout(ms)
}

async function injectOrderJsonLd(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Ajout du JSON-LD via DOMContentLoaded pour qu'il soit dans le DOM
    // avant que le snippet ne tire dans son scheduleIdleTask.
    document.addEventListener("DOMContentLoaded", () => {
      const script = document.createElement("script")
      script.type = "application/ld+json"
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Order",
        orderNumber: "DC-99999",
      })
      document.head.appendChild(script)
    })
  })
}

test.describe("purchase_observed — fallback DOM exempt CNIL", () => {
  test("emet l'event avec les 3 corroborations sur /checkout/confirmation?order=DC-99999", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await injectOrderJsonLd(page)

    await page.goto("/checkout/confirmation?order=DC-99999")
    await waitBoot(page)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("purchase_observed")
    expect(events.length, "purchase_observed should fire once").toBe(1)

    const ev = events[0]
    expect(ev.payload.has_url).toBe(true)
    expect(ev.payload.has_keyword).toBe(true)
    expect(ev.payload.has_jsonld).toBe(true)
    expect(typeof ev.payload.client_ts).toBe("number")
  })

  test("CNIL : payload n'a NI value, NI currency, NI transaction_id", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await injectOrderJsonLd(page)

    await page.goto("/checkout/confirmation?order=DC-99999")
    await waitBoot(page)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("purchase_observed")
    expect(events.length).toBe(1)
    const ev = events[0]

    // Le contrat CNIL : aucun champ valeur ne doit transiter dans cet event.
    expect(ev.value, "value at event level must be null/absent").toBeFalsy()
    expect(ev.currency, "currency at event level must be null/absent").toBeFalsy()
    expect(ev.payload).not.toHaveProperty("value")
    expect(ev.payload).not.toHaveProperty("currency")
    expect(ev.payload).not.toHaveProperty("transaction_id")
    expect(ev.payload).not.toHaveProperty("orderNumber")
    expect(ev.payload).not.toHaveProperty("orderTotal")
    // `_diag` ajoute dans le snippet par korvusadmin/korvus@4640afb (purchase_observed
    // seuil URL composee + persistance SPA) : champ de debug observability cote
    // snippet, present mais sans PII (cf. spec V2 purchase_observed dans
    // .claude/rules/schema-collecte.md). On l'ajoute a la liste autorisee pour
    // matcher le contrat snippet a jour ; les assertions CNIL "ni value ni
    // currency ni transaction_id" plus haut restent les sentinels critiques.
    expect(Object.keys(ev.payload).sort()).toEqual([
      "_diag",
      "client_ts",
      "has_jsonld",
      "has_keyword",
      "has_url",
    ])
  })

  test("ne s'active PAS sur /cart (page_type != order_confirmation)", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)
    await injectOrderJsonLd(page)

    await page.goto("/cart")
    await waitBoot(page)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("purchase_observed")
    expect(events.length, "purchase_observed must NOT fire on /cart").toBe(0)
  })
})
