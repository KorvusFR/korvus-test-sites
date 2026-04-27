import frLocale from "./locales/fr.json"
import esLocale from "./locales/es.json"
import itLocale from "./locales/it.json"

type LocaleKey = "fr" | "es" | "it"

const LOCALE_TO_WEBSITE_ID: Record<LocaleKey, string> = {
  fr: "00000000-0000-4000-a000-000000001015",
  es: "00000000-0000-4000-a000-000000001016",
  it: "00000000-0000-4000-a000-000000001017",
}

const TEST_API_KEY =
  "kv_test_0000000000000000000000000000000000000000000000000000000000000001"

const rawLocale = (process.env.NUXT_PUBLIC_LOCALE ?? "fr").toLowerCase()
const LOCALE: LocaleKey = (
  rawLocale === "fr" || rawLocale === "es" || rawLocale === "it"
    ? rawLocale
    : "fr"
) as LocaleKey

const localeData = { fr: frLocale, es: esLocale, it: itLocale }[LOCALE]
const websiteId = LOCALE_TO_WEBSITE_ID[LOCALE]

const korvusInit = `window.__korvus = ${JSON.stringify({
  websiteId,
  apiKey: TEST_API_KEY,
  endpoint: "/api/ingest",
  platform: "custom",
})};`

export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: false },
  compatibilityDate: "2025-04-01",

  runtimeConfig: {
    public: {
      locale: LOCALE,
      websiteId,
      siteName: localeData.siteName,
      currency: localeData.currency,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: LOCALE },
      title: localeData.siteName,
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
      ],
      script: [
        { tagPosition: "head", innerHTML: korvusInit },
        { tagPosition: "head", src: "/api/snippet/korvus.min.js", defer: true },
      ],
    },
  },
})
