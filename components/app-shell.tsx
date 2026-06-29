'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"
import { Menu, Mail, Send, Inbox, Settings2, ChartColumn, FilePenLine, DraftingCompass, LogOut, PanelLeftClose } from "lucide-react"
import type { ReactNode } from "react"
import type { User, Workspace } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: typeof Mail
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: ChartColumn },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/sent", label: "Sent", icon: Send },
  { href: "/compose", label: "Compose", icon: FilePenLine },
  { href: "/drafts", label: "Drafts", icon: DraftingCompass },
  { href: "/statistics", label: "Statistics", icon: ChartColumn },
  { href: "/settings", label: "Settings", icon: Settings2 },
]

type AppShellProps = {
  children: ReactNode
  user: User
  workspace: Workspace | null
  logoutAction: () => Promise<void>
}

export function AppShell({ children, user, workspace, logoutAction }: AppShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const title = useMemo(() => {
    if (pathname.startsWith("/inbox/")) {
      return "Conversation"
    }

    const item = navItems.find((nav) => nav.href === pathname)
    return item?.label || "Resend Panel"
  }, [pathname])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(24,24,27,0.08),transparent_35%),linear-gradient(180deg,rgba(250,250,250,1),rgba(244,244,245,1))] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[290px] border-r border-border bg-white/90 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.4)] transition-transform duration-200 md:static md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Resend
                </div>
                <div className="text-lg font-semibold">Panel</div>
              </div>
              <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setMobileOpen(false)}>
                <PanelLeftClose className="size-4" />
              </Button>
            </div>

            <div className="border-b border-border px-6 py-5">
              <div className="rounded-2xl border border-border bg-gradient-to-br from-zinc-950 to-zinc-800 p-4 text-white">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-400">Workspace</div>
                <div className="mt-2 text-sm font-semibold">{workspace?.name || "Primary workspace"}</div>
                <div className="mt-1 text-xs text-zinc-300">{user.email}</div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
              {navItems.map((item) => {
                const active =
                  pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-zinc-950 text-white shadow-md"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            <div className="border-t border-border p-4">
              <form action={logoutAction}>
                <Button type="submit" variant="outline" className="w-full justify-start gap-3 rounded-2xl">
                  <LogOut className="size-4" />
                  Log out
                </Button>
              </form>
            </div>
          </div>
        </aside>

        {mobileOpen ? (
          <button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        ) : null}

        <div className="flex min-h-screen flex-1 flex-col md:pl-0">
          <header className="sticky top-0 z-20 border-b border-border bg-white/85 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon-sm" className="md:hidden" onClick={() => setMobileOpen(true)}>
                  <Menu className="size-4" />
                </Button>
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Workspace</div>
                  <h1 className="text-lg font-semibold">{title}</h1>
                </div>
              </div>

              <div className="hidden items-center gap-3 md:flex">
                <div className="rounded-full border border-border bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-600">
                  {user.email}
                </div>
                <Link href="/compose">
                  <Button className="rounded-full px-4">New message</Button>
                </Link>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  )
}

