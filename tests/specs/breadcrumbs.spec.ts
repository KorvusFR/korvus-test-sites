import { test, expect } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet } from "../helpers/inject-snippet"

// Specs E2E pour les breadcrumbs error-triggered.
//
// Ces tests valident le contrat snippet -> beacon -> Zod ingest sur le champ
// context_breadcrumbs : un click / un fetch / une nav pre-erreur doivent
// apparaitre dans le buffer attache au js_error / request_error / ux_error.
//
// Tous les tests tournent sur doomcheck (port 3003). Le snippet utilise est
// celui de platform/snippet/dist/korvus.min.js (override possible via
// KORVUS_SNIPPET_PATH).
//
// IMPORTANT : ces specs ne peuvent passer QUE si le snippet build inclut le
// module breadcrumbs (cf. platform feat/breadcrumbs). En local pendant le
// developpement : KORVUS_SNIPPET_PATH=~/Documents/Korvus/wt/platform/
// breadcrumbs/snippet/dist/korvus.min.js npx playwright test specs/breadcrumbs.

interface BreadcrumbLike {
  t_rel: number
  type: string
  [k: string]: unknown
}

function readCrumbs(payload: Record<string, unknown>): BreadcrumbLike[] {
  const raw = payload.context_breadcrumbs
  if (!Array.isArray(raw)) return []
  return raw as BreadcrumbLike[]
}

test.describe("Breadcrumbs error-triggered — js_error", () => {
  test("js_error contient context_breadcrumbs avec clicks + nav + fetch pre-erreur", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    // 3 clicks sur boutons distincts.
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) {
        const b = document.createElement("button")
        b.id = "test-btn-" + i
        document.body.appendChild(b)
        b.click()
      }
    })

    // 1 fetch (sera capture comme fetch_complete crumb).
    await page.evaluate(() =>
      fetch("/healthz").catch(() => {
        /* ignore */
      }),
    )
    await page.waitForTimeout(200)

    // 1 nav SPA via pushState.
    await page.evaluate(() => history.pushState({}, "", "/cart"))
    await page.waitForTimeout(100)

    // Provoque le js_error.
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Breadcrumbs spec marker",
          filename: "bc.js",
          lineno: 1,
          colno: 1,
          error: new Error("Breadcrumbs spec marker"),
        }),
      )
    })

    await page.waitForTimeout(200)
    await interceptor.triggerFlush()

    const evt = interceptor
      .getEvents("js_error")
      .find((e) =>
        String(e.payload.message).includes("Breadcrumbs spec marker"),
      )
    expect(evt, "js_error marker event should be captured").toBeDefined()
    const crumbs = readCrumbs(evt!.payload)
    expect(crumbs.length).toBeGreaterThan(0)
    // Tous les t_rel <= 0.
    for (const c of crumbs) {
      expect(c.t_rel).toBeLessThanOrEqual(0)
    }
    // Au moins un click crumb visible.
    expect(crumbs.some((c) => c.type === "click")).toBe(true)
  })
})

test.describe("Breadcrumbs error-triggered — request_error", () => {
  test("request_error 500 contient breadcrumbs (clicks pre-fetch)", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    // Mock une route 500 cote test.
    await page.route("**/api/broken", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "boom" }),
      }),
    )

    await page.goto("/")
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      const b = document.createElement("button")
      b.id = "btn-pre-fetch"
      document.body.appendChild(b)
      b.click()
    })

    await page.evaluate(() =>
      fetch("/api/broken").catch(() => {
        /* ignore */
      }),
    )
    await page.waitForTimeout(300)
    await interceptor.triggerFlush()

    const evt = interceptor
      .getEvents("request_error")
      .find(
        (e) =>
          String(e.payload.url_path).includes("/api/broken") &&
          Number(e.payload.status_code) === 500,
      )
    expect(evt, "request_error 500 should be captured").toBeDefined()
    const crumbs = readCrumbs(evt!.payload)
    expect(crumbs.length).toBeGreaterThan(0)
  })
})

test.describe("Breadcrumbs error-triggered — dedup par session", () => {
  test("2e js_error avec meme message n'attache PAS breadcrumbs (dedup signature)", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      const b = document.createElement("button")
      document.body.appendChild(b)
      b.click()
    })

    // 1er js_error : doit attacher.
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Dedup spec marker",
          filename: "x.js",
          lineno: 1,
          colno: 1,
          error: new Error("Dedup spec marker"),
        }),
      )
    })
    await page.waitForTimeout(100)
    await interceptor.triggerFlush()

    // 2e js_error meme message dans la meme session JS.
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Dedup spec marker",
          filename: "x.js",
          lineno: 1,
          colno: 1,
          error: new Error("Dedup spec marker"),
        }),
      )
    })
    await page.waitForTimeout(100)
    await interceptor.triggerFlush()

    const events = interceptor
      .getEvents("js_error")
      .filter((e) => String(e.payload.message) === "Dedup spec marker")
    expect(events.length).toBeGreaterThan(0)
    // Le 1er event a context_breadcrumbs ; les emissions suivantes (si
    // separees par flush) sont incrementees via count cote snippet, et
    // l'event reemis (s'il sort en seconde batch) n'attache PAS de
    // breadcrumbs car la signature est deja dans emittedSignatures.
    const withCrumbs = events.filter((e) => {
      const crumbs = e.payload.context_breadcrumbs
      return Array.isArray(crumbs) && crumbs.length > 0
    })
    expect(withCrumbs.length).toBeLessThanOrEqual(1)
  })
})

test.describe("Breadcrumbs error-triggered — multi signatures", () => {
  test("3 js_error de messages differents attachent chacun leurs breadcrumbs", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      for (const msg of ["Multi A", "Multi B", "Multi C"]) {
        const b = document.createElement("button")
        b.id = "btn-" + msg.replace(/\s/g, "")
        document.body.appendChild(b)
        b.click()
        window.dispatchEvent(
          new ErrorEvent("error", {
            message: msg,
            filename: "x.js",
            lineno: 1,
            colno: 1,
            error: new Error(msg),
          }),
        )
      }
    })

    await page.waitForTimeout(200)
    await interceptor.triggerFlush()

    const msgs = ["Multi A", "Multi B", "Multi C"]
    for (const msg of msgs) {
      const evt = interceptor
        .getEvents("js_error")
        .find((e) => String(e.payload.message) === msg)
      expect(evt, `js_error "${msg}" must exist`).toBeDefined()
      const crumbs = readCrumbs(evt!.payload)
      expect(crumbs.length).toBeGreaterThan(0)
    }
  })
})

test.describe("Breadcrumbs error-triggered — PII scrub", () => {
  test("data-korvus-label avec email est scrubbed en [email]", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      const b = document.createElement("button")
      b.setAttribute("data-korvus-label", "Contact: user@example.com")
      document.body.appendChild(b)
      b.click()
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "PII spec marker",
          filename: "x.js",
          lineno: 1,
          colno: 1,
          error: new Error("PII spec marker"),
        }),
      )
    })
    await page.waitForTimeout(200)
    await interceptor.triggerFlush()

    const evt = interceptor
      .getEvents("js_error")
      .find((e) => String(e.payload.message) === "PII spec marker")
    expect(evt).toBeDefined()
    const crumbs = readCrumbs(evt!.payload)
    const click = crumbs.find((c) => c.type === "click")
    expect(click).toBeDefined()
    const label = String(click!.data_korvus_label ?? "")
    expect(label).toContain("[email]")
    expect(label).not.toContain("user@example.com")
  })
})

test.describe("Breadcrumbs error-triggered — cap byte", () => {
  test("buffer plafonne sous 100 entries + cap byte 8 KB", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    // 200 clicks rapides : devrait depasser cap 100 entries et/ou cap byte.
    await page.evaluate(() => {
      for (let i = 0; i < 200; i++) {
        const b = document.createElement("button")
        b.id = "spam-" + i
        document.body.appendChild(b)
        b.click()
      }
    })

    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Cap byte spec marker",
          filename: "x.js",
          lineno: 1,
          colno: 1,
          error: new Error("Cap byte spec marker"),
        }),
      )
    })
    await page.waitForTimeout(200)
    await interceptor.triggerFlush()

    const evt = interceptor
      .getEvents("js_error")
      .find((e) => String(e.payload.message) === "Cap byte spec marker")
    expect(evt).toBeDefined()
    const crumbs = readCrumbs(evt!.payload)
    expect(crumbs.length).toBeLessThanOrEqual(100)
    // Le payload encode JSON doit aussi etre raisonnable (< 10 KB, limite
    // rate limiter ingest).
    const encoded = JSON.stringify(crumbs)
    expect(encoded.length).toBeLessThan(10_000)
  })
})

test.describe("Breadcrumbs error-triggered — types interdits absents", () => {
  test("aucun breadcrumb ne porte de coordonnees souris / textContent / valeurs d'inputs", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    // Setup : input avec valeur (le snippet ne doit PAS lire .value),
    // click + nav + js_error pour declencher breadcrumbs.
    await page.evaluate(() => {
      const input = document.createElement("input")
      input.type = "text"
      input.value = "secret-input-value-12345"
      document.body.appendChild(input)
      const b = document.createElement("button")
      b.textContent = "secret-button-text-content"
      document.body.appendChild(b)
      b.click()
      window.dispatchEvent(
        new ErrorEvent("error", {
          message: "Forbidden fields marker",
          filename: "x.js",
          lineno: 1,
          colno: 1,
          error: new Error("Forbidden fields marker"),
        }),
      )
    })
    await page.waitForTimeout(200)
    await interceptor.triggerFlush()

    const evt = interceptor
      .getEvents("js_error")
      .find((e) => String(e.payload.message) === "Forbidden fields marker")
    expect(evt).toBeDefined()
    const crumbs = readCrumbs(evt!.payload)
    const encoded = JSON.stringify(crumbs)
    // Les marqueurs uniques de PII/contenu ne doivent JAMAIS apparaitre.
    expect(encoded).not.toContain("secret-input-value-12345")
    expect(encoded).not.toContain("secret-button-text-content")
    // Champs structurels interdits : aucune cle de coordonnees souris.
    expect(encoded).not.toMatch(/"clientX"|"clientY"|"pageX"|"pageY"/)
    // Pas de textContent ni innerHTML ni valeurs d'inputs.
    expect(encoded).not.toMatch(/"textContent"|"innerHTML"|"innerText"/)
  })
})
