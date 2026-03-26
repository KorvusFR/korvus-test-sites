import type { Page } from "playwright";
import type { SiteConfig } from "../config";
import { randomDelay, buildUrl, scrollPage, log } from "../utils";

/**
 * Bounce scenario: arrives on home page, scrolls slightly, leaves immediately.
 */
export async function runBounce(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[bounce][${site.name}]`;

  const homeUrl = buildUrl(site.baseUrl, utmParams);
  log(label, `navigate → ${homeUrl}`);
  if (dry) return;

  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });

  // Minimal scroll — simulates user who immediately loses interest
  await page.evaluate(() => {
    window.scrollBy(0, 150 + Math.floor(Math.random() * 200));
  });

  await randomDelay(800, 2500);
  log(label, "bounce — leaving");
}
