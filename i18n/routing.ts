import { defineRouting } from "next-intl/routing"

export const locales = ["en", "ru", "zh"] as const
export type Locale = (typeof locales)[number]

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "never",
})

export const localeLabels: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  zh: "中文",
}
