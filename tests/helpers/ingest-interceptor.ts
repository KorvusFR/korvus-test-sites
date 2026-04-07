import type { Page, Route } from "@playwright/test"

// --- Types mirrored from platform/snippet/src/types.ts (decoupled from snippet build) ---

export interface SessionPayload {
  id: string
  website_id: string
  consent_status: "granted" | "denied" | "unknown"
  referrer_domain: string | null
  connection_type: string | null
  landing_url: string | null
  landing_page_type: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  is_paid_traffic: boolean
  has_fbclid: boolean
  has_gclid: boolean
  has_ttclid: boolean
}

export interface PageviewPayload {
  id: string
  website_id: string
  session_id: string
  page_url: string
  page_type?: string | null
  ttfb_ms?: number | null
  fcp_ms?: number | null
  lcp_ms?: number | null
  lcp_element?: Record<string, unknown> | null
  inp_ms?: number | null
  inp_element?: Record<string, unknown> | null
  cls_score?: number | null
  cls_largest_shift?: Record<string, unknown> | null
  resource_timings?: Record<string, unknown>[] | null
  scripts_hash?: string | null
}

export interface EventPayload {
  session_id: string
  pageview_id: string
  website_id: string
  event_name: string
  value?: number | null
  currency?: string | null
  payload: Record<string, unknown>
}

export interface BatchPayload {
  session: SessionPayload
  pageviews: PageviewPayload[]
  events: EventPayload[]
}

// --- Interceptor ---

type BatchResolver = (batch: BatchPayload) => void

/**
 * Intercepts POST requests to /api/ingest via Playwright route interception.
 * Stores each batch payload for later assertion.
 *
 * Usage:
 *   const interceptor = new IngestInterceptor(page)
 *   await interceptor.attach()
 *   // ... navigate, trigger actions ...
 *   await interceptor.triggerFlush()
 *   const events = interceptor.getEvents("js_error")
 */
export class IngestInterceptor {
  private batches: BatchPayload[] = []
  private pendingResolvers: BatchResolver[] = []
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** Attach route interception — call before navigating. */
  async attach(): Promise<void> {
    await this.page.route("**/api/ingest", async (route: Route) => {
      const request = route.request()

      if (request.method() !== "POST") {
        await route.fallback()
        return
      }

      try {
        const body = request.postDataJSON() as BatchPayload
        this.batches.push(body)

        // Resolve any pending waitForBatch promises
        const resolvers = this.pendingResolvers.splice(0)
        for (const resolve of resolvers) {
          resolve(body)
        }
      } catch {
        // Non-JSON or malformed body — still respond 200
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "{}",
      })
    })
  }

  /** Return all events across all batches, optionally filtered by event_name. */
  getEvents(eventName?: string): EventPayload[] {
    const all = this.batches.flatMap((b) => b.events)
    if (eventName === undefined) return all
    return all.filter((e) => e.event_name === eventName)
  }

  /** Return the session payload from the first batch received. */
  getSession(): SessionPayload | undefined {
    return this.batches[0]?.session
  }

  /** Return all pageviews across all batches. */
  getPageviews(): PageviewPayload[] {
    return this.batches.flatMap((b) => b.pageviews)
  }

  /** Return all raw batches for advanced assertions. */
  getAllBatches(): BatchPayload[] {
    return [...this.batches]
  }

  /** Return the number of batches received so far. */
  getBatchCount(): number {
    return this.batches.length
  }

  /** Wait for the next batch to arrive. Rejects on timeout. */
  waitForBatch(timeout = 35_000): Promise<BatchPayload> {
    return new Promise<BatchPayload>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.pendingResolvers.indexOf(wrappedResolve)
        if (idx !== -1) this.pendingResolvers.splice(idx, 1)
        reject(new Error(`waitForBatch: no batch received within ${timeout}ms`))
      }, timeout)

      const wrappedResolve: BatchResolver = (batch) => {
        clearTimeout(timer)
        resolve(batch)
      }

      this.pendingResolvers.push(wrappedResolve)
    })
  }

  /**
   * Wait until an event with the given name appears in any batch.
   * Checks existing batches first, then waits for new ones.
   */
  async waitForEvent(
    eventName: string,
    timeout = 35_000,
  ): Promise<EventPayload> {
    // Check existing batches
    const existing = this.getEvents(eventName)
    if (existing.length > 0) return existing[0]

    // Poll new batches until found or timeout
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const remaining = deadline - Date.now()
      if (remaining <= 0) break

      try {
        const batch = await this.waitForBatch(remaining)
        const match = batch.events.find((e) => e.event_name === eventName)
        if (match) return match
      } catch {
        break // timeout from waitForBatch
      }
    }

    throw new Error(
      `waitForEvent: event "${eventName}" not found within ${timeout}ms`,
    )
  }

  /**
   * Force the snippet to flush its buffer by simulating visibilitychange → hidden.
   * This avoids waiting the full 30s batch interval.
   * Restores visible state afterward.
   */
  async triggerFlush(): Promise<void> {
    await this.page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event("visibilitychange"))
    })

    // Wait for the intercepted fetch to complete (quasi-instant locally)
    await this.waitForBatch(5_000).catch(() => {
      // No batch means buffer was empty — that's fine
    })

    // Restore visible state so the snippet resumes normal operation
    await this.page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
        configurable: true,
      })
    })
  }

  /** Reset all stored batches and pending resolvers. */
  clear(): void {
    this.batches = []
    this.pendingResolvers = []
  }
}
