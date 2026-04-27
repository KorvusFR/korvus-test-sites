import frLocale from "../locales/fr.json"
import esLocale from "../locales/es.json"
import itLocale from "../locales/it.json"

type LocaleKey = "fr" | "es" | "it"

interface ProductData {
  slug: string
  id: string
  trailing: string | null
  name: string
  price: number
}

interface RoutesData {
  cart: string
  checkout: string
  thanks: string
}

interface LabelsData {
  addToCart: string
  viewCart: string
  checkoutCta: string
  pay: string
  thanksTitle: string
  thanksSubtitle: string
  navHome: string
  navCategory: string
  currency: string
}

export interface LocaleData {
  siteName: string
  currency: string
  category: string
  categoryLabel: string
  product: ProductData
  routes: RoutesData
  labels: LabelsData
}

const LOCALES: Record<LocaleKey, LocaleData> = {
  fr: frLocale as LocaleData,
  es: esLocale as LocaleData,
  it: itLocale as LocaleData,
}

export function useLocale() {
  const config = useRuntimeConfig()
  const localeKey = (config.public.locale as LocaleKey) ?? "fr"
  const data = LOCALES[localeKey] ?? LOCALES.fr

  const productPath = data.product.trailing
    ? `/p/${data.product.slug}/${data.product.id}/${data.product.trailing}`
    : `/p/${data.product.slug}/${data.product.id}`

  const categoryPath = `/c/${data.category}`

  return {
    locale: localeKey,
    data,
    productPath,
    categoryPath,
    routes: data.routes,
    labels: data.labels,
  }
}
