/**
 * Traffic runner — launches N browser sessions in parallel with realistic
 * user behaviour across all configured sites.
 *
 * Usage:
 *   npx ts-node runner.ts                        # run with defaults
 *   npx ts-node runner.ts --dry-run              # list sessions without executing
 *   npx ts-node runner.ts --site doomcheck       # target one site only
 *   npx ts-node runner.ts --sessions 50          # override session count
 *   npx ts-node runner.ts --concurrency 5        # override parallelism
 */

import { chromium } from "playwright";
import {
  sites,
  defaultRunnerConfig,
  type SiteConfig,
  type UtmSet,
} from "./config";
import { runBrowse } from "./scenarios/browse";
import { runAddToCart } from "./scenarios/add_to_cart";
import { runBounce } from "./scenarios/bounce";
import { runPurchase } from "./scenarios/purchase";
import { randomItem, pickScenario, log } from "./utils";

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  dryRun: boolean;
  siteFilter?: string;
  sessions?: number;
  concurrency?: number;
} {
  const args = process.argv.slice(2);
  let dryRun = false;
  let siteFilter: string | undefined;
  let sessions: number | undefined;
  let concurrency: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") dryRun = true;
    if (args[i] === "--site" && args[i + 1]) siteFilter = args[++i];
    if (args[i] === "--sessions" && args[i + 1]) sessions = parseInt(args[++i], 10);
    if (args[i] === "--concurrency" && args[i + 1]) concurrency = parseInt(args[++i], 10);
  }

  return { dryRun, siteFilter, sessions, concurrency };
}

// ---------------------------------------------------------------------------
// Session descriptor
// ---------------------------------------------------------------------------

interface SessionPlan {
  id: number;
  site: SiteConfig;
  scenario: "purchase" | "add_to_cart" | "browse" | "bounce";
  utmParams: Record<string, string>;
}

function buildUtmParams(utm: UtmSet): Record<string, string> {
  const params: Record<string, string> = {
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
  };
  if (utm.utm_content) params["utm_content"] = utm.utm_content;
  return params;
}

function planSessions(
  targetSites: SiteConfig[],
  total: number,
  distribution: typeof defaultRunnerConfig.distribution,
  utmCampaigns: UtmSet[]
): SessionPlan[] {
  const plans: SessionPlan[] = [];
  for (let i = 0; i < total; i++) {
    const site = randomItem(targetSites);
    const scenario = pickScenario(distribution);
    const utm = randomItem(utmCampaigns);
    plans.push({
      id: i + 1,
      site,
      scenario,
      utmParams: buildUtmParams(utm),
    });
  }
  return plans;
}

// ---------------------------------------------------------------------------
// Session executor
// ---------------------------------------------------------------------------

async function runSession(plan: SessionPlan, dry: boolean): Promise<void> {
  const label = `[session-${String(plan.id).padStart(3, "0")}]`;

  if (dry) {
    log(
      label,
      `DRY-RUN  site=${plan.site.name}  scenario=${plan.scenario}  utm_source=${plan.utmParams.utm_source}`
    );
    return;
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
  ];

  const context = await browser.newContext({
    userAgent: randomItem(userAgents),
    viewport: { width: 1280 + Math.floor(Math.random() * 400), height: 800 },
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
  });

  const page = await context.newPage();

  try {
    log(
      label,
      `START  site=${plan.site.name}  scenario=${plan.scenario}  utm_source=${plan.utmParams.utm_source}`
    );

    switch (plan.scenario) {
      case "browse":
        await runBrowse(page, plan.site, plan.utmParams, dry);
        break;
      case "add_to_cart":
        await runAddToCart(page, plan.site, plan.utmParams, dry);
        break;
      case "purchase":
        await runPurchase(page, plan.site, plan.utmParams, dry);
        break;
      case "bounce":
        await runBounce(page, plan.site, plan.utmParams, dry);
        break;
    }

    log(label, `DONE  site=${plan.site.name}  scenario=${plan.scenario}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(label, `ERROR  ${msg}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Concurrency limiter
// ---------------------------------------------------------------------------

async function runWithConcurrency(
  plans: SessionPlan[],
  concurrency: number,
  dry: boolean
): Promise<void> {
  const queue = [...plans];
  const workers: Promise<void>[] = [];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const plan = queue.shift();
      if (!plan) break;
      await runSession(plan, dry);
    }
  }

  for (let i = 0; i < Math.min(concurrency, plans.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dryRun, siteFilter, sessions, concurrency } = parseArgs();

  const config = {
    ...defaultRunnerConfig,
    ...(sessions !== undefined ? { totalSessions: sessions } : {}),
    ...(concurrency !== undefined ? { concurrency } : {}),
  };

  const targetSites = siteFilter
    ? sites.filter((s) => s.name === siteFilter)
    : sites;

  if (targetSites.length === 0) {
    console.error(`No sites matched filter "${siteFilter ?? ""}"`);
    process.exit(1);
  }

  const plans = planSessions(
    targetSites,
    config.totalSessions,
    config.distribution,
    config.utmCampaigns
  );

  console.log(
    `\n── Korvus Traffic Runner ──────────────────────────────────────────`
  );
  console.log(`   sites       : ${targetSites.map((s) => s.name).join(", ")}`);
  console.log(`   sessions    : ${config.totalSessions}`);
  console.log(`   concurrency : ${config.concurrency}`);
  console.log(
    `   distribution: purchase=${config.distribution.purchase * 100}% add_to_cart=${config.distribution.add_to_cart * 100}% browse=${config.distribution.browse * 100}% bounce=${config.distribution.bounce * 100}%`
  );
  console.log(`   dry-run     : ${dryRun}`);
  console.log(
    `─────────────────────────────────────────────────────────────────\n`
  );

  if (dryRun) {
    plans.forEach((p) => {
      console.log(
        `  [${String(p.id).padStart(3, "0")}] site=${p.site.name.padEnd(18)} scenario=${p.scenario.padEnd(12)} utm_source=${p.utmParams.utm_source}`
      );
    });
    console.log(`\nTotal: ${plans.length} sessions planned. (dry-run, nothing executed)\n`);
    return;
  }

  await runWithConcurrency(plans, config.concurrency, false);

  console.log(`\nAll ${plans.length} sessions completed.\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
