import { test, expect } from "@playwright/test"
import type { Route } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet } from "../helpers/inject-snippet"

// All tests run on doomcheck (port 3003)

// ---------------------------------------------------------------------------
// Test 19 — Batching
// ---------------------------------------------------------------------------

test.describe("Test 19 — Batching", () => {
  test("no batch before ~30s, batch arrives at 30s timer", async ({
    page,
  }) => {
    test.setTimeout(50_000)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    // Generate a few events (do NOT use triggerFlush)
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) {
        window.dispatchEvent(new ErrorEvent("error", {
          message: `Batch timer error ${i}`,
          filename: "test.js",
          lineno: 1,
          colno: 1,
          error: new Error(`Batch timer error ${i}`),
        }))
      }
    })

    // After 5s, no batch should have been sent yet
    await page.waitForTimeout(5000)
    expect(
      interceptor.getBatchCount(),
      "No batch should be sent before the 30s interval",
    ).toBe(0)

    // Wait for the natural 30s flush (default waitForBatch timeout = 35s)
    const batch = await interceptor.waitForBatch()
    expect(batch, "Batch should arrive at the 30s interval").toBeDefined()
    expect(batch.events.length).toBeGreaterThan(0)
  })

  test("visibilitychange flush sends batch immediately", async ({ page }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    // Generate events
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) {
        window.dispatchEvent(new ErrorEvent("error", {
          message: `Visibility flush error ${i}`,
          filename: "test.js",
          lineno: 1,
          colno: 1,
          error: new Error(`Visibility flush error ${i}`),
        }))
      }
    })

    // Trigger flush via visibilitychange (simulated by triggerFlush)
    await interceptor.triggerFlush()

    // Batch should have arrived immediately
    expect(interceptor.getBatchCount()).toBeGreaterThan(0)
    const events = interceptor.getEvents("js_error")
    const ours = events.filter((e) =>
      (e.payload.message as string).startsWith("Visibility flush error"),
    )
    expect(ours.length).toBeGreaterThanOrEqual(3)
  })

  // Phase 7 C1 — pagehide flush sends batch immediately.
  // Couvre les cas que visibilitychange ne couvre pas de façon fiable :
  // Safari iOS swipe-back, WKWebView, bfcache entry, tab close.
  // visibilitychange reste en place pour le cas tab-switch où pagehide ne
  // fire pas — ce test valide que pagehide AJOUTE une couverture sans
  // remplacer.
  test("pagehide flush sends batch immediately (Phase 7 C1)", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    // Generate events — ne pas trigger visibilitychange, on veut PROUVER
    // que pagehide seul est suffisant pour flush.
    await page.evaluate(() => {
      for (let i = 0; i < 3; i++) {
        window.dispatchEvent(new ErrorEvent("error", {
          message: `Pagehide flush error ${i}`,
          filename: "test.js",
          lineno: 1,
          colno: 1,
          error: new Error(`Pagehide flush error ${i}`),
        }))
      }
    })

    // Fire pagehide sans toucher à visibilityState. Safari iOS fait ça lors
    // d'un swipe-back : la page part en bfcache, pagehide fire, la visibility
    // peut encore être "visible" à cet instant.
    await page.evaluate(() => {
      const evt = new Event("pagehide")
      window.dispatchEvent(evt)
    })

    // Petit tick pour laisser fetch keepalive partir et l'interceptor recevoir.
    await page.waitForTimeout(300)

    // Batch should have arrived via pagehide handler.
    expect(
      interceptor.getBatchCount(),
      "pagehide listener should flush the buffer like visibilitychange",
    ).toBeGreaterThan(0)
    const events = interceptor.getEvents("js_error")
    const ours = events.filter((e) =>
      (e.payload.message as string).startsWith("Pagehide flush error"),
    )
    expect(
      ours.length,
      "all 3 events dispatched before pagehide should be in the flushed batch",
    ).toBeGreaterThanOrEqual(3)
  })

  // Phase 7 C1 — idempotence : si visibilitychange ET pagehide firent tous
  // les deux (cas fréquent : tab close → les deux events firent), le 2e
  // handler trouve un buffer vide et no-op. Pas de double envoi, pas de
  // crash.
  test("visibilitychange + pagehide firing together is idempotent", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent("error", {
        message: "Double-flush error",
        filename: "test.js",
        lineno: 1,
        colno: 1,
        error: new Error("Double-flush error"),
      }))
    })

    // Fire les deux events dans la même tick, comme le navigateur le ferait
    // sur un tab close ou une navigation.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event("visibilitychange"))
      window.dispatchEvent(new Event("pagehide"))
    })

    await page.waitForTimeout(300)

    // Exactement 1 batch. Si le 2e handler tentait un send sur un buffer
    // non-vide, on aurait 2 batches avec le même contenu.
    expect(
      interceptor.getBatchCount(),
      "double flush (visibilitychange + pagehide) should produce 1 batch, not 2",
    ).toBe(1)
    const events = interceptor.getEvents("js_error")
    const ours = events.filter(
      (e) => e.payload.message === "Double-flush error",
    )
    expect(ours.length, "error should appear exactly once").toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Test 20 — Buffer overflow
// ---------------------------------------------------------------------------

test.describe("Test 20 — Buffer overflow", () => {
  test("buffer caps at 100 events, drops oldest", async ({
    page,
    browserName,
  }) => {
    // Firefox : ce test combine `page.route(blocker)` + `page.unroute` +
    // synthetic `ErrorEvent` dispatch. Sous Firefox, l'ordre de tear-down
    // des route handlers Playwright diffère de Chromium/WebKit — après
    // unroute, le batch ne retrouve pas toujours l'interceptor, résultat
    // `events.length === 0` alors que le snippet a bien bufferisé. La
    // logique buffer-cap est couverte au niveau unit dans
    // `tests/unit/snippet/buffer.test.ts` (platform), donc ce spec E2E
    // vaut comme smoke sur Chromium/WebKit où le harness est stable.
    // Audit 2026-04-15 (B6b).
    test.skip(
      browserName === "firefox",
      "Firefox: page.route/unroute teardown race avec synthetic ErrorEvent dispatch — couverture assurée par unit buffer tests",
    )

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    // Block ingest endpoint (never respond — takes priority over interceptor)
    const blocker = async (_route: Route) => {
      /* intentionally never fulfill/abort — request hangs */
    }
    await page.route("**/api/ingest", blocker)

    // Generate 150 distinct errors rapidly (unique dedupKey per error)
    await page.evaluate(() => {
      for (let i = 0; i < 150; i++) {
        window.dispatchEvent(new ErrorEvent("error", {
          message: `Overflow error ${i}`,
          filename: "test.js",
          lineno: i,
          colno: 0,
          error: new Error(`Overflow error ${i}`),
        }))
      }
    })

    // Unblock endpoint (only removes our blocker, interceptor handler remains)
    await page.unroute("**/api/ingest", blocker)

    // Flush — now the interceptor receives the batch
    await interceptor.triggerFlush()

    const events = interceptor.getEvents()
    expect(
      events.length,
      "Buffer should cap at 100 events max",
    ).toBeLessThanOrEqual(100)
    expect(events.length).toBeGreaterThan(0)

    // Oldest events should have been dropped
    const hasFirst = events.some(
      (e) => e.payload.message === "Overflow error 0",
    )
    expect(hasFirst, "Oldest event (0) should be dropped").toBe(false)

    // Newest events should be present
    const hasLast = events.some(
      (e) => e.payload.message === "Overflow error 149",
    )
    expect(hasLast, "Newest event (149) should be present").toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 21 — Inactivité (idle detection after 30 min)
// ---------------------------------------------------------------------------

test.describe("Test 21 — Inactivité", () => {
  // This test requires 31+ minutes — too long for CI.
  // Run manually: npx playwright test --project=doomcheck batching.spec.ts -g "Inactivité"
  test.skip("stops collection after 30 min idle, resumes on interaction", async ({
    page,
  }) => {
    test.setTimeout(35 * 60 * 1000)

    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()
    await injectSnippet(page, "doomcheck")

    await page.goto("/")
    await page.waitForTimeout(500)

    // Wait 31 minutes without any interaction
    interceptor.clear()
    await page.waitForTimeout(31 * 60 * 1000)

    // After idle timeout, no new events should be sent
    // (the 30s flush timer is stopped by idle detection)
    expect(
      interceptor.getBatchCount(),
      "No batches should be sent during idle period",
    ).toBe(0)

    // Simulate interaction to resume
    await page.mouse.move(100, 100)
    await page.waitForTimeout(2000)

    // Generate an event after resume
    await page.evaluate(() => {
      window.dispatchEvent(new ErrorEvent("error", {
        message: "Post-idle error",
        filename: "test.js",
        lineno: 1,
        colno: 1,
        error: new Error("Post-idle error"),
      }))
    })

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("js_error")
    expect(
      events.some((e) => e.payload.message === "Post-idle error"),
      "Collection should resume after interaction",
    ).toBe(true)
  })
})
