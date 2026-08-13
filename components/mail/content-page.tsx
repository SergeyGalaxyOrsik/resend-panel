import type { ReactNode } from "react"

/**
 * The frame every non-mail screen sits in. The mail list owns its own scroll and
 * runs full-bleed, so the padding lives here instead of in the shell.
 */
export function ContentPage({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 md:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          {description ? (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6 md:py-6">{children}</div>
      </div>
    </div>
  )
}
