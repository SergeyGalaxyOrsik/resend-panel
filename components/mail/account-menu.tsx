"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { LogOutIcon, Settings2Icon } from "lucide-react"
import { avatarTone, getInitials } from "@/lib/mail"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type AccountMenuProps = {
  email: string
  role: string
  workspaceName: string
  logoutAction: () => Promise<void>
}

export function AccountMenu({ email, role, workspaceName, logoutAction }: AccountMenuProps) {
  const t = useTranslations("nav")
  const tu = useTranslations("users")
  const isOwner = role === "owner"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={email}
        className="flex size-8 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full text-[11px] font-medium text-white",
            avatarTone(email)
          )}
        >
          {getInitials(email)}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-3 px-1.5 py-2">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white",
              avatarTone(email)
            )}
          >
            {getInitials(email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {workspaceName} · {isOwner ? tu("roleOwner") : tu("roleMember")}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        {isOwner ? (
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <Settings2Icon />
              {t("settings")}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/change-password">{t("changePassword")}</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form action={logoutAction} className="w-full">
            <button type="submit" className="flex w-full items-center gap-1.5">
              <LogOutIcon />
              {t("logOut")}
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
