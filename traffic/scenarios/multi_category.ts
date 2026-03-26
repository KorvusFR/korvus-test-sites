import type { Page } from "playwright";
import type { SiteConfig } from "../config";
import { randomDelay, randomItem, buildUrl, scrollPage, log, safeClick } from "../utils";

/**
 * Multi category scenario: visits 3 categories, adds 1-2 products per category, then abandons on cart.
 */
export async function runMultiCategory(
  page: Page,
  site: SiteConfig,
  utmParams: Record<string, string>,
  dry = false
): Promise<void> {
  const label = `[multi_category][${site.name}]`;

  if (site.categoryPaths.length === 0) return;
  if (dry) return;

  const cats = [...site.categoryPaths].sort(() => 0.5 - Math.random()).slice(0, 3);
  
  for (const cat of cats) {
    const catUrl = buildUrl(`${site.baseUrl}${cat}`, utmParams);
    log(label, `category → ${catUrl}`);
    await page.goto(catUrl, { waitUntil: "domcontentloaded" });
    await scrollPage(page);
    await randomDelay(1500, 3000);

    const productCount = 1 + Math.floor(Math.random() * 2);
    for (let c = 0; c < productCount; c++) {
      const cards = await page.locator("a[href*='/products/']").all();
      if (cards.length === 0) break;

      const card = randomItem(cards);
      const href = await card.getAttribute("href");
      if (!href) continue;

      const productUrl = buildUrl(site.baseUrl + href, utmParams);
      await page.goto(productUrl, { waitUntil: "domcontentloaded" });
      await scrollPage(page);
      
      const atcBtn = page.locator("button").filter({ hasText: /(add to cart|ajouter au panier)/i }).first();
      if (await atcBtn.isVisible().catch(() => false)) {
        log(label, "adding to cart");
        await safeClick(page, atcBtn);
        await randomDelay(800, 1500);
      }
    }
  }

  log(label, "navigate → cart");
  await page.goto(`${site.baseUrl}/cart`, { waitUntil: "domcontentloaded" });
  await scrollPage(page);
  await randomDelay(2000, 4000);

  log(label, "abandoning cart with multiple items");
}
