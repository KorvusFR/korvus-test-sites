import { test, expect, type Page } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet } from "../helpers/inject-snippet"

// Spec — navigation SPA stricte (Vague 2 — Worker B5).
//
// Cible le snippet sur floral-nuxt (Nuxt 3 SSR + client router) qui réplique
// les patterns Interflora en SPA. La cible n'est PAS la cascade fonctionnelle
// (déjà couverte par tests/specs/floral-nuxt.spec.ts) — c'est l'hygiène
// technique du listener `onNavigationChange` exposé par le bus snippet :
//
//   1. pushState émet UN nouveau pageview avec un id distinct et
//      navigation_type='navigate'.
//   2. Après 5 navigations, le compteur `addEventListener` n'a PAS dérivé :
//      les listeners globaux (visibilitychange, pagehide) restent attachés
//      une seule fois, et les listeners SPA-collectors n'accumulent pas
//      d'orphelins (delta net `added - removed` borné).
//   3. Les setTimeout SPA armés par le pageview collector pour la cascade
//      produit retry (cf. snippet/src/collectors/pageview.ts:931-932) sont
//      clearés sur navigation. Test marqué `fixme` tant que le bug est
//      ouvert (P1 connu de la code-review Vague 1, hors scope B5).
//
// Le test 1 vit en double avec le test "Dédup SPA" de floral-nuxt.spec.ts
// mais à un niveau plus brut (assertion sur navigation_type, pas sur la
// cascade page_type). C'est volontaire : on veut un signal qui régresse
// uniquement quand le bus / pageview collector lui-même se casse.

interface SpaConfig {
  websiteId: string
  productPath: string
  category: string
}

const FLORAL_FR: SpaConfig = {
  websiteId: "00000000-0000-4000-a000-000000001015",
  productPath: "/p/deuil-bouquet-eclosion-espoir/1/FR",
  category: "deuil",
}

async function setupSpec(page: Page): Promise<{ interceptor: IngestInterceptor }> {
  const interceptor = new IngestInterceptor(page)
  await interceptor.attach()
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w._axcb = []
    w.axeptio_settings = { cookies: { google_analytics: true } }
  })
  await injectSnippet(page, {
    websiteId: FLORAL_FR.websiteId,
    apiKey:
      "kv_test_0000000000000000000000000000000000000000000000000000000000000001",
    endpoint: "/api/ingest",
    platform: "custom",
    pageTypeRules: {
      cart: { url_contains: "/panier" },
      checkout: { url_contains: "/checkout" },
      order_confirmation: { url_contains: "/merci" },
    },
  })
  return { interceptor }
}

// Spy `addEventListener` / `removeEventListener` / `setTimeout` /
// `clearTimeout` AVANT que le snippet boot. Posé via `addInitScript` pour
// que le hook soit en place avant l'évaluation du bundle snippet (qui
// passe lui-même par `addInitScript` côté inject-snippet helper).
//
// Le snapshot est exposé via `window.__korvusSpyState`. Les tests le
// lisent via `page.evaluate` à des moments précis du parcours.
async function installSpies(page: Page): Promise<void> {
  await page.addInitScript(() => {
    interface ListenerEntry {
      target: "document" | "window"
      type: string
      added: number
      removed: number
    }
    interface SpyState {
      listeners: Record<string, ListenerEntry>
      timersArmed: number[]
      timersCleared: number[]
    }
    const state: SpyState = {
      listeners: {},
      timersArmed: [],
      timersCleared: [],
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__korvusSpyState = state

    function key(target: "document" | "window", type: string): string {
      return `${target}:${type}`
    }
    function bump(
      target: "document" | "window",
      type: string,
      field: "added" | "removed",
    ): void {
      const k = key(target, type)
      const existing = state.listeners[k]
      if (existing) {
        existing[field] += 1
      } else {
        state.listeners[k] = {
          target,
          type,
          added: field === "added" ? 1 : 0,
          removed: field === "removed" ? 1 : 0,
        }
      }
    }

    // Wrap document.addEventListener / removeEventListener
    const docAdd = document.addEventListener.bind(document)
    const docRemove = document.removeEventListener.bind(document)
    document.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      bump("document", type, "added")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docAdd(type, listener as any, options as any)
    }
    document.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      bump("document", type, "removed")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      docRemove(type, listener as any, options as any)
    }

    // Wrap window.addEventListener / removeEventListener
    const winAdd = window.addEventListener.bind(window)
    const winRemove = window.removeEventListener.bind(window)
    window.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ): void {
      bump("window", type, "added")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      winAdd(type, listener as any, options as any)
    }
    window.removeEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions,
    ): void {
      bump("window", type, "removed")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      winRemove(type, listener as any, options as any)
    }

    // Wrap setTimeout / clearTimeout. On garde l'ID natif retourné pour ne
    // pas casser le contrat (numeric id consommé par le code snippet).
    const nativeSetTimeout = window.setTimeout.bind(window)
    const nativeClearTimeout = window.clearTimeout.bind(window)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).setTimeout = function (
      handler: TimerHandler,
      timeout?: number,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...args: any[]
    ): number {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = (nativeSetTimeout as any)(handler, timeout, ...args) as number
      // On ne tracke que les SPA timers du collector pageview (2000ms / 5000ms).
      // Tracker tous les setTimeout polluerait le compteur avec les timers du
      // framework Nuxt, du runtime Vue, du transport bus snippet, etc.
      if (timeout === 2000 || timeout === 5000) {
        state.timersArmed.push(id)
      }
      return id
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).clearTimeout = function (id?: number): void {
      if (typeof id === "number" && state.timersArmed.includes(id)) {
        state.timersCleared.push(id)
      }
      nativeClearTimeout(id)
    }
  })
}

interface SpyState {
  listeners: Record<
    string,
    { target: "document" | "window"; type: string; added: number; removed: number }
  >
  timersArmed: number[]
  timersCleared: number[]
}

async function readSpyState(page: Page): Promise<SpyState> {
  return await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__korvusSpyState as SpyState
  })
}

// Force route via project floral-nuxt-fr (port 3004). Ne pas tourner sur
// les autres locales : test 3 cible un timing produit français spécifique
// et les autres `floral-nuxt-{es,it}` couvrent déjà la matrice locale via
// floral-nuxt.spec.ts. On skip top-level via `testMatch` côté config dès
// qu'un project ≠ floral-nuxt-fr est en cours, mais ce spec est globalement
// monté sur tous les projects floral-nuxt — d'où le garde au début de
// chaque test.
function skipIfNotFlrFr(): void {
  const project = test.info().project.name
  if (project !== "floral-nuxt-fr") {
    test.skip(
      true,
      `spa-navigation.spec.ts ne tourne que sur floral-nuxt-fr, project actuel = ${project}`,
    )
  }
}

// ---------------------------------------------------------------------------
// Test 1 — pushState émet un nouveau pageview avec un id distinct
// ---------------------------------------------------------------------------

test("pushState SPA → 2 pageviews avec ids distincts + navigation_type", async ({
  page,
}) => {
  skipIfNotFlrFr()
  test.setTimeout(30_000)

  const { interceptor } = await setupSpec(page)

  await page.goto("/")
  await page.waitForTimeout(2000)

  // pushState via click lien interne (pattern le plus proche d'un user réel
  // en SPA Nuxt). Le router Nuxt monkey-patche déjà history.pushState avant
  // notre snippet, donc le snippet voit un pushState natif.
  await Promise.all([
    page.waitForURL(
      (u) => u.pathname === `/c/${FLORAL_FR.category}`,
      { timeout: 5000 },
    ),
    page.click(`[data-testid="home-category-link"]`),
  ])
  await page.waitForTimeout(400)

  await interceptor.triggerFlush()

  const pageviews = interceptor.getPageviews()
  expect(pageviews.length, "2 pageviews (/, /c/X) attendus").toBe(2)

  const pvIds = new Set(pageviews.map((p) => p.id))
  expect(pvIds.size, "2 pageview_id distincts").toBe(2)

  expect(pageviews[0].path).toBe("/")
  expect(pageviews[1].path).toBe(`/c/${FLORAL_FR.category}`)

  // Le 1er pageview lit PerformanceNavigationTiming → "navigate"/"reload"/
  // "back_forward". Le 2e est forcé à "navigate" côté snippet (cf.
  // pageview.ts:849-852, isSpaNav branch). Asserter spécifiquement sur le
  // 2e pour matérialiser que le bus a bien re-fired emitPageview() en SPA.
  expect(
    pageviews[1].navigation_type,
    "pageview SPA doit porter navigation_type='navigate'",
  ).toBe("navigate")
})

// ---------------------------------------------------------------------------
// Test 2 — listeners non dupliqués après 5 navigations SPA
// ---------------------------------------------------------------------------

test("5 navigations SPA → 0 listener orphelin sur document/window", async ({
  page,
}) => {
  skipIfNotFlrFr()
  test.setTimeout(30_000)

  await installSpies(page)
  const { interceptor } = await setupSpec(page)

  await page.goto("/")
  await page.waitForTimeout(2000)

  // Snapshot post-boot : représente l'état "snippet attaché, 0 nav SPA".
  const baseline = await readSpyState(page)

  // 5 navigations SPA via pushState direct (plus déterministe que click :
  // pas de dépendance au markup). Le snippet écoute `onNavigationChange`
  // côté bus, qui hooke history.pushState au boot.
  const targets = [
    `/c/${FLORAL_FR.category}`,
    FLORAL_FR.productPath,
    "/panier",
    "/checkout",
    "/",
  ]
  for (const target of targets) {
    await page.evaluate((t) => {
      window.history.pushState({}, "", t)
    }, target)
    await page.waitForTimeout(300)
  }

  const after = await readSpyState(page)

  // Listeners "globaux" qui doivent être attachés UNE seule fois pour toute
  // la vie de la page (pas de re-attach par pageview). On compare le delta
  // baseline → after : 0 ajout, 0 retrait.
  const GLOBAL_LISTENERS: Array<{ target: "document" | "window"; type: string }> = [
    { target: "document", type: "visibilitychange" },
    { target: "window", type: "pagehide" },
  ]
  for (const { target, type } of GLOBAL_LISTENERS) {
    const k = `${target}:${type}`
    const baseEntry = baseline.listeners[k]
    const afterEntry = after.listeners[k]
    const baseAdded = baseEntry?.added ?? 0
    const baseRemoved = baseEntry?.removed ?? 0
    const afterAdded = afterEntry?.added ?? 0
    const afterRemoved = afterEntry?.removed ?? 0
    expect(
      afterAdded - baseAdded,
      `${k} : aucun nouvel addEventListener attendu après 5 SPA navs (+${afterAdded - baseAdded})`,
    ).toBe(0)
    expect(
      afterRemoved - baseRemoved,
      `${k} : aucun removeEventListener inattendu`,
    ).toBe(0)
  }

  // Pour les listeners SPA-collectors (non listés explicitement), invariant
  // global : pour CHAQUE type de listener, le delta net (added - removed)
  // ne doit pas grandir avec le nombre de navigations. On compare le delta
  // net total baseline vs after — si le snippet réinitialise proprement,
  // ce delta reste constant (chaque add est compensé par un remove sur la
  // nav suivante, ou bien il n'y a aucun add post-boot).
  let baseNet = 0
  for (const v of Object.values(baseline.listeners)) {
    baseNet += v.added - v.removed
  }
  let afterNet = 0
  for (const v of Object.values(after.listeners)) {
    afterNet += v.added - v.removed
  }
  // Tolérance : on autorise la croissance du delta net jusqu'à ~5 listeners
  // (Nuxt page transitions, Vue refs, etc. peuvent légitimement attacher des
  // listeners par page). Au-delà = leak.
  expect(
    afterNet - baseNet,
    `delta net listeners après 5 SPA navs = ${afterNet - baseNet} (>5 = leak)`,
  ).toBeLessThanOrEqual(5)

  // Sanity : les 5 navs ont bien fire des pageviews côté snippet (sinon
  // l'absence de listener leak ne prouve rien — pourrait juste être un
  // listener navigationChange non attaché).
  await interceptor.triggerFlush()
  const pageviews = interceptor.getPageviews()
  // Boot + 5 navs SPA = 6 pageviews. La dernière est /, donc dédupée si
  // on revient au path initial → tolérance 5..6.
  expect(pageviews.length, "≥5 pageviews attendus après 5 SPA navs").toBeGreaterThanOrEqual(5)
})

// Le test "timers SPA cascade produit clearés sur navigation" qui vivait
// ici a été supprimé : son assertion baseline (≥2 setTimeout armés au boot
// PDP) reposait sur `product_id_source === "url_slug"`, jamais atteint sur
// floral-nuxt qui injecte le JSON-LD synchrone via Nuxt SSR. Le clear timer
// est désormais validé en unit déterministe :
// platform/tests/unit/snippet/pageview-spa.test.ts (test 9).
