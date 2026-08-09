"use client"

import { useActionState, useState } from "react"
import { useTranslations } from "next-intl"
import { AtSignIcon, PowerIcon, Trash2Icon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCloseOnSuccess } from "@/hooks/use-close-on-success"
import type { AuthState, CreateUserState, Mailbox, ManagedUser } from "@/lib/types"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>
type CreateAction = (prevState: CreateUserState, formData: FormData) => Promise<CreateUserState>

type UsersManagerProps = {
  users: ManagedUser[]
  mailboxes: Mailbox[]
  currentUserId: string
  createdLabels: Record<string, string>
  createAction: CreateAction
  assignAction: Action
  setActiveAction: Action
  deleteAction: Action
}

const initialState: AuthState = {}
const initialCreateState: CreateUserState = {}

function StateMessage({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
    )
  }

  return null
}

function MailboxChecklist({
  mailboxes,
  selected,
  idPrefix,
}: {
  mailboxes: Mailbox[]
  selected: string[]
  idPrefix: string
}) {
  const t = useTranslations("users")

  if (!mailboxes.length) {
    return <p className="text-sm text-muted-foreground">{t("noMailboxesYet")}</p>
  }

  return (
    <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border p-3">
      {mailboxes.map((mailbox) => (
        <div key={mailbox.id} className="flex items-center gap-3">
          <Checkbox
            id={`${idPrefix}-${mailbox.id}`}
            name="mailboxIds"
            value={mailbox.id}
            defaultChecked={selected.includes(mailbox.id)}
          />
          <Label htmlFor={`${idPrefix}-${mailbox.id}`} className="font-normal">
            {mailbox.displayName ? `${mailbox.displayName} <${mailbox.address}>` : mailbox.address}
          </Label>
        </div>
      ))}
    </div>
  )
}

/**
 * Unlike the other dialogs this one stays open on success, because the generated
 * password is shown here and nowhere else. Reopening remounts the body so a previous
 * password never reappears.
 */
function CreateUserDialog({ mailboxes, action }: { mailboxes: Mailbox[]; action: CreateAction }) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const t = useTranslations("users")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setFormKey((value) => value + 1)
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">{t("addUser")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <CreateUserBody key={formKey} mailboxes={mailboxes} action={action} />
      </DialogContent>
    </Dialog>
  )
}

function CreateUserBody({ mailboxes, action }: { mailboxes: Mailbox[]; action: CreateAction }) {
  const [state, formAction, pending] = useActionState(action, initialCreateState)
  const t = useTranslations("users")
  const tc = useTranslations("common")

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("addUser")}</DialogTitle>
        <DialogDescription>{t("addUserDescription")}</DialogDescription>
      </DialogHeader>

      {state.temporaryPassword ? (
        // Shown once. The password is stored only as a hash, so it cannot be read back.
        <div className="space-y-3">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {t("userCreated", { email: state.createdEmail ?? "" })}
          </p>
          <div className="space-y-2">
            <Label htmlFor="generated-password">{t("temporaryPassword")}</Label>
            <Input id="generated-password" readOnly value={state.temporaryPassword} className="font-mono" />
            <p className="text-xs text-muted-foreground">{t("temporaryPasswordHint")}</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">{t("done")}</Button>
            </DialogClose>
          </DialogFooter>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <StateMessage state={state} />
          <div className="space-y-2">
            <Label htmlFor="new-user-email">{t("email")}</Label>
            <Input
              id="new-user-email"
              name="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>{t("mailboxes")}</Label>
            <MailboxChecklist mailboxes={mailboxes} selected={[]} idPrefix="create" />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? tc("pleaseWait") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  )
}

function AssignMailboxesDialog({
  user,
  mailboxes,
  action,
}: {
  user: ManagedUser
  mailboxes: Mailbox[]
  action: Action
}) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [open, setOpen] = useCloseOnSuccess(state)
  const t = useTranslations("users")
  const tc = useTranslations("common")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label={t("assignMailboxes")}>
          <AtSignIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("assignMailboxes")}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          <StateMessage state={state} />
          <MailboxChecklist
            mailboxes={mailboxes}
            selected={user.mailboxes.map((mailbox) => mailbox.id)}
            idPrefix={`assign-${user.id}`}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? tc("pleaseWait") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ToggleActiveDialog({ user, action }: { user: ManagedUser; action: Action }) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [open, setOpen] = useCloseOnSuccess(state)
  const t = useTranslations("users")
  const tc = useTranslations("common")

  const label = user.isActive ? t("deactivate") : t("activate")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label={label}>
          <PowerIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {user.isActive ? t("deactivateDescription", { email: user.email }) : t("activateDescription", { email: user.email })}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="isActive" value={user.isActive ? "false" : "true"} />
          <StateMessage state={state} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? tc("pleaseWait") : label}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteUserDialog({ user, action }: { user: ManagedUser; action: Action }) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [open, setOpen] = useCloseOnSuccess(state)
  const t = useTranslations("users")
  const tc = useTranslations("common")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive-outline" size="icon-sm" aria-label={t("delete")}>
          <Trash2Icon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>{t("deleteDescription", { email: user.email })}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.id} />
          <StateMessage state={state} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? tc("pleaseWait") : t("delete")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function UsersManager({
  users,
  mailboxes,
  currentUserId,
  createdLabels,
  createAction,
  assignAction,
  setActiveAction,
  deleteAction,
}: UsersManagerProps) {
  const t = useTranslations("users")

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <CreateUserDialog mailboxes={mailboxes} action={createAction} />
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="border-b hover:bg-transparent">
              <TableHead className="h-12 px-4 font-medium">{t("email")}</TableHead>
              <TableHead className="h-12 w-[110px] px-4 font-medium">{t("role")}</TableHead>
              <TableHead className="h-12 px-4 font-medium">{t("mailboxes")}</TableHead>
              <TableHead className="h-12 w-[140px] px-4 font-medium">{t("status")}</TableHead>
              <TableHead className="h-12 w-[180px] px-4 font-medium">{t("created")}</TableHead>
              <TableHead className="h-12 w-[140px] px-4 font-medium">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId
              return (
                <TableRow key={user.id} className="hover:bg-muted/50">
                  <TableCell className="h-16 px-4 font-medium">{user.email}</TableCell>
                  <TableCell className="h-16 px-4">
                    <Badge variant={user.role === "owner" ? "default" : "outline"}>
                      {user.role === "owner" ? t("roleOwner") : t("roleMember")}
                    </Badge>
                  </TableCell>
                  <TableCell className="h-16 max-w-[280px] px-4 text-sm text-muted-foreground">
                    <span className="block truncate">
                      {user.mailboxes.length
                        ? user.mailboxes.map((mailbox) => mailbox.address).join(", ")
                        : t("noMailboxes")}
                    </span>
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm">
                    {user.isActive ? (
                      <span className="text-emerald-700">{t("statusActive")}</span>
                    ) : (
                      <span className="text-muted-foreground">{t("statusInactive")}</span>
                    )}
                    {user.mustChangePassword ? (
                      <span className="block text-xs text-amber-700">{t("statusPendingPassword")}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm tabular-nums text-muted-foreground">
                    {createdLabels[user.id] ?? ""}
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <div className="flex gap-2">
                      <AssignMailboxesDialog user={user} mailboxes={mailboxes} action={assignAction} />
                      {isSelf ? null : (
                        <>
                          <ToggleActiveDialog user={user} action={setActiveAction} />
                          <DeleteUserDialog user={user} action={deleteAction} />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
