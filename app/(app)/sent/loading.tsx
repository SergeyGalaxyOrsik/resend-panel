import { Skeleton } from "@/components/ui/skeleton"

export default function SentLoading() {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[360px_1fr]">
      <div className="flex flex-col border-border/60 md:border-r">
        <div className="space-y-3 border-b border-border/60 px-4 py-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-full" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex gap-3 border-b border-border/40 px-4 py-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden flex-col gap-4 p-6 md:flex">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}
