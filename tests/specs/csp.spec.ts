import { test, expect } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// All tests run on doomcheck (port 3003).
// V2 audit item (b) — CSP stricte :
// Vérifie que le snippet capture les SecurityPolicyViolationEvent
// sans crasher le site sous CSP stricte. La fixture /sim/pdp est servie
// avec un header CSP injecté par Playwright via page.route (on n'override
// que la réponse de la page, pas les ressources tierces).

const doomcheck = getSiteConfig("doomcheck")

async function serveWithCsp(
  page: import("@playwright/test").Page,
  urlSubstring: string,
  csp: string,
): Promise<void> {
  await page.route("**/*", async (route) => {
    const url = route.request().url()
    if (!url.includes(urlSubstring)) {
      await route.fallback()
      return
    }
    const response = await route.fetch()
    const headers = { ...response.headers() }
    headers["content-security-policy"] = csp
    await route.fulfill({
      response,
      headers,
      body: await response.body(),
    })
  })
}

test.describe("V2 — csp_violation (audit item b)", () => {
  test("img cross-origin bloquée par CSP img-src 'self' → csp_violation émis", async ({
    page,
  }) => {
    await serveWithCsp(page, "/sim/pdp", "img-src 'self' data:;")

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000)

    // Injecte une image depuis un host non autorisé par img-src.
    await page.evaluate(() => {
      const img = document.createElement("img")
      img.src = "https://blocked.example.com/pixel.png"
      img.style.display = "none"
      document.body.appendChild(img)
    })

    await page.waitForTimeout(500)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("csp_violation")
    expect(
      events.length,
      "csp_violation should be emitted on img-src violation",
    ).toBeGreaterThan(0)
    const evt = events.find((e) =>
      String(e.payload.violated_directive).includes("img-src"),
    )
    expect(evt, "violation should match img-src directive").toBeDefined()
    expect(evt!.payload.disposition).toBe("enforce")
    expect(String(evt!.payload.blocked_uri_host)).toContain("blocked.example.com")
  })

  test("site reste fonctionnel sous CSP stricte (pas de crash snippet)", async ({
    page,
  }) => {
    // Non-régression : sous CSP stricte, la page doit continuer à
    // s'afficher et le snippet doit continuer à envoyer des pageviews.
    await serveWithCsp(page, "/sim/pdp", "img-src 'self' data:;")

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2000)

    await interceptor.triggerFlush()

    // Le pageview doit passer même avec CSP
    const pageviews = interceptor.getPageviews()
    expect(pageviews.length).toBeGreaterThan(0)
    expect(String(pageviews[0].path)).toContain("/sim/pdp")
    // Le titre H1 doit être rendu (le snippet ne doit pas casser le DOM)
    await expect(page.locator("h1")).toHaveText("Simulation PDP")
  })
})
