import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type StatCardProps = {
  label: string
  value: string | number
  description?: string
}

export function StatCards({ stats }: { stats: StatCardProps[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/80 bg-white/90">
          <CardHeader>
            <CardDescription>{stat.label}</CardDescription>
            <CardTitle className="text-3xl">{stat.value}</CardTitle>
          </CardHeader>
          {stat.description ? <CardContent className="pt-0 text-sm text-muted-foreground">{stat.description}</CardContent> : null}
        </Card>
      ))}
    </div>
  )
}

