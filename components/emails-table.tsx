"use client"

import { FileTextIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import type { MessageStatus } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function EmailsTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card">
      <Table>{children}</Table>
    </div>
  )
}

export function EmailsTableHeader({ children }: { children: React.ReactNode }) {
  return (
    <TableHeader>
      <TableRow className="border-b hover:bg-transparent">{children}</TableRow>
    </TableHeader>
  )
}

export function EmailsTableHead({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <TableHead className={`h-12 px-4 font-medium ${className ?? ""}`}>
      {children}
    </TableHead>
  )
}

export function EmailsTableBody({ children }: { children: React.ReactNode }) {
  return <TableBody>{children}</TableBody>
}

export function EmailsTableRow({ children }: { children: React.ReactNode }) {
  return (
    <TableRow className="hover:bg-muted/50">{children}</TableRow>
  )
}

export function EmailsTableCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <TableCell className={`h-16 px-4 ${className ?? ""}`}>{children}</TableCell>
  )
}

export function MessageStatusBadge({ status }: { status: MessageStatus }) {
  switch (status) {
    case "draft":
      return (
        <Badge
          variant="outline"
          className="border-0 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
        >
          {status}
        </Badge>
      )
    case "queued":
    case "sent":
      return (
        <Badge
          variant="outline"
          className="border-0 bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
        >
          {status}
        </Badge>
      )
    case "delivered":
    case "received":
      return (
        <Badge
          variant="outline"
          className="border-0 bg-green-500/15 text-green-700 hover:bg-green-500/25 dark:bg-green-500/10 dark:text-green-400 dark:hover:bg-green-500/20"
        >
          {status}
        </Badge>
      )
    case "failed":
      return (
        <Badge
          variant="outline"
          className="border-0 bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
        >
          {status}
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export function ViewEmailAction({ href }: { href: string }) {
  const t = useTranslations("mail")

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8" asChild>
          <Link href={href} aria-label={t("viewDetails")}>
            <FileTextIcon className="size-4" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("viewDetails")}</TooltipContent>
    </Tooltip>
  )
}
