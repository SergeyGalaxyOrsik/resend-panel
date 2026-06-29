import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type EmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  href?: string
}

export function EmptyState({ title, description, actionLabel, href }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-border/70 bg-white/80">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {actionLabel && href ? (
        <CardContent>
          <Link href={href}>
            <Button className="rounded-xl">{actionLabel}</Button>
          </Link>
        </CardContent>
      ) : null}
    </Card>
  )
}

