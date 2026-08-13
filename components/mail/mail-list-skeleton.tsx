import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the real row rhythm, so the list does not jump when data lands. */
export function MailListSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Skeleton className="size-4 rounded-[4px]" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="min-h-0 flex-1 divide-y divide-border bg-mail-read">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="flex h-11 items-center gap-4 px-3">
            <Skeleton className="size-4 shrink-0 rounded-[4px]" />
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-3.5 w-40 shrink-0" />
            <Skeleton className="h-3.5 min-w-0 flex-1" />
            <Skeleton className="h-3 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
