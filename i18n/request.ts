import { cookies } from "next/headers"
import { getRequestConfig } from "next-intl/server"
import { routing, type Locale } from "./routing"

const LOCALE_COOKIE = "NEXT_LOCALE"

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const requested = cookieStore.get(LOCALE_COOKIE)?.value
  const locale =
    requested && routing.locales.includes(requested as Locale) ? requested : routing.defaultLocale

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})

export { LOCALE_COOKIE }
