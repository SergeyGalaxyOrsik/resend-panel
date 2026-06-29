"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type SortOrder = "desc" | "asc"

type SortToggleProps = {
  value: SortOrder
  onChange: (value: SortOrder) => void
  className?: string
}

export function SortToggle({ value, onChange, className }: SortToggleProps) {
  const t = useTranslations("mail")

  return (
    <div className={cn("inline-flex rounded-lg border border-border/60 bg-background p-0.5", className)}>
      <Button
        type="button"
        size="sm"
        variant={value === "desc" ? "secondary" : "ghost"}
        className="h-8 rounded-md px-3 text-xs"
        onClick={() => onChange("desc")}
      >
        {t("sortNewest")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "asc" ? "secondary" : "ghost"}
        className="h-8 rounded-md px-3 text-xs"
        onClick={() => onChange("asc")}
      >
        {t("sortOldest")}
      </Button>
    </div>
  )
}
