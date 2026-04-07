import { expect } from "@playwright/test"
import type {
  IngestInterceptor,
  EventPayload,
  SessionPayload,
  PageviewPayload,
} from "./ingest-interceptor"

/**
 * Assert that an event with the given name was captured.
 * Waits for the event via interceptor.waitForEvent (checks existing batches first).
 * Optionally verifies fields in the event payload via toMatchObject.
 */
export async function expectEvent(
  interceptor: IngestInterceptor,
  eventName: string,
  matcher?: Record<string, unknown>,
): Promise<EventPayload> {
  const event = await interceptor.waitForEvent(eventName)
  if (matcher) {
    expect(event.payload).toMatchObject(matcher)
  }
  return event
}

/**
 * Assert that NO event with the given name was captured.
 * Triggers a flush first to ensure any buffered events are sent,
 * then verifies none match.
 */
export async function expectNoEvent(
  interceptor: IngestInterceptor,
  eventName: string,
): Promise<void> {
  await interceptor.triggerFlush()
  const events = interceptor.getEvents(eventName)
  expect(
    events,
    `Expected no "${eventName}" events, but found ${events.length}`,
  ).toHaveLength(0)
}

/**
 * Assert a field value on the session payload.
 * Triggers a flush if no batch has been received yet.
 */
export async function expectSessionField<K extends keyof SessionPayload>(
  interceptor: IngestInterceptor,
  field: K,
  value: SessionPayload[K],
): Promise<void> {
  if (interceptor.getBatchCount() === 0) {
    await interceptor.triggerFlush()
  }
  const session = interceptor.getSession()
  expect(session, "No session received").toBeDefined()
  expect(session![field]).toEqual(value)
}

/**
 * Assert a field value on at least one pageview.
 * Triggers a flush if no batch has been received yet.
 */
export async function expectPageviewField<K extends keyof PageviewPayload>(
  interceptor: IngestInterceptor,
  field: K,
  value: PageviewPayload[K],
): Promise<void> {
  if (interceptor.getBatchCount() === 0) {
    await interceptor.triggerFlush()
  }
  const pageviews = interceptor.getPageviews()
  expect(pageviews.length, "No pageviews received").toBeGreaterThan(0)
  const match = pageviews.some((pv) => {
    try {
      expect(pv[field]).toEqual(value)
      return true
    } catch {
      return false
    }
  })
  expect(
    match,
    `No pageview has ${String(field)} equal to ${JSON.stringify(value)}`,
  ).toBe(true)
}
