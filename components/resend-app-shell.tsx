"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { Link, usePathname } from "@/i18n/navigation"
import {
  ArchiveIcon,
  BarChart3Icon,
  FilePenLineIcon,
  InboxIcon,
  MailIcon,
  SendIcon,
  Settings2Icon,
} from "lucide-react"
import { NavUser } from "@/components/nav-user"
import { LanguageSwitcher } from "@/components/language-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { isNavActive } from "@/lib/nav"
import { cn } from "@/lib/utils"
import type { Thread, User, Workspace } from "@/lib/types"
import type { ReactNode } from "react"

type ResendAppShellProps = {
  children: ReactNode
  user: User
  workspace: Workspace | null
  threads: Thread[]
  logoutAction: () => Promise<void>
}

function AppSidebar({
  user,
  workspace,
  logoutAction,
}: {
  user: User
  workspace: Workspace | null
  logoutAction: () => Promise<void>
}) {
  const pathname = usePathname()
  const t = useTranslations("nav")
  const tc = useTranslations("common")

  const mainNav = [
    { href: "/dashboard" as const, label: t("dashboard"), icon: BarChart3Icon },
    { href: "/inbox" as const, label: t("inbox"), icon: InboxIcon },
    { href: "/sent" as const, label: t("sent"), icon: SendIcon },
    { href: "/compose" as const, label: t("compose"), icon: FilePenLineIcon },
    { href: "/drafts" as const, label: t("drafts"), icon: ArchiveIcon },
    { href: "/statistics" as const, label: t("statistics"), icon: BarChart3Icon },
    { href: "/settings" as const, label: t("settings"), icon: Settings2Icon },
  ]

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <MailIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{tc("appName")}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {workspace?.name ?? tc("workspace")}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("mail")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const Icon = item.icon
                const active = isNavActive(pathname, item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
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
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={{
            name: workspace?.name || tc("workspace"),
            email: user.email,
            avatar: "",
          }}
          logoutAction={logoutAction}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export function ResendAppShell({
  children,
  user,
  workspace,
  threads: _threads,
  logoutAction,
}: ResendAppShellProps) {
  const pathname = usePathname()
  const t = useTranslations("nav")
  const tc = useTranslations("common")

  const mainNav = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/inbox", label: t("inbox") },
    { href: "/sent", label: t("sent") },
    { href: "/compose", label: t("compose") },
    { href: "/drafts", label: t("drafts") },
    { href: "/statistics", label: t("statistics") },
    { href: "/settings", label: t("settings") },
  ]

  function pageTitleFromPath(path: string) {
    if (path.startsWith("/inbox/")) return t("conversation")
    if (path.startsWith("/sent/")) return t("sent")
    const match = mainNav.find((item) => item.href === path)
    return match?.label ?? tc("appName")
  }

  const title = pageTitleFromPath(pathname)
  const isMailPaneRoute =
    pathname === "/inbox" ||
    pathname.startsWith("/inbox/") ||
    pathname === "/sent" ||
    pathname.startsWith("/sent/")

  const mobilePaneTitle = pathname.startsWith("/sent") ? t("sent") : t("inbox")

  return (
    <SidebarProvider
      defaultOpen
      className={cn("overflow-x-hidden", isMailPaneRoute && "h-svh max-h-svh overflow-hidden")}
    >
      <AppSidebar user={user} workspace={workspace} logoutAction={logoutAction} />
      <SidebarInset
        className={cn("min-w-0 overflow-x-hidden", isMailPaneRoute && "min-h-0 overflow-hidden")}
      >
        {!isMailPaneRoute ? (
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <Breadcrumb className="flex-1">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard">{tc("appName")}</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{title}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <LanguageSwitcher />
          </header>
        ) : (
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
            <SidebarTrigger className="-ml-1" />
            <span className="flex-1 text-sm font-medium">{mobilePaneTitle}</span>
            <LanguageSwitcher />
          </header>
        )}
        <div
          className={cn(
            "flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden",
            isMailPaneRoute ? "min-h-0 overflow-hidden p-0" : "gap-4 p-4 md:p-6"
          )}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
