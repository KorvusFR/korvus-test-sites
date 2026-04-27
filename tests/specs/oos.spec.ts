import { test, expect } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// Vague 2 — Worker B4.1 — out_of_stock detection.
//
// V2 supprime l'event `out_of_stock_viewed`. Le signal vit désormais sur la
// pageview dénormalisée : `pageviews.product_available = false`, avec la
// source gagnante dans `product_available_source`.
//
// Cascade snippet (cf. snippet/src/collectors/pageview.ts → detectAvailabilityFromDom) :
//   1. JSON-LD Schema.org `availability: OutOfStock` → source = "jsonld"
//   2. Bouton ATC `disabled` / `aria-disabled` → source = "button_state"
//   3. Wrapper produit avec class OOS (out-of-stock, sold-out, ...) → source = "class_token"
//   4. Texte OOS détecté dans h1/h2/[class*=stock|availab|dispo|rupture] → source = "text_match"
//
// Ces 4 cascades couvrent les "fuites financières" PDP_OOS du dashboard.
// Les tests ci-dessous valident le `false` + la source pour chaque cascade.

const doomcheck = getSiteConfig("doomcheck")

// Le serveur de dev doomcheck héberge déjà un produit OOS via JSON-LD
// (glitchbuds-ultra → availability: https://schema.org/OutOfStock).
// Pour les autres cascades, les tests injectent le DOM via `page.route`
// inline (pattern csp.spec.ts) car la cascade se lit au boot du snippet,
// donc les manipulations post-load via page.evaluate sont trop tard.

test.describe("Worker B4.1 — pageviews.product_available (OOS)", () => {
  test("cascade jsonld: glitchbuds-ultra (Schema.org OutOfStock) → product_available=false", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    // glitchbuds-ultra a `availability: https://schema.org/OutOfStock`.
    // Cascade product est en scheduleIdleTask (fallback setTimeout 2000ms).
    await page.goto("/products/glitchbuds-ultra")
    await page.waitForTimeout(2200)

    await interceptor.triggerFlush()

    const pv = interceptor
      .getPageviews()
      .find((p) => p.path.includes("/products/glitchbuds-ultra"))
    expect(pv, "pageview for glitchbuds-ultra should be captured").toBeDefined()
    expect(pv!.page_type).toBe("pdp")
    expect(pv!.product_available).toBe(false)
    expect(pv!.product_available_source).toBe("jsonld")
  })

  test("cascade text_match: badge 'rupture' visible sur PDP → product_available=false", async ({
    page,
  }) => {
    // On part de /sim/pdp (JSON-LD InStock par défaut). On rewrite la
    // réponse pour : (a) supprimer le bouton ATC pour neutraliser la
    // cascade button_state, (b) supprimer le JSON-LD InStock pour
    // neutraliser la cascade jsonld, (c) injecter un h1 avec un texte
    // contenant le keyword OOS "rupture" (cf. lib/patterns/out-of-stock.ts).
    await page.route("**/sim/pdp**", async (route) => {
      const response = await route.fetch()
      let html = await response.text()
      // Strip JSON-LD (sinon cascade jsonld InStock gagne).
      html = html.replace(
        /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,
        "",
      )
      // Strip bouton ATC (sinon button_state émet `available=true`).
      html = html.replace(/<button[\s\S]*?id="sim-atc"[\s\S]*?<\/button>/g, "")
      // Injecte un H1 OOS (le snippet scope sur h1, h2, [class*=stock|...]).
      const oosMarkup = `
        <h1 class="oos-marker">Produit en rupture de stock</h1>
        <span class="availability-text">Article épuisé</span>
      `
      html = html.replace("</body>", `${oosMarkup}</body>`)
      await route.fulfill({
        response,
        headers: response.headers(),
        body: html,
      })
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...doomcheck,
      // Le bouton ATC config-driven n'existe pas dans cette page rewrite,
      // donc findAtcButton() retourne null → cascade button_state skip.
      domSelectors: { add_to_cart: ".no-such-button" },
    })

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2200)

    await interceptor.triggerFlush()

    const pv = interceptor
      .getPageviews()
      .find((p) => p.path.includes("/sim/pdp"))
    expect(pv, "pageview for /sim/pdp should be captured").toBeDefined()
    expect(pv!.product_available).toBe(false)
    // text_match est la source attendue quand la détection se fait
    // uniquement via le keyword "rupture" dans un h1.
    expect(pv!.product_available_source).toBe("text_match")
  })

  test("cascade class_token: wrapper .out-of-stock sur conteneur produit → product_available=false", async ({
    page,
  }) => {
    // Stratégie : rewrite /sim/pdp, supprimer le JSON-LD, supprimer le
    // bouton ATC, et injecter une class `out-of-stock` sur le <body>
    // (un des 4 conteneurs candidats acceptés par detectAvailabilityFromDom).
    await page.route("**/sim/pdp**", async (route) => {
      const response = await route.fetch()
      let html = await response.text()
      html = html.replace(
        /<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,
        "",
      )
      html = html.replace(/<button[\s\S]*?id="sim-atc"[\s\S]*?<\/button>/g, "")
      // Ajoute la class OOS sur le <body>.
      html = html.replace(
        /<body([^>]*)class="([^"]*)"/,
        '<body$1class="$2 out-of-stock"',
      )
      // Si le body n'a pas d'attribut class, on l'ajoute.
      if (!/<body[^>]*class=/.test(html)) {
        html = html.replace(/<body([^>]*)>/, '<body$1 class="out-of-stock">')
      }
      await route.fulfill({
        response,
        headers: response.headers(),
        body: html,
      })
    })

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, {
      ...doomcheck,
      domSelectors: { add_to_cart: ".no-such-button" },
    })

    await page.goto("/sim/pdp")
    await page.waitForTimeout(2200)

    await interceptor.triggerFlush()

    const pv = interceptor
      .getPageviews()
      .find((p) => p.path.includes("/sim/pdp"))
    expect(pv, "pageview for /sim/pdp should be captured").toBeDefined()
    expect(pv!.product_available).toBe(false)
    expect(pv!.product_available_source).toBe("class_token")
  })
})
