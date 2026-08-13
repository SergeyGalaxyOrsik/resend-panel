"use client"

import { Suspense, type ReactNode } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { MailIcon } from "lucide-react"
import { AccountMenu } from "@/components/mail/account-menu"
import { MailSearch } from "@/components/mail/mail-search"
import { MailSidebar } from "@/components/mail/mail-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import type { FolderCounts, Workspace } from "@/lib/types"

type MailShellProps = {
  children: ReactNode
  email: string
  role: string
  workspace: Workspace | null
  counts: FolderCounts
  defaultSidebarOpen: boolean
  logoutAction: () => Promise<void>
}

export function MailShell({
  children,
  email,
  role,
  workspace,
  counts,
  defaultSidebarOpen,
  logoutAction,
}: MailShellProps) {
  const tc = useTranslations("common")

  return (
    <SidebarProvider
      defaultOpen={defaultSidebarOpen}
      className="flex h-svh min-h-0 w-full flex-col overflow-hidden [--header-height:3.5rem]"
    >
      <header className="flex h-(--header-height) w-full shrink-0 items-center gap-2 border-b bg-background px-2 md:gap-3 md:px-4">
        <SidebarTrigger />

        <Link
          href="/inbox"
          className="hidden items-center gap-2 rounded-md px-1 py-1 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex"
        >
          <MailIcon className="size-5" />
          <span className="hidden lg:inline">{tc("appName")}</span>
        </Link>

        {/* useSearchParams needs a boundary so the shell can still stream. */}
        <Suspense fallback={<div className="min-w-0 flex-1 md:max-w-2xl" />}>
          <MailSearch />
        </Suspense>

        <div className="ml-auto flex shrink-0 items-center gap-0.5 md:gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <AccountMenu
            email={email}
            role={role}
            workspaceName={workspace?.name ?? tc("workspace")}
            logoutAction={logoutAction}
          />
        </div>
      </header>

      <div className="flex min-h-0 w-full flex-1">
        {/* Reads `?from=` to keep the source folder lit while reading a thread. */}
        <Suspense fallback={<div className="hidden w-(--sidebar-width) shrink-0 md:block" />}>
          <MailSidebar counts={counts} isOwner={role === "owner"} />
        </Suspense>
        <SidebarInset className="min-h-0 min-w-0 overflow-hidden">{children}</SidebarInset>
      </div>
    </SidebarProvider>
  )
}
