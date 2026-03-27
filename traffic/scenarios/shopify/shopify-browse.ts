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
 * Shopify browse: home → collection → 1–3 product pages, no cart action.
 */
export async function runShopifyBrowse(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[shopify-browse][${site.name}]`;

  const homeUrl = buildUrl(site.baseUrl, utmParams);
  log(label, `navigate → ${homeUrl}`);
  if (dry) return;

  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
  await handleShopifyPassword(page, "rtewng");
  await scrollPage(page);
  await randomDelay(800, 2000);

  // Visit a collection
  if (site.categoryPaths.length > 0) {
    const catPath = randomItem(site.categoryPaths);
    const catUrl = buildUrl(site.baseUrl + catPath, utmParams);
    log(label, `collection → ${catUrl}`);
    await page.goto(catUrl, { waitUntil: "domcontentloaded" });
    await scrollPage(page);
    await randomDelay(1000, 3000);
  }

  // Click 1–3 product cards
  const productCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < productCount; i++) {
    const cards = await page.locator("a[href*='/products/']").all();
    if (cards.length === 0) break;

    const card = randomItem(cards);
    const href = await card.getAttribute("href");
    if (!href) continue;

    const productUrl = buildUrl(
      href.startsWith("http") ? href : site.baseUrl + href,
      utmParams
    );
    log(label, `product → ${productUrl}`);
    await page.goto(productUrl, { waitUntil: "domcontentloaded" });
    await scrollPage(page);
    await randomDelay(1500, 4000);
  }

  log(label, "done");
}
