import { test, expect, type Page } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet, getSiteConfig } from "../helpers/inject-snippet"

// All tests run on doomcheck (port 3003) using /sim/pdp and /sim/checkout
// fixtures. This spec validates the patterns added in the april 2026 mid-market
// FR/ES/IT coverage extension :
//
//   - lib/patterns/atc-selectors.ts : 17 EXPLICIT + 27 HEURISTIC selectors
//     (data-testid, data-cy, data-qa-action, data-at, data-button-action,
//     cx-add-to-cart, addToBasket/addToBagButton class, ID-based)
//   - lib/patterns/page-type.ts    : 29+ FR/ES/IT order_confirmation URL,
//     12+ query tokens (id_ordine, id_pedido, numero_commande, ...),
//     3+ Hybris/Spartacus body classes, /sac /bag split SAFE/AMBIGUOUS
//   - snippet/src/collectors/datalayer.ts : 28 mappings (Shopify Web Pixels,
//     Stape suffix, UA legacy, Segment v2, GTM4WP, Tealium UDO, Shopware PLP)
//   - snippet/src/collectors/add-to-cart-succeeded.ts : url_change cascade
//     dynamique 40+ patterns + word-boundary /sac /bag (anti-FP /sacs-femme)
//
// Each test uses page.addInitScript to inject DOM BEFORE the snippet boots
// (findAtcButton + selector composition snapshot at init), or page.evaluate
// post-boot when the late-mount delegated click capture-phase suffices.

const doomcheck = getSiteConfig("doomcheck")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function simulateAxeptio(page: Page, granted: boolean): Promise<void> {
  await page.addInitScript((consent: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w._axcb = []
    w.axeptio_settings = { cookies: { google_analytics: consent } }
  }, granted)
}

async function waitBoot(page: Page, ms = 2000): Promise<void> {
  await page.waitForTimeout(ms)
}

// Inject an ATC button into #sim-root after the snippet boots. The collector
// uses bus.onDelegatedClick (document capture-phase) which is late-mount
// safe — the button only needs to match the composed selector at click time,
// not at boot. The selector is composed once at boot from buildAtcSelector
// using page_type=pdp (JSON-LD on /sim/pdp), so HEURISTIC selectors are in.
async function injectAtcButton(page: Page, outerHtml: string): Promise<void> {
  await page.evaluate((html: string) => {
    const root = document.querySelector("#sim-root") as HTMLElement | null
    if (!root) throw new Error("sim-root not found")
    const tpl = document.createElement("template")
    tpl.innerHTML = html
    root.appendChild(tpl.content)
  }, outerHtml)
}

// ---------------------------------------------------------------------------
// P1 — Régression Interflora.it (data-test-id + Aggiungi al carrello)
// ---------------------------------------------------------------------------
//
// Cas d'origine du chantier : Interflora.it utilise
// `<button data-test-id="button-add-to-cart">Aggiungi al carrello</button>`.
// Avant le patch EXPLICIT_ATC_SELECTORS (data-test-id*=add-to-cart i), ce
// bouton n'était pas matché et le collector add_to_cart_attempt restait muet
// sur tout le site Interflora — silent fail PDP critique.

test.describe("ATC — regression Interflora data-test-id", () => {
  test("button[data-test-id='button-add-to-cart'] Aggiungi al carrello fire ATC", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    await injectAtcButton(
      page,
      '<button type="button" data-test-id="button-add-to-cart" id="atc-interflora">Aggiungi al carrello</button>',
    )

    await page.click("#atc-interflora")
    await page.waitForTimeout(2300)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("add_to_cart_attempt")
    expect(
      events.length,
      "add_to_cart_attempt should fire on data-test-id ATC button (Interflora regression)",
    ).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// P1 — Couverture par famille de selecteur (EXPLICIT + HEURISTIC)
// ---------------------------------------------------------------------------
//
// Couvre 7 familles representatives parmi les 28 selecteurs ajoutes. On
// n'instrumente PAS chacune individuellement (redondant avec tests unit
// patterns), on valide que le selector compose (buildAtcSelector) propage
// bien la liste complete au listener delegue capture-phase.

interface AtcFamilyCase {
  name: string
  html: string
  buttonId: string
}

const ATC_FAMILY_CASES: AtcFamilyCase[] = [
  {
    name: "data-testid (PCComponentes/Zalando)",
    html:
      '<button type="button" id="atc-fam-1" data-testid="add-to-cart-button">Add to cart</button>',
    buttonId: "atc-fam-1",
  },
  {
    name: "data-cy (Cypress conventions)",
    html:
      '<button type="button" id="atc-fam-2" data-cy="add-to-cart">Anadir</button>',
    buttonId: "atc-fam-2",
  },
  {
    name: "data-qa-action (Inditex/Zara-like)",
    html:
      '<button type="button" id="atc-fam-3" data-qa-action="add-to-cart">Aggiungi</button>',
    buttonId: "atc-fam-3",
  },
  {
    name: "data-at (Sephora.fr-like)",
    html:
      '<button type="button" id="atc-fam-4" data-at="add-to-basket">Ajouter</button>',
    buttonId: "atc-fam-4",
  },
  {
    name: "data-button-action (SFCC SFRA Picard/Jules)",
    html:
      '<button type="button" id="atc-fam-5" data-button-action="add-to-cart">Ajouter au panier</button>',
    buttonId: "atc-fam-5",
  },
  {
    name: "cx-add-to-cart (Spartacus / SAP Commerce)",
    html: '<cx-add-to-cart><button id="atc-fam-6" type="button">Aggiungi al carrello</button></cx-add-to-cart>',
    buttonId: "atc-fam-6",
  },
  {
    name: "id-based (El Corte Ingles-like)",
    html:
      '<button type="button" id="add-to-cart-main">Anadir a la cesta</button>',
    buttonId: "add-to-cart-main",
  },
  {
    name: "class addToBasket (Cdiscount-like camelCase)",
    html:
      '<button type="button" id="atc-fam-8" class="addToBasketButton">Ajouter au panier</button>',
    buttonId: "atc-fam-8",
  },
  {
    name: "class addToBagButton (Mango-like CSS modules)",
    html:
      '<button type="button" id="atc-fam-9" class="addToBagButton_xyz123">Anadir al bolso</button>',
    buttonId: "atc-fam-9",
  },
]

test.describe("ATC — familles de selecteurs (april 2026 patterns)", () => {
  for (const fam of ATC_FAMILY_CASES) {
    test(`fire add_to_cart_attempt on ${fam.name}`, async ({ page }) => {
      const interceptor = new IngestInterceptor(page)
      await interceptor.attach()
      await injectSnippet(page, doomcheck)

      await page.goto("/sim/pdp")
      await waitBoot(page)

      await injectAtcButton(page, fam.html)

      await page.click(`#${fam.buttonId}`)
      await page.waitForTimeout(2300)
      await interceptor.triggerFlush()

      const events = interceptor.getEvents("add_to_cart_attempt")
      expect(
        events.length,
        `add_to_cart_attempt should fire for family "${fam.name}"`,
      ).toBeGreaterThan(0)
    })
  }
})

// ---------------------------------------------------------------------------
// P1 — DataLayer mapping (4 representatives)
// ---------------------------------------------------------------------------
//
// Couvre 4 conventions parmi 7 mappings ajoutes : Segment camelCase, Segment
// v2 spec (espace), Shopify Web Pixels bridge, UA legacy `transaction`. Les
// autres (Stape suffix, GTM4WP, eec.*) sont redondants avec tests unit.

test.describe("DataLayer — mappings april 2026", () => {
  test("productAdded (Segment camelCase) emits canonical add_to_cart", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "productAdded",
        ecommerce: {
          value: 49.9,
          currency: "EUR",
          items: [
            { item_id: "SIM-PA-1", item_name: "Sim productAdded", price: 49.9, quantity: 1 },
          ],
        },
      })
    })

    await page.waitForTimeout(400)
    await interceptor.triggerFlush()

    const adds = interceptor.getEvents("add_to_cart")
    expect(adds.length, "add_to_cart should be emitted via productAdded mapping").toBeGreaterThan(0)
    expect(adds[0].payload.value).toBe(49.9)
    expect(adds[0].payload.currency).toBe("EUR")

    const validations = interceptor.getEvents("datalayer_validation")
    const v = validations.find((e) => e.payload.event_name === "add_to_cart")
    expect(v?.payload.is_valid).toBe(true)
  })

  test("Product Added (Segment v2 spec, with space) emits canonical add_to_cart", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "Product Added",
        ecommerce: {
          value: 89.0,
          currency: "EUR",
          items: [
            { item_id: "SIM-PA-2", item_name: "Sim Product Added", price: 89.0, quantity: 1 },
          ],
        },
      })
    })

    await page.waitForTimeout(400)
    await interceptor.triggerFlush()

    const adds = interceptor.getEvents("add_to_cart")
    expect(adds.length, "add_to_cart should be emitted via 'Product Added' mapping").toBeGreaterThan(0)
    expect(adds[0].payload.value).toBe(89.0)
  })

  test("product_added_to_cart (Shopify Web Pixels bridge) emits add_to_cart", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "product_added_to_cart",
        ecommerce: {
          value: 19.99,
          currency: "EUR",
          items: [
            { item_id: "SIM-WP-1", item_name: "Shopify WP", price: 19.99, quantity: 1 },
          ],
        },
      })
    })

    await page.waitForTimeout(400)
    await interceptor.triggerFlush()

    const adds = interceptor.getEvents("add_to_cart")
    expect(adds.length).toBeGreaterThan(0)
    expect(adds[0].payload.value).toBe(19.99)
  })

  test("transaction (UA legacy) emits canonical purchase with transaction_id", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    // UA legacy `transaction` event with GA4-shaped ecommerce so validation
    // succeeds. The mapping itself is the contract under test.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "transaction",
        ecommerce: {
          transaction_id: "UA-TX-42",
          value: 250.0,
          currency: "EUR",
          items: [
            { item_id: "SIM-UA-1", item_name: "UA Tx", price: 250.0, quantity: 1 },
          ],
        },
      })
    })

    await page.waitForTimeout(400)
    await interceptor.triggerFlush()

    const purchases = interceptor.getEvents("purchase")
    expect(
      purchases.length,
      "purchase should be emitted via UA legacy 'transaction' mapping",
    ).toBeGreaterThan(0)
    expect(purchases[0].payload.transaction_id).toBe("UA-TX-42")
    expect(purchases[0].payload.value).toBe(250.0)
    expect(purchases[0].payload.currency).toBe("EUR")
  })

  test("cart_add (Tealium UDO bridge) emits canonical add_to_cart", async ({
    page,
  }) => {
    await simulateAxeptio(page, true)
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dl = ((window as any).dataLayer ||= [])
      dl.push({
        event: "cart_add",
        ecommerce: {
          value: 12.5,
          currency: "EUR",
          items: [
            { item_id: "SIM-TLM-1", item_name: "Tealium UDO", price: 12.5, quantity: 1 },
          ],
        },
      })
    })

    await page.waitForTimeout(400)
    await interceptor.triggerFlush()

    const adds = interceptor.getEvents("add_to_cart")
    expect(adds.length, "add_to_cart should be emitted via Tealium 'cart_add'").toBeGreaterThan(0)
    expect(adds[0].payload.value).toBe(12.5)
  })
})

// ---------------------------------------------------------------------------
// P1 — order_confirmation patterns FR/ES/IT custom
// ---------------------------------------------------------------------------
//
// PAGE_TYPE_URL_PATTERNS.order_confirmation a gagne 29 entrees retail
// mid-market FR/ES/IT (audit 2026-04-28). Asserter via le snippet sur
// /sim/pdp + pushState SPA — la cascade detectPageTypeFast lit l'URL en
// priorite sur les EXPLICIT_NON_PRODUCT_PAGE_TYPES (incluant
// order_confirmation).

interface OrderConfirmationCase {
  locale: "FR" | "ES" | "IT"
  url: string
}

const ORDER_CONFIRMATION_CASES: OrderConfirmationCase[] = [
  { locale: "FR", url: "/commande-confirmee?numero_commande=99" },
  { locale: "ES", url: "/pedido-confirmado?id_pedido=42" },
  { locale: "IT", url: "/grazie?id_ordine=7" },
]

test.describe("page_type — order_confirmation FR/ES/IT custom", () => {
  for (const oc of ORDER_CONFIRMATION_CASES) {
    test(`${oc.locale} ${oc.url} → page_type=order_confirmation`, async ({
      page,
    }) => {
      const interceptor = new IngestInterceptor(page)
      await interceptor.attach()
      await injectSnippet(page, doomcheck)

      await page.goto("/sim/pdp")
      await waitBoot(page)

      // SPA pushState — pageview emitted via onNavigationChange.
      await page.evaluate((to) => {
        window.history.pushState({}, "", to)
      }, oc.url)

      await page.waitForTimeout(600)
      await interceptor.triggerFlush()

      const targetPath = oc.url.split("?")[0]
      const pv = interceptor
        .getPageviews()
        .find((p) => p.path === targetPath)
      expect(
        pv,
        `pageview for ${oc.url} should be captured`,
      ).toBeDefined()
      expect(
        pv!.page_type,
        `${oc.locale} pattern ${oc.url} should be detected as order_confirmation`,
      ).toBe("order_confirmation")
    })
  }
})

// ---------------------------------------------------------------------------
// P1 — CartSuccess url_change multilingue
// ---------------------------------------------------------------------------
//
// Cascade add_to_cart_succeeded url_change est rebuildee dynamiquement a
// partir de PAGE_TYPE_URL_PATTERNS.cart (40+ patterns) + AMBIGUOUS word-bound.
// Couvre IT (carrello), PL (koszyk) — patterns qui ne sont pas couverts par
// le test legacy /cart de checkout.spec.ts.

test.describe("add_to_cart_succeeded — url_change multilingue", () => {
  test("nav vers /carrello (IT) post-clic ATC fire url_change cascade", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    await page.click("#sim-atc")
    await page.waitForTimeout(200)

    await page.evaluate(() => {
      window.history.pushState({}, "", "/carrello?sim=1")
    })

    await page.waitForTimeout(600)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("add_to_cart_succeeded")
    expect(events.length, "add_to_cart_succeeded should fire on /carrello (IT)").toBeGreaterThan(0)
    expect(events[0].payload.cascade_matched).toBe("url_change")
  })

  test("nav vers /koszyk (PL) post-clic ATC fire url_change cascade", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    await page.click("#sim-atc")
    await page.waitForTimeout(200)

    await page.evaluate(() => {
      window.history.pushState({}, "", "/koszyk")
    })

    await page.waitForTimeout(600)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("add_to_cart_succeeded")
    expect(events.length, "add_to_cart_succeeded should fire on /koszyk (PL)").toBeGreaterThan(0)
    expect(events[0].payload.cascade_matched).toBe("url_change")
  })
})

// ---------------------------------------------------------------------------
// P1 — Anti-FP /sac /bag (regression structurelle critique)
// ---------------------------------------------------------------------------
//
// /sacs-femme, /sacoche-cuir, /bagages-soldes etaient jadis matches comme
// cart par PAGE_TYPE_URL_PATTERNS.cart contenant "/sac" et "/bag" en
// substring. Patch : split SAFE/AMBIGUOUS, /sac et /bag exigent maintenant
// match segment-complet via word-boundary `(?:^|/)(?:sac|bag)(?:$|/)`.
//
// Faux positif ici masque les vrais ATC silent_fail sur sites maroquinerie
// (Lancel, Longchamp) ou luxe (Hermes, Chanel) — fuites non detectees =
// alertes manquees = revenue lost.

test.describe("add_to_cart_succeeded — anti-FP /sac /bag", () => {
  test("nav vers /sacs-femme post-clic ATC ne DOIT PAS fire url_change", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    await page.click("#sim-atc")
    await page.waitForTimeout(200)

    await page.evaluate(() => {
      window.history.pushState({}, "", "/sacs-femme")
    })

    // Wait the full WINDOW_MS (2500ms) to be sure no late cascade fires.
    await page.waitForTimeout(2700)
    await interceptor.triggerFlush()

    const successes = interceptor.getEvents("add_to_cart_succeeded")
    const urlChange = successes.find(
      (e) => e.payload.cascade_matched === "url_change",
    )
    expect(
      urlChange,
      "url_change MUST NOT fire on /sacs-femme (would mask real silent_fail on bag/luxury sites)",
    ).toBeUndefined()
  })

  test("nav vers /sac (segment complet FR luxe) post-clic ATC fire url_change", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/sim/pdp")
    await waitBoot(page)

    await page.click("#sim-atc")
    await page.waitForTimeout(200)

    await page.evaluate(() => {
      window.history.pushState({}, "", "/sac")
    })

    await page.waitForTimeout(600)
    await interceptor.triggerFlush()

    const events = interceptor.getEvents("add_to_cart_succeeded")
    expect(
      events.length,
      "add_to_cart_succeeded should fire on /sac (full segment, FR luxe convention)",
    ).toBeGreaterThan(0)
    expect(events[0].payload.cascade_matched).toBe("url_change")
  })
})

// ---------------------------------------------------------------------------
// P2 — body classes order_confirmation Hybris / Spartacus
// ---------------------------------------------------------------------------
//
// BODY_CLASS_PAGE_TYPE est lu en cascade page_type apres JSON-LD. Le test
// pose la classe pendant DOMContentLoaded (avant le boot du snippet) sur
// une URL neutre (/sim/checkout — pas dans EXPLICIT_NON_PRODUCT_PAGE_TYPES
// pattern matching pour order_confirmation). Le sim/pdp force pdp via
// JSON-LD donc ne convient pas pour valider la cascade body class.

test.describe("page_type — body classes Hybris/Spartacus order_confirmation", () => {
  test("body.classList contains 'pageLabel-orderConfirmation' (Hybris) → page_type=order_confirmation", async ({
    page,
  }) => {
    // Serve a neutral HTML page whose URL does NOT match any
    // PAGE_TYPE_URL_PATTERNS or EXPLICIT_NON_PRODUCT_PAGE_TYPES — body class
    // must be the winning signal in the page_type cascade. Using
    // /sim/checkout would lose to URL pattern '/checkout' (matches before
    // body class in cascade priority).
    await page.route("**/atc-patterns-body-class-fixture", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body:
          '<!doctype html><html><head><title>Sim Hybris</title></head>' +
          '<body class="pageLabel-orderConfirmation"><h1>Sim</h1></body></html>',
      }),
    )

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, doomcheck)

    await page.goto("/atc-patterns-body-class-fixture")
    await waitBoot(page)

    await interceptor.triggerFlush()

    const pv = interceptor
      .getPageviews()
      .find((p) => p.path === "/atc-patterns-body-class-fixture")
    expect(pv, "pageview for fixture should be captured").toBeDefined()
    expect(
      pv!.page_type,
      "Hybris body class pageLabel-orderConfirmation should map to order_confirmation",
    ).toBe("order_confirmation")
  })
})
