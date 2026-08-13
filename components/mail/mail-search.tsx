"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { SearchIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

/**
 * One search box for the whole app instead of a filter per pane. Submitting goes to
 * /search, so a result set is a real URL that can be linked, reloaded and shared.
 */
export function MailSearch() {
  const t = useTranslations("mail")
  const router = useRouter()
  const searchParams = useSearchParams()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const queryFromUrl = searchParams.get("q") ?? ""
  const [value, setValue] = React.useState(queryFromUrl)
  const [syncedQuery, setSyncedQuery] = React.useState(queryFromUrl)

  // Keep the box in step with the URL when navigating between folders and results.
  // Adjusting during render rather than in an effect avoids a frame showing the
  // previous folder's query.
  if (syncedQuery !== queryFromUrl) {
    setSyncedQuery(queryFromUrl)
    setValue(queryFromUrl)
  }

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")

      if (typing) return

      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    const query = value.trim()
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/inbox")
  }

  return (
    <form onSubmit={onSubmit} role="search" className="min-w-0 flex-1 md:max-w-2xl">
      <InputGroup className="bg-muted/60">
        <InputGroupAddon>
          <SearchIcon className="size-4 opacity-60" />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
        />
        {value ? (
          <InputGroupAddon align="inline-end">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("clearSearch")}
              onClick={() => {
                setValue("")
                inputRef.current?.focus()
              }}
            >
              <XIcon />
            </Button>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </form>
  )
}
