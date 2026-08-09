"use client"

import { useActionState } from "react"
import { useTranslations } from "next-intl"
import { PencilIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import type { AuthState, Mailbox } from "@/lib/types"

type Action = (prevState: AuthState, formData: FormData) => Promise<AuthState>

type MailboxesManagerProps = {
  mailboxes: Mailbox[]
  assignedCounts: Record<string, number>
  createAction: Action
  updateAction: Action
  deleteAction: Action
  createdLabels: Record<string, string>
}

const initialState: AuthState = {}

function StateMessage({ state }: { state: AuthState }) {
  if (state.error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
    )
  }

  if (state.success) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {state.success}
      </p>
    )
  }

  return null
}

function CreateMailboxDialog({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [open, setOpen] = useCloseOnSuccess(state)
  const t = useTranslations("mailboxes")
  const tc = useTranslations("common")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t("addMailbox")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addMailbox")}</DialogTitle>
          <DialogDescription>{t("addMailboxDescription")}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <StateMessage state={state} />
          <div className="space-y-2">
            <Label htmlFor="mailbox-address">{t("address")}</Label>
            <Input
              id="mailbox-address"
              name="address"
              type="email"
              placeholder={t("addressPlaceholder")}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mailbox-display-name">{t("displayName")}</Label>
            <Input
              id="mailbox-display-name"
              name="displayName"
              placeholder={t("displayNamePlaceholder")}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">{t("cancel")}</Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? tc("pleaseWait") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function RenameMailboxDialog({ mailbox, action }: { mailbox: Mailbox; action: Action }) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [open, setOpen] = useCloseOnSuccess(state)
  const t = useTranslations("mailboxes")
  const tc = useTranslations("common")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label={t("rename")}>
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("rename")}</DialogTitle>
          <DialogDescription>{mailbox.address}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="mailboxId" value={mailbox.id} />
          <StateMessage state={state} />
          <div className="space-y-2">
            <Label htmlFor={`rename-${mailbox.id}`}>{t("displayName")}</Label>
            <Input
              id={`rename-${mailbox.id}`}
              name="displayName"
              defaultValue={mailbox.displayName}
              placeholder={t("displayNamePlaceholder")}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">{t("cancel")}</Button>
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

function DeleteMailboxDialog({ mailbox, action }: { mailbox: Mailbox; action: Action }) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const [open, setOpen] = useCloseOnSuccess(state)
  const t = useTranslations("mailboxes")
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
          <DialogDescription>{t("deleteDescription", { address: mailbox.address })}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="mailboxId" value={mailbox.id} />
          <StateMessage state={state} />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">{t("cancel")}</Button>
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

export function MailboxesManager({
  mailboxes,
  assignedCounts,
  createAction,
  updateAction,
  deleteAction,
  createdLabels,
}: MailboxesManagerProps) {
  const t = useTranslations("mailboxes")

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <CreateMailboxDialog action={createAction} />
      </div>

      {mailboxes.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="min-w-0 rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-b hover:bg-transparent">
                <TableHead className="h-12 px-4 font-medium">{t("address")}</TableHead>
                <TableHead className="h-12 px-4 font-medium">{t("displayName")}</TableHead>
                <TableHead className="h-12 w-[140px] px-4 font-medium">{t("assignedUsers")}</TableHead>
                <TableHead className="h-12 w-[180px] px-4 font-medium">{t("created")}</TableHead>
                <TableHead className="h-12 w-[120px] px-4 font-medium">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mailboxes.map((mailbox) => (
                <TableRow key={mailbox.id} className="hover:bg-muted/50">
                  <TableCell className="h-16 px-4 font-medium">{mailbox.address}</TableCell>
                  <TableCell className="h-16 px-4 text-sm text-muted-foreground">
                    {mailbox.displayName || "—"}
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm tabular-nums text-muted-foreground">
                    {assignedCounts[mailbox.id] ?? 0}
                  </TableCell>
                  <TableCell className="h-16 px-4 text-sm tabular-nums text-muted-foreground">
                    {createdLabels[mailbox.id] ?? ""}
                  </TableCell>
                  <TableCell className="h-16 px-4">
                    <div className="flex gap-2">
                      <RenameMailboxDialog mailbox={mailbox} action={updateAction} />
                      <DeleteMailboxDialog mailbox={mailbox} action={deleteAction} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
