import type { Page } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

// --- Config types (subset of KorvusConfig) ---
export interface SnippetConfig {
  websiteId: string
  apiKey: string
  endpoint: string
  errorSelectors?: string[]
  // Bridge Tealium opt-in (avril 2026). Active uniquement dans les specs
  // qui testent le wrap window.utag.link/view (cf. tealium-bridge.spec.ts).
  enableTealiumBridge?: boolean
}

// --- Default configs per test site ---

const SITE_DEFAULTS: Record<string, SnippetConfig> = {
  athletedatahub: {
    websiteId: "00000000-0000-4000-a000-000000001010",
    apiKey: "kv_test_0000000000000000000000000000000000000000000000000000000000000001",
    endpoint: "/api/ingest",
  },
  "taguardian-com": {
    websiteId: "00000000-0000-4000-a000-000000001012",
    apiKey: "kv_test_0000000000000000000000000000000000000000000000000000000000000001",
    endpoint: "/api/ingest",
  },
  doomcheck: {
    websiteId: "00000000-0000-4000-a000-000000001013",
    apiKey: "kv_test_0000000000000000000000000000000000000000000000000000000000000001",
    endpoint: "/api/ingest",
  },
}

// --- Snippet code (read once at module load) ---

const SNIPPET_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "platform",
  "snippet",
  "dist",
  "korvus.min.js",
)

let snippetCode: string | null = null

function getSnippetCode(): string {
  if (snippetCode === null) {
    snippetCode = fs.readFileSync(SNIPPET_PATH, "utf-8")
  }
  return snippetCode
}

// --- Injection ---

/**
 * Inject the Korvus snippet into a Playwright page with controlled config.
 *
 * Execution order:
 * 1. Block the app's native snippet loading (prevents double-init)
 * 2. addInitScript: set window.__korvus with test config
 * 3. addInitScript: evaluate korvus.min.js (reads config synchronously at module eval)
 * 4. Page HTML loads — app's inline window.__korvus is too late, snippet already has config
 *
 * @param page - Playwright page instance
 * @param siteOrConfig - Site name (e.g. "athletedatahub") for defaults, or partial config to merge with defaults
 */
export async function injectSnippet(
  page: Page,
  siteOrConfig?: string | Partial<SnippetConfig>,
): Promise<void> {
  let config: SnippetConfig

  if (typeof siteOrConfig === "string") {
    const defaults = SITE_DEFAULTS[siteOrConfig]
    if (!defaults) {
      throw new Error(
        `Unknown site "${siteOrConfig}". Available: ${Object.keys(SITE_DEFAULTS).join(", ")}`,
      )
    }
    config = { ...defaults }
  } else {
    // Merge with a generic default
    config = {
      websiteId: "00000000-0000-4000-a000-000000000000",
      apiKey: "kv_test_0000000000000000000000000000000000000000000000000000000000000001",
      endpoint: "/api/ingest",
      ...siteOrConfig,
    }
  }

  // Block the app's native snippet to prevent double initialization
  await page.route("**/api/snippet/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "// blocked by test harness",
    }),
  )

  // Set window.__korvus BEFORE the snippet evaluates
  await page.addInitScript((cfg: SnippetConfig) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__korvus = cfg
  }, config)

  // Inject the snippet code — readConfig() runs synchronously at eval time
  const code = getSnippetCode()
  await page.addInitScript(code)
}

/**
 * Get the default config for a known test site.
 * Useful when you need to reference the websiteId or apiKey in assertions.
 */
export function getSiteConfig(site: string): SnippetConfig {
  const defaults = SITE_DEFAULTS[site]
  if (!defaults) {
    throw new Error(
      `Unknown site "${site}". Available: ${Object.keys(SITE_DEFAULTS).join(", ")}`,
    )
  }
  return { ...defaults }
}
