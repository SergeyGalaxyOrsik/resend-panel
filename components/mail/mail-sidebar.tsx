"use client"

import { useTranslations } from "next-intl"
import { Link, usePathname } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import {
  ArchiveIcon,
  AtSignIcon,
  ChartNoAxesColumnIcon,
  FileEditIcon,
  GaugeIcon,
  InboxIcon,
  PencilLineIcon,
  SendIcon,
  Settings2Icon,
  StarIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { isNavActive } from "@/lib/nav"
import type { FolderCounts } from "@/lib/types"

type MailSidebarProps = {
  counts: FolderCounts
  isOwner: boolean
}

export function MailSidebar({ counts, isOwner }: MailSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations("folders")
  const tn = useTranslations("nav")
  const { state, isMobile, setOpenMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile

  // `emphasize` marks the one badge that means "unread" rather than "how many".
  const folders: Array<{
    href: string
    label: string
    icon: typeof InboxIcon
    count: number
    emphasize?: boolean
  }> = [
    { href: "/inbox", label: t("inbox"), icon: InboxIcon, count: counts.inbox, emphasize: true },
    { href: "/starred", label: t("starred"), icon: StarIcon, count: counts.starred },
    { href: "/sent", label: t("sent"), icon: SendIcon, count: 0 },
    { href: "/drafts", label: t("drafts"), icon: FileEditIcon, count: counts.drafts },
    { href: "/archive", label: t("archive"), icon: ArchiveIcon, count: counts.archive },
    { href: "/trash", label: t("trash"), icon: Trash2Icon, count: counts.trash },
  ]

  const insights = [
    { href: "/dashboard", label: tn("dashboard"), icon: GaugeIcon },
    { href: "/statistics", label: tn("statistics"), icon: ChartNoAxesColumnIcon },
  ] as const

  const administration = [
    { href: "/users", label: tn("users"), icon: UsersIcon },
    { href: "/mailboxes", label: tn("mailboxes"), icon: AtSignIcon },
    { href: "/settings", label: tn("settings"), icon: Settings2Icon },
  ] as const

  function closeOnMobile() {
    if (isMobile) setOpenMobile(false)
  }

  /**
   * The reader lives at /thread/[id], so on its own it would light up no folder.
   * `?from=` is what the row linked with, so it is also what stays highlighted.
   */
  function isFolderActive(href: string) {
    if (pathname.startsWith("/thread")) {
      return href === `/${searchParams.get("from") ?? "inbox"}`
    }

    return isNavActive(pathname, href)
  }

  return (
    <Sidebar
      collapsible="icon"
      variant="sidebar"
      // The rail starts under the app bar instead of covering it, so search stays
      // reachable at every width. Inline so it beats the component's own inset-y-0.
      style={{ top: "var(--header-height)", height: "calc(100svh - var(--header-height))" }}
    >
      <SidebarContent className="gap-1">
        <div className="px-2 pt-3 pb-1">
          <Button
            size="lg"
            className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            render={<Link href="/compose" onClick={closeOnMobile} />}
          >
            <PencilLineIcon />
            <span className="group-data-[collapsible=icon]:hidden">{tn("compose")}</span>
          </Button>
        </div>

        <SidebarGroup className="py-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {folders.map((item) => {
                const Icon = item.icon
                const active = isFolderActive(item.href)
                const showCount = item.count > 0

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={showCount ? `${item.label} (${item.count})` : item.label}
                    >
                      <Link href={item.href} onClick={closeOnMobile}>
                        <Icon />
                        <span className={item.emphasize && showCount ? "font-semibold" : undefined}>
                          {item.label}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                    {showCount && !collapsed ? (
                      <SidebarMenuBadge
                        className={item.emphasize ? "font-semibold text-foreground" : undefined}
                      >
                        {item.count}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="py-1">
          <SidebarGroupLabel>{tn("insights")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {insights.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isNavActive(pathname, item.href)}
                      tooltip={item.label}
                    >
                      <Link href={item.href} onClick={closeOnMobile}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Cosmetic only: the routes themselves are gated by requireOwner() on the server. */}
        {isOwner ? (
          <SidebarGroup className="py-1">
            <SidebarGroupLabel>{tn("administration")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {administration.map((item) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isNavActive(pathname, item.href)}
                        tooltip={item.label}
                      >
                        <Link href={item.href} onClick={closeOnMobile}>
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
    </Sidebar>
  )
}
