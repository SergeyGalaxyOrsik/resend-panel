import { Card } from "@/components/ui/card"

type StatCardProps = {
  label: string
  value: string | number
  description?: string
}

export function StatCards({ stats }: { stats: StatCardProps[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="rounded-xl p-4">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</p>
          {/* Held whether or not there is a caption, so a row of cards keeps one
              baseline instead of going ragged where a rate is missing. */}
          <p className="mt-1 min-h-4 text-xs text-muted-foreground">{stat.description ?? ""}</p>
        </Card>
      ))}
    </div>
  )
}
