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
        window.onerror?.(
          `Batch timer error ${i}`,
          "test.js",
          1,
          1,
          new Error(`Batch timer error ${i}`),
        )
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
        window.onerror?.(
          `Visibility flush error ${i}`,
          "test.js",
          1,
          1,
          new Error(`Visibility flush error ${i}`),
        )
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
})

// ---------------------------------------------------------------------------
// Test 20 — Buffer overflow
// ---------------------------------------------------------------------------

test.describe("Test 20 — Buffer overflow", () => {
  test("buffer caps at 100 events, drops oldest", async ({ page }) => {
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
        window.onerror?.(
          `Overflow error ${i}`,
          "test.js",
          i,
          0,
          new Error(`Overflow error ${i}`),
        )
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
      window.onerror?.(
        "Post-idle error",
        "test.js",
        1,
        1,
        new Error("Post-idle error"),
      )
    })

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("js_error")
    expect(
      events.some((e) => e.payload.message === "Post-idle error"),
      "Collection should resume after interaction",
    ).toBe(true)
  })
})
