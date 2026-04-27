import { test, expect, type Page } from "@playwright/test"
import { injectSnippet } from "../helpers/inject-snippet"

// Spec — non-régression mémoire sur SPA (Vague 4 — Worker D5).
//
// Sur les vraies SPA (Nuxt, Next.js, React Router), le snippet Korvus voit
// passer N navigations sans rechargement complet du JS context. Chaque
// pushState ré-init les "spa-collectors" (cf. snippet/src/index.ts:281
// `initSpaCollectors`) et tear-down les listeners attachés à l'ancien
// pageview via le drain de `spaCleanups` (snippet/src/index.ts:241).
//
// Le risque : un collecteur ré-initable qui oublie de retourner sa cleanup,
// une closure qui capture un bus / DOM ref devenu obsolète, ou un timer
// SPA non clearé (cf. spa-navigation.spec.ts test 3 fixme P1) → le heap
// croît à chaque nav. À 10k pageviews/jour sur un site mid-market, c'est
// rapidement plusieurs MB de leak, voire un crash onglet sur mobile bas
// de gamme.
//
// Ce spec mesure `performance.memory.usedJSHeapSize` avant / après 10
// navigations SPA et asserte un delta < 500 KB médian sur 3 mesures.
//
// LIMITES — à lire AVANT de débugger un échec :
//
// 1. `performance.memory` est Chromium-only (skip Firefox/Safari).
// 2. Sans `--js-flags="--expose-gc"` côté Playwright, le test ne peut pas
//    forcer une GC déterministe — on s'appuie sur des waits + idle pour
//    laisser V8 collecter, ce qui est best-effort. En CI sans expose-gc,
//    le test est intrinsèquement bruyant : variance ±200 KB normale, on
//    prend la médiane de 3 mesures pour absorber les pics. Si le test
//    devient flaky à > 500 KB, élargir le seuil à 1 MB ou activer
//    `--js-flags="--expose-gc"` en CI.
// 3. Le test ne re-init pas explicitement le snippet via
//    `__korvus_internal__.destroy` puis re-eval du bundle (chargement
//    `<script>` synchrone difficile depuis Playwright sans full reload).
//    Il mesure le scénario SPA "normal" : 10 navigations consécutives qui
//    déclenchent les internes spa-cleanup/re-init du snippet. C'est le
//    cas d'usage réel qu'on veut protéger.
// 4. Pour mesurer un destroy/re-init complet, il faudrait un test
//    parallèle qui full-reload entre les cycles — couvert différemment
//    par les listeners-leak (Worker D4) et le boot singleton (audit B3).

// --- Configuration ---

interface FloralConfig {
  websiteId: string
  category: string
  productPath: string
  routes: { cart: string; checkout: string; thanks: string }
}

const FLORAL_FR: FloralConfig = {
  websiteId: "00000000-0000-4000-a000-000000001015",
  category: "deuil",
  productPath: "/p/deuil-bouquet-eclosion-espoir/1/FR",
  routes: { cart: "/panier", checkout: "/checkout", thanks: "/merci" },
}

// Seuil — 500 KB de delta heap autorisé sur la médiane de 3 mesures
// finales. En dessous = pass. Voir LIMITES point 2 pour la rationale.
const HEAP_DELTA_THRESHOLD_BYTES = 500 * 1024

// 10 cycles de navigation SPA (le plan demande 10).
const SPA_NAV_CYCLES = 10

// Nombre de mesures heap finales (médiane utilisée pour absorber la
// variance GC).
const FINAL_MEASUREMENTS = 3

// --- Helpers ---

interface PerformanceMemory {
  memory: { usedJSHeapSize: number }
}

// Lit `performance.memory.usedJSHeapSize` côté page. Cast localisé : la
// surface n'est pas dans les types DOM standard (proposal Chromium).
async function readHeapSize(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const perf = performance as unknown as PerformanceMemory
    return perf.memory.usedJSHeapSize
  })
}

// Best-effort GC. Préfère `window.gc` si exposé (`--js-flags="--expose-gc"`),
// sinon laisse passer plusieurs ticks d'event loop pour donner à V8 une
// fenêtre de collecte (heuristique reconnue, jamais déterministe).
async function bestEffortGc(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (typeof w.gc === "function") {
      // Triple call : V8 fait du mark-sweep partiel sinon (cf. v8 docs).
      w.gc()
      w.gc()
      w.gc()
    } else {
      // Best-effort : 5 × 100 ms d'idle pour solliciter l'idle GC de V8.
      for (let i = 0; i < 5; i++) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100))
      }
    }
  })
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// --- Test ---

test.describe("perf-memory-spa", () => {
  // Chromium-only : performance.memory est non-standard.
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "performance.memory is Chromium-only (non-standard API)",
  )

  test("10 navigations SPA → delta heap médian < 500 KB", async ({ page }) => {
    // Ne tourner que sur floral-nuxt-fr (port 3004). Si le project n'est
    // pas configuré pour ce spec, skip plutôt que tomber sur un mauvais
    // baseURL (cf. config Playwright qui ne match pas perf-memory-spa
    // pour tous les projects par défaut — ajouter testMatch côté config
    // si besoin de l'exécuter dans la matrice).
    const projectName = test.info().project.name
    test.skip(
      projectName !== "floral-nuxt-fr",
      `perf-memory-spa.spec.ts ne tourne que sur floral-nuxt-fr, project=${projectName}`,
    )

    test.setTimeout(60_000)

    // Setup snippet — pas d'IngestInterceptor : on veut le moins de bruit
    // possible côté heap (les batches /api/ingest accumulent des objets).
    // On laisse les requêtes partir dans le vide (Playwright les ignore
    // sans interceptor explicite, requêtes 404 sur /api/ingest qui ne
    // sont PAS retournées dans le buffer snippet → pas de retain).
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
    })

    // Boot frais sur home, attendre le boot snippet (post-load + setTimeout(0)).
    await page.goto("/")
    await page.waitForTimeout(2000)

    // Sanity : performance.memory exposé. Si Chromium est lancé sans
    // l'API, skip — sinon on aurait un NaN comparison plus loin.
    // Fix audit Vague 4 e2e : test.skip() mid-test ne stoppe pas l'exécution
    // en Playwright — on `return` explicitement après pour ne pas continuer
    // la boucle 10 cycles avec un heap NaN.
    const memoryAvailable = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return typeof (performance as any).memory?.usedJSHeapSize === "number"
    })
    if (!memoryAvailable) {
      test.skip(
        true,
        "performance.memory.usedJSHeapSize not exposed (Chromium flag disabled?)",
      )
      return
    }

    // --- Baseline heap ---
    await bestEffortGc(page)
    const baselineHeap = await readHeapSize(page)

    // --- 10 cycles de navigation SPA ---
    // Cycle entre 5 paths réels Nuxt — pushState direct (déterministe,
    // pas de dépendance au markup, comme spa-navigation.spec.ts test 2).
    const targets = [
      `/c/${FLORAL_FR.category}`,
      FLORAL_FR.productPath,
      FLORAL_FR.routes.cart,
      FLORAL_FR.routes.checkout,
      "/",
    ]
    for (let i = 0; i < SPA_NAV_CYCLES; i++) {
      const target = targets[i % targets.length]
      await page.evaluate((t) => {
        window.history.pushState({}, "", t)
      }, target)
      // 300 ms entre chaque nav : laisse le snippet drain spaCleanups +
      // re-init les SPA collectors avant la prochaine pushState.
      await page.waitForTimeout(300)
    }

    // --- Mesures finales ---
    // 3 lectures espacées avec best-effort GC entre chaque, médiane.
    const finalMeasurements: number[] = []
    for (let i = 0; i < FINAL_MEASUREMENTS; i++) {
      await bestEffortGc(page)
      // 200 ms d'idle supplémentaire pour laisser les microtasks se
      // résoudre (callbacks idle du snippet, MutationObserver flush).
      await page.waitForTimeout(200)
      finalMeasurements.push(await readHeapSize(page))
    }

    const medianHeap = median(finalMeasurements)
    const delta = medianHeap - baselineHeap

    // Logs utiles pour debug en cas de flake (Playwright reporter HTML
    // capture le stdout du test).
    // eslint-disable-next-line no-console
    console.log(
      `[perf-memory-spa] baseline=${baselineHeap} bytes, ` +
        `final measurements=${finalMeasurements.join(",")} bytes, ` +
        `median=${medianHeap} bytes, delta=${delta} bytes ` +
        `(threshold=${HEAP_DELTA_THRESHOLD_BYTES} bytes)`,
    )

    expect(
      delta,
      `delta heap médian (${delta} bytes) après ${SPA_NAV_CYCLES} navs SPA ` +
        `doit être < ${HEAP_DELTA_THRESHOLD_BYTES} bytes. ` +
        `baseline=${baselineHeap}, mesures=${finalMeasurements.join(",")}. ` +
        `Si flaky en CI : élargir le seuil ou activer --js-flags="--expose-gc".`,
    ).toBeLessThan(HEAP_DELTA_THRESHOLD_BYTES)
  })
})
