import { test, expect } from "@playwright/test"
import { IngestInterceptor } from "../helpers/ingest-interceptor"
import { injectSnippet } from "../helpers/inject-snippet"

// All tests run on doomcheck (port 3003) — neutral chaos lab fixture.
//
// Wave 1 - early error capture (Lot E in plan
// `.claude/plans/en-plan-mode-contexte-reactive-blanket.md`).
//
// Validates the early collector that attaches `error` + `unhandledrejection`
// listeners BEFORE the main snippet boot (window.load + setTimeout(0)). The
// drainEarlyBuffer hook in collectors/js-error.ts replays buffered entries
// to the bus with two new payload fields:
//   - pre_load_origin: "same" | "cross" | null
//   - pre_boot_window_ms: number | null  (clamped [0, 60000])
//
// Pre-boot timing strategy:
//   `injectSnippet()` registers two addInitScripts (config + snippet code).
//   The snippet IIFE runs synchronously at script eval, calls
//   installEarlyErrorCapture() which attaches the listeners, then schedules
//   the boot via setTimeout(0). Any error fired AFTER snippet eval but
//   BEFORE drainEarlyBuffer runs at boot is captured.
//
// Cross-engine reliability:
//   On Chromium / Firefox / Mobile Chrome, `setTimeout(() => throw)` in an
//   init script context propagates the uncaught exception to window 'error'
//   listeners. On WebKit / Mobile Safari, that propagation is unreliable
//   in init script context — a setTimeout-thrown error sometimes fails to
//   reach window listeners installed via addInitScript. Same gotcha as the
//   existing errors.spec.ts dedup test which uses dispatchEvent(ErrorEvent)
//   for cross-engine reliability.
//
//   We therefore use a dual trigger: the natural setTimeout-throw AND a
//   `dispatchEvent(new ErrorEvent(...))` with the same logical message. The
//   early collector must observe at least one. This keeps the contract
//   honest (we exercise the real listener path) while staying portable.
//
// We do NOT assert pre_load_origin === "same" strictly: depending on which
// trigger fires (setTimeout-throw vs dispatched ErrorEvent), the source
// filename can be the page URL (same-origin), null, or unset. The spec
// asserts the field is one of the legal tri-state values, plus the
// pre_boot_window_ms invariants.

test.describe("Wave 1 - early error capture", () => {
  test("captures error fired before snippet boot and exposes pre-boot fields", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()

    // Inject snippet first so installEarlyErrorCapture registers the
    // window listeners before our error trigger fires.
    await injectSnippet(page, "doomcheck")

    // Schedule the synthetic error AFTER snippet registration. Because
    // addInitScripts run in registration order, the early-error listeners
    // are guaranteed to be attached by the time the trigger fires.
    //
    // Dual trigger for cross-engine reliability (cf. header comment):
    //   1. setTimeout-throw: natural path, works on Chromium / Firefox.
    //   2. dispatchEvent(ErrorEvent): portable fallback, works on WebKit
    //      where setTimeout-thrown exceptions in init script context do
    //      not reliably propagate to window 'error' listeners.
    // Both carry the same logical message; the assertion below uses
    // includes() so either path satisfies the contract.
    await page.addInitScript(() => {
      const MSG = "pre-load test error in theme"
      // Strategy 1 — natural uncaught throw via setTimeout.
      setTimeout(() => {
        throw new Error(MSG)
      }, 0)
      // Strategy 2 — synchronous dispatch of an ErrorEvent on window.
      // Runs after the snippet IIFE has installed its listeners (init
      // scripts run in registration order, snippet was registered first).
      try {
        window.dispatchEvent(
          new ErrorEvent("error", {
            message: MSG,
            filename: window.location.href,
            lineno: 1,
            colno: 1,
            error: new Error(MSG),
          }),
        )
      } catch {
        // ErrorEvent constructor missing in very old engines — ignore,
        // strategy 1 covers Chromium / Firefox / Mobile Chrome.
      }
    })

    await page.goto("/")
    // Give the snippet time to boot (window.load + setTimeout(0)) and run
    // drainEarlyBuffer. 800ms is a safe margin in dev; the real path is
    // typically <50ms locally.
    await page.waitForLoadState("load")
    await page.waitForTimeout(800)

    await interceptor.triggerFlush()

    const events = interceptor.getEvents("js_error")
    const earlyEvt = events.find(
      (e) =>
        typeof e.payload.message === "string" &&
        e.payload.message.includes("pre-load test error in theme"),
    )

    expect(
      earlyEvt,
      "early-error buffer should drain a js_error matching the synthetic message",
    ).toBeDefined()

    // pre_load_origin tri-state. May be null when the source filename is
    // absent (synthetic error from anonymous setTimeout), "same" when the
    // browser attributes the page origin, "cross" if a CSP-opaque source
    // sneaks in (not expected here but accepted by the contract).
    const preLoadOrigin = earlyEvt!.payload.pre_load_origin
    expect(
      preLoadOrigin === "same" ||
        preLoadOrigin === "cross" ||
        preLoadOrigin === null,
      `pre_load_origin should be "same" | "cross" | null, got ${JSON.stringify(preLoadOrigin)}`,
    ).toBe(true)

    // pre_boot_window_ms: number in [0, 60000] or null (no nav timing API).
    const preBoot = earlyEvt!.payload.pre_boot_window_ms
    expect(
      typeof preBoot === "number" || preBoot === null,
      `pre_boot_window_ms should be number | null, got ${typeof preBoot}`,
    ).toBe(true)
    if (typeof preBoot === "number") {
      expect(preBoot).toBeGreaterThanOrEqual(0)
      expect(preBoot).toBeLessThanOrEqual(60_000)
    }

    // Sanity: drain detached the early listeners. After drain, the buffer
    // is set to null (sentinel) — proves the early collector actually ran.
    const earlyBufferState = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__korvusEarlyBuffer
    })
    expect(earlyBufferState).toBeNull()
  })

  test("coexists with a Sentry-like third-party listener attached before Korvus", async ({
    page,
  }) => {
    const interceptor = new IngestInterceptor(page)
    await interceptor.attach()

    // Sentry-like stub: attaches a window 'error' listener BEFORE Korvus.
    // Stub MUST NOT call stopImmediatePropagation / stopPropagation so both
    // listeners observe the event. Korvus deliberately stays observer-only
    // (snippet-instrumentation.md: never stopPropagate in observer
    // listeners) so coexistence is symmetric.
    //
    // Registered FIRST (= runs first in init script order), then snippet
    // injection, then the synthetic error trigger. Both listeners end up on
    // window 'error' bubble; the browser dispatches to all of them.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any
      let sentryStubCalls = 0
      w.addEventListener("error", () => {
        sentryStubCalls += 1
      })
      w.__sentry_stub_calls = (): number => sentryStubCalls
    })

    await injectSnippet(page, "doomcheck")

    // Dual trigger (cf. first test for the why).
    await page.addInitScript(() => {
      const MSG = "error visible to both Korvus and Sentry stub"
      setTimeout(() => {
        throw new Error(MSG)
      }, 0)
      try {
        window.dispatchEvent(
          new ErrorEvent("error", {
            message: MSG,
            filename: window.location.href,
            lineno: 1,
            colno: 1,
            error: new Error(MSG),
          }),
        )
      } catch {
        // Ignore - other strategy covers it.
      }
    })

    await page.goto("/")
    await page.waitForLoadState("load")
    await page.waitForTimeout(800)

    await interceptor.triggerFlush()

    // Sentry stub saw the error.
    const sentryCalled = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__sentry_stub_calls()
    })
    expect(
      sentryCalled,
      "Sentry-like third-party listener should observe the pre-boot error",
    ).toBeGreaterThanOrEqual(1)

    // Korvus saw the error too (drained from early buffer).
    const events = interceptor.getEvents("js_error")
    const evt = events.find(
      (e) =>
        typeof e.payload.message === "string" &&
        e.payload.message.includes(
          "error visible to both Korvus and Sentry stub",
        ),
    )
    expect(
      evt,
      "Korvus should drain the early error even when a third-party listener is present",
    ).toBeDefined()
  })
})
