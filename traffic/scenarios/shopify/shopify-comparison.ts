import type { Page } from "playwright";
import type { SiteConfig } from "../../config";
import {
  buildUrl,
  scrollPage,
  randomDelay,
  randomItem,
  log,
  handleShopifyPassword,
} from "../../utils";

/**
 * Shopify comparison: visits 3–4 product pages from different collections, long scroll on each, exits without buying.
 */
export async function runShopifyComparison(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[shopify-comparison][${site.name}]`;

  const homeUrl = buildUrl(site.baseUrl, utmParams);
  log(label, `navigate → ${homeUrl}`);
  if (dry) return;

  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
  await handleShopifyPassword(page, "rtewng");
  await scrollPage(page);
  await randomDelay(800, 1500);

  const visitedSlugs = new Set<string>();
  const collectionsToVisit = [...site.categoryPaths];
  const targetCount = 3 + Math.floor(Math.random() * 2); // 3 or 4

  for (let i = 0; i < targetCount && collectionsToVisit.length > 0; i++) {
    // Pick a collection and remove it from the pool (to diversify)
    const idx = Math.floor(Math.random() * collectionsToVisit.length);
    const catPath = collectionsToVisit.splice(idx, 1)[0];

    const catUrl = buildUrl(site.baseUrl + catPath, utmParams);
    log(label, `collection → ${catUrl}`);
    await page.goto(catUrl, { waitUntil: "domcontentloaded" });
    await scrollPage(page);
    await randomDelay(800, 1500);

    // Pick a product not yet visited
    const allCards = await page.locator("a[href*='/products/']").all();
    const candidates = await Promise.all(
      allCards.map(async (c) => {
        const href = await c.getAttribute("href");
        return href ?? null;
      })
    );

    const fresh = candidates.filter(
      (h): h is string => h !== null && !visitedSlugs.has(h)
    );
    if (fresh.length === 0) continue;

    const href = randomItem(fresh);
    visitedSlugs.add(href);

    const productUrl = buildUrl(
      href.startsWith("http") ? href : site.baseUrl + href,
      utmParams
    );
    log(label, `product → ${productUrl}`);
    await page.goto(productUrl, { waitUntil: "domcontentloaded" });

    // Long scroll on product page to simulate comparison behaviour
    const scrolls = 4 + Math.floor(Math.random() * 4);
    for (let s = 0; s < scrolls; s++) {
      await page.evaluate(() => window.scrollBy(0, 250 + Math.floor(Math.random() * 300)));
      await randomDelay(400, 1000);
    }
    await randomDelay(2000, 4000);
  }

  log(label, "done — no purchase");
}
