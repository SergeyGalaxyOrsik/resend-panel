"use client"

import { useTransition } from "react"
import { useLocale } from "next-intl"
import { LanguagesIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { localeLabels, locales, type Locale } from "@/i18n/routing"
import { setLocaleAction } from "@/app/locale-actions"
import { useTranslations } from "next-intl"

export function LanguageSwitcher() {
  const locale = useLocale() as Locale
  const t = useTranslations("language")
  const [pending, startTransition] = useTransition()

  function onChange(nextLocale: string) {
    startTransition(async () => {
      await setLocaleAction(nextLocale as Locale)
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" disabled={pending} aria-label={t("label")}>
          <LanguagesIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={onChange}>
          {locales.map((item) => (
            <DropdownMenuRadioItem key={item} value={item}>
              {localeLabels[item]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
