"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { LOCALE_COOKIE } from "@/i18n/request"
import { type Locale, locales } from "@/i18n/routing"

export async function setLocaleAction(locale: Locale) {
  if (!locales.includes(locale)) {
    return
  }

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })

  revalidatePath("/", "layout")
}
