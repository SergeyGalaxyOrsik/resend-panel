"use client"

import { Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type MailSearchInputProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function MailSearchInput({ value, onChange, className }: MailSearchInputProps) {
  const t = useTranslations("mail")

  return (
    <div className={cn("relative min-w-0 flex-1 sm:max-w-sm", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("searchPlaceholder")}
        className="pl-8"
      />
    </div>
  )
}
