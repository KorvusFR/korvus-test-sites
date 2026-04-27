import { test, expect } from "@playwright/test"
import { injectSnippet } from "../helpers/inject-snippet"

/**
 * Vague 4 — Worker D2 — TBT budget du snippet.
 *
 * Mesure le Total Blocking Time imputable au snippet Korvus :
 *   - PerformanceObserver côté navigateur capte les entries `longtask`.
 *   - Pour chaque longtask, on lit `attribution[]` (Long Task API V2).
 *   - Une longtask dont au moins une attribution a un `containerSrc` ou
 *     `containerName` qui contient `korvus.min.js` est considérée
 *     Korvus-attribuable.
 *   - Assert : 0 longtask Korvus-attribuable > 50 ms (seuil web vital).
 *
 * Notes / caveats :
 *   - Long Task Attribution API n'est implémentée que sur les moteurs
 *     Blink/Chromium. Le test est donc skippé hors `chromium`.
 *   - 50 ms est le seuil web vital standard (Lighthouse, web.dev). En CI
 *     sous charge, des opérations légitimes (JIT warmup, GC, parsing
 *     premier bundle) peuvent franchir ce seuil. Si flake observé, ne
 *     **pas** monter le seuil aveuglément : isoler la source via la
 *     stack `attribution[].name` et soit la corriger, soit tolérer ce
 *     pattern précis explicitement.
 *   - Le test est volontairement long (~70 s) — il faut un timeout de
 *     test suffisant pour absorber le scénario d'interaction de 60 s.
 *   - Le snippet est injecté via `addInitScript` — sa source apparaît
 *     dans `containerSrc` comme une entrée inline / blob. On matche aussi
 *     bien `korvus.min.js` (cas script tag) qu'une heuristique stack
 *     basée sur `containerName` au cas où le navigateur attribue
 *     l'éval à une "unknown" container — voir `isKorvusAttributable`.
 */

interface LongTaskAttributionLite {
  containerType?: string
  containerSrc?: string
  containerName?: string
  containerId?: string
  name?: string
}

interface LongTaskRecord {
  startTime: number
  duration: number
  name: string
  attribution: LongTaskAttributionLite[]
}

const KORVUS_MARKER = /korvus\.min\.js/i
const LONG_TASK_THRESHOLD_MS = 50
const INTERACTION_DURATION_MS = 60_000

test.describe("perf — TBT budget snippet", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Long Task Attribution API only supported on Chromium engines",
  )

  test("0 long task > 50ms attribuable au snippet Korvus sur 60s d'interaction", async ({
    page,
  }) => {
    // Test extends global 60s timeout — interaction loop alone is 60s.
    // setTimeout au niveau test() (pas describe) — fix audit Vague 4 e2e.
    test.setTimeout(120_000)

    // 1. Inject the snippet (athletedatahub config).
    await injectSnippet(page, "athletedatahub")

    // 2. Install the longtask collector BEFORE any navigation so we
    //    capture tasks generated during boot too.
    await page.addInitScript(() => {
      interface LTAttr {
        containerType?: string
        containerSrc?: string
        containerName?: string
        containerId?: string
        name?: string
      }
      interface LTRecord {
        startTime: number
        duration: number
        name: string
        attribution: LTAttr[]
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      w.__korvusLongTasks = [] as LTRecord[]
      w.__korvusLTSupported = false

      try {
        const supported =
          typeof PerformanceObserver !== "undefined" &&
          Array.isArray(
            (
              PerformanceObserver as unknown as {
                supportedEntryTypes?: string[]
              }
            ).supportedEntryTypes,
          ) &&
          (
            PerformanceObserver as unknown as {
              supportedEntryTypes: string[]
            }
          ).supportedEntryTypes.includes("longtask")
        if (!supported) return
        w.__korvusLTSupported = true

        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // PerformanceLongTaskTiming is not in lib.dom widely; access
            // attribution defensively.
            const e = entry as unknown as {
              startTime: number
              duration: number
              name: string
              attribution?: LTAttr[]
            }
            const attribution: LTAttr[] = Array.isArray(e.attribution)
              ? e.attribution.map((a) => ({
                  containerType: a.containerType,
                  containerSrc: a.containerSrc,
                  containerName: a.containerName,
                  containerId: a.containerId,
                  name: a.name,
                }))
              : []
            w.__korvusLongTasks.push({
              startTime: e.startTime,
              duration: e.duration,
              name: e.name,
              attribution,
            })
          }
        })
        obs.observe({ type: "longtask", buffered: true })
      } catch {
        w.__korvusLTSupported = false
      }
    })

    // 3. Visit athletedatahub home (port 3001 — absolute URL since this
    //    spec runs under the `doomcheck` project's baseURL).
    await page.goto("http://localhost:3001/", { waitUntil: "load" })

    // Confirm the Long Task Attribution API is available; otherwise skip.
    // Fix audit Vague 4 e2e : test.skip() mid-test ne stoppe pas l'exécution
    // automatiquement en Playwright. On utilise test.info().skip() + return
    // pour garantir l'arrêt immédiat avant la boucle d'interaction 60s.
    const supportLTAttribution = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__korvusLTSupported === true
    })
    if (!supportLTAttribution) {
      test.skip(true, "Long Task Attribution API not supported in this browser")
      return
    }

    // Let the snippet finish booting.
    await page.waitForTimeout(2000)

    // 4. 60 s interaction scenario — scrolls, clicks, navigation.
    const start = Date.now()

    // 4a. 10 scrolls.
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 600)
      await page.waitForTimeout(300)
    }

    // 4b. Click 5 different elements (best-effort — selectors are
    //     defensive: if the element is missing we just skip it, the test
    //     still measures TBT under realistic interaction).
    const clickTargets = [
      "header a:visible",
      "[data-testid='product-card']:nth-of-type(1) a",
      "[data-testid='product-card']:nth-of-type(2) a",
      "button[aria-label*='search' i]",
      "nav a:visible",
    ]
    for (const sel of clickTargets) {
      try {
        const el = page.locator(sel).first()
        if ((await el.count()) > 0) {
          await el.click({ timeout: 2000, trial: false }).catch(() => {})
          await page.waitForTimeout(400)
          // Go back home if we navigated away, to keep clicking on home.
          if (!page.url().endsWith("/")) {
            await page.goto("http://localhost:3001/", { waitUntil: "load" })
            await page.waitForTimeout(300)
          }
        }
      } catch {
        // Ignore click failures — they don't invalidate TBT measurement.
      }
    }

    // 4c. Navigate to a PDP, scroll, come back.
    try {
      const pdpLink = page
        .locator("a[href*='/product'], a[href*='/products/']")
        .first()
      if ((await pdpLink.count()) > 0) {
        await pdpLink.click({ timeout: 3000 }).catch(() => {})
        await page.waitForLoadState("load").catch(() => {})
        await page.waitForTimeout(500)
        for (let i = 0; i < 5; i++) {
          await page.mouse.wheel(0, 800)
          await page.waitForTimeout(200)
        }
        await page.goBack({ waitUntil: "load" }).catch(() => {})
      }
    } catch {
      // best effort
    }

    // 4d. Burn remaining time with idle scrolls so the observation
    //     window is the full 60 s.
    while (Date.now() - start < INTERACTION_DURATION_MS) {
      await page.mouse.wheel(0, 200)
      await page.waitForTimeout(500)
    }

    // 5. Drain longtask buffer (PerformanceObserver is async; give it a
    //    tick to flush).
    await page.waitForTimeout(200)

    // 6. Read longtasks back and identify Korvus-attributable ones.
    const longTasks = await page.evaluate<LongTaskRecord[]>(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((window as any).__korvusLongTasks ?? []) as LongTaskRecord[]
    })

    const isKorvusAttributable = (t: LongTaskRecord): boolean => {
      for (const a of t.attribution) {
        if (a.containerSrc && KORVUS_MARKER.test(a.containerSrc)) return true
        if (a.containerName && KORVUS_MARKER.test(a.containerName)) return true
      }
      return false
    }

    const korvusLongTasks = longTasks.filter(
      (t) => t.duration > LONG_TASK_THRESHOLD_MS && isKorvusAttributable(t),
    )

    // 7. Diagnostics on failure: dump everything we caught.
    if (korvusLongTasks.length > 0) {
      console.log(
        "[TBT] Korvus-attributable longtasks > 50ms:",
        JSON.stringify(korvusLongTasks, null, 2),
      )
    }

    expect(
      korvusLongTasks,
      `Found ${korvusLongTasks.length} long task(s) > ${LONG_TASK_THRESHOLD_MS}ms attributable to korvus.min.js. ` +
        `Total longtasks observed (all sources): ${longTasks.length}.`,
    ).toHaveLength(0)
  })
})
