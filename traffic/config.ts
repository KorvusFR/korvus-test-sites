export interface SiteConfig {
  name: string;
  baseUrl: string;
  cartKey: string;
  hasGtm: boolean;
  productSlugs: string[];
  categoryPaths: string[];
}

export const sites: SiteConfig[] = [
  {
    name: "athletedatahub",
    baseUrl: "https://athletedatahub.com",
    cartKey: "adh_cart",
    hasGtm: false,
    productSlugs: [
      "pro-training-tshirt-black",
      "endurance-shorts-navy",
      "whey-protein-chocolate",
    ],
    categoryPaths: ["/catalog/clothing", "/catalog/equipment", "/catalog/nutrition"],
  },
  {
    name: "taguardian-com",
    baseUrl: "https://taguardian.com",
    cartKey: "taguardian_cart",
    hasGtm: true,
    productSlugs: [
      "crowdstrike-falcon-pro-endpoint",
      "palo-alto-ngfw-pa-220",
      "sentinelone-singularity-complete",
    ],
    categoryPaths: ["/catalog/software", "/catalog/hardware", "/catalog/services"],
  },
  {
    name: "doomcheck",
    baseUrl: "https://doomcheck.me",
    cartKey: "doomcheck_cart",
    hasGtm: false,
    productSlugs: [
      "novapro-x12",
      "deathbass-pro",
      "doompad-elite",
      "voidbook-air-14",
      "deathdrive-2tb",
    ],
    categoryPaths: ["/catalog/phones", "/catalog/audio", "/catalog/gaming"],
  },
  {
    name: "taguardian-fr",
    baseUrl: "https://taguardian.fr",
    cartKey: "taguardian_cart",
    hasGtm: true,
    productSlugs: [],
    categoryPaths: ["/collections/all"],
  },
];

export interface RunnerConfig {
  /** Number of parallel browser sessions */
  concurrency: number;
  /** Total sessions to run */
  totalSessions: number;
  /** Min delay between actions in ms */
  actionDelayMin: number;
  /** Max delay between actions in ms */
  actionDelayMax: number;
  /** Scenario distribution (must sum to 1.0) */
  distribution: {
    purchase: number;
    add_to_cart: number;
    browse: number;
    bounce: number;
    hesitant: number;
    comparison: number;
    checkout_abandon: number;
    multi_category: number;
  };
  /** UTM campaigns to rotate through */
  utmCampaigns: UtmSet[];
}

export interface UtmSet {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
}

export const defaultRunnerConfig: RunnerConfig = {
  concurrency: 3,
  totalSessions: 10,
  actionDelayMin: 1000,
  actionDelayMax: 4000,
  distribution: {
    purchase: 0.15,
    add_to_cart: 0.20,
    browse: 0.20,
    bounce: 0.15,
    hesitant: 0.10,
    comparison: 0.10,
    checkout_abandon: 0.05,
    multi_category: 0.05,
  },
  utmCampaigns: [
    {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "brand-search",
      utm_content: "ad-v1",
    },
    {
      utm_source: "newsletter",
      utm_medium: "email",
      utm_campaign: "weekly-digest",
    },
    {
      utm_source: "twitter",
      utm_medium: "social",
      utm_campaign: "organic-promo",
    },
    {
      utm_source: "direct",
      utm_medium: "(none)",
      utm_campaign: "(direct)",
    },
    {
      utm_source: "linkedin",
      utm_medium: "social",
      utm_campaign: "b2b-awareness",
      utm_content: "carousel-post",
    },
    {
      utm_source: "referral",
      utm_medium: "referral",
      utm_campaign: "partner-blog",
    },
  ],
};
