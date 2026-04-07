import type { Page } from "playwright";
import type { SiteConfig } from "../config";
import { randomDelay, randomItem, buildUrl, scrollPage, log, handleCookieBanner } from "../utils";

/**
 * Browse scenario: visits catalog + 1–3 product pages, no cart action.
 */
export async function runBrowse(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[browse][${site.name}]`;

  const catalogUrl = buildUrl(site.baseUrl + "/catalog", utmParams);
  log(label, `navigate → ${catalogUrl}`);
  if (dry) return;

  await page.goto(catalogUrl, { waitUntil: "domcontentloaded" });
  if (site.name === "taguardian-com") {
    await handleCookieBanner(page);
  }
  await scrollPage(page);
  await randomDelay(800, 2000);

  // Visit a category
  if (site.categoryPaths.length > 0) {
    const catPath = randomItem(site.categoryPaths);
    const catUrl = buildUrl(site.baseUrl + catPath, utmParams);
    log(label, `category → ${catUrl}`);
    await page.goto(catUrl, { waitUntil: "domcontentloaded" });
    await scrollPage(page);
    await randomDelay(1000, 3000);
  }

  // Click on 1–3 product cards
  const productCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < productCount; i++) {
    const cards = await page.locator("a[href*='/products/']").all();
    if (cards.length === 0) break;

    const card = randomItem(cards);
    const href = await card.getAttribute("href");
    if (!href) continue;

    const productUrl = buildUrl(site.baseUrl + href, utmParams);
    log(label, `product → ${productUrl}`);
    await page.goto(productUrl, { waitUntil: "domcontentloaded" });
    await scrollPage(page);
    await randomDelay(1500, 4000);
  }

  log(label, "done");
}
