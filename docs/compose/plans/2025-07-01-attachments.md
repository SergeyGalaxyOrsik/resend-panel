# Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add file attachment support to email compose and send flow using Supabase Storage.

**Architecture:** Files are uploaded to Supabase Storage bucket `attachments`. On send, server reads files from Storage, converts to base64, and includes them in Resend API payload. Attachment metadata is stored in a new `attachments` table linked to messages.

**Tech Stack:** Supabase Storage, Resend API attachments field, React drag-and-drop, shadcn/ui

---

## File Structure

### Create:
- `supabase/migrations/002_attachments.sql` — attachments table + storage bucket
- `lib/attachments.ts` — attachment CRUD + storage helpers
- `components/file-attachments.tsx` — file upload UI component
- `app/api/upload/route.ts` — file upload endpoint

### Modify:
- `lib/types.ts` — add Attachment type
- `components/email-composer.tsx` — add file attachment UI
- `app/actions.ts` — handle attachments in compose/send flow
- `components/thread-view.tsx` — display attachments in thread

---

## Task 1: Database Migration + Types

**Covers:** Data model for attachments

**Files:**
- Create: `supabase/migrations/002_attachments.sql`
- Modify: `lib/types.ts`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/002_attachments.sql`:

```sql
-- Attachments
create table if not exists attachments (
  id text primary key,
  message_id text not null references messages(id) on delete cascade,
  workspace_id text not null references workspaces(id) on delete cascade,
  filename text not null,
  content_type text not null default '',
  size integer not null default 0,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_message_id on attachments(message_id);
create index if not exists idx_attachments_workspace_id on attachments(workspace_id);

alter table attachments enable row level security;

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: Add Attachment type to lib/types.ts**

Append to `lib/types.ts`:

```ts
export type Attachment = {
  id: ID
  messageId: ID
  workspaceId: ID
  filename: string
  contentType: string
  size: number
  storagePath: string
  createdAt: Timestamp
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_attachments.sql lib/types.ts
git commit -m "feat: add attachments table migration and type"
```

---

## Task 2: Attachment Library

**Covers:** Attachment CRUD + storage helpers

**Files:**
- Create: `lib/attachments.ts`

- [ ] **Step 1: Create attachment library**

Create `lib/attachments.ts`:

```ts
import { supabase } from "@/lib/supabase"
import { createToken } from "@/lib/crypto"
import type { Attachment } from "@/lib/types"

const BUCKET = "attachments"
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_TOTAL_SIZE = 25 * 1024 * 1024 // 25MB

export { MAX_FILE_SIZE, MAX_TOTAL_SIZE }

function mapAttachment(row: any): Attachment {
  return {
    id: row.id,
    messageId: row.message_id,
    workspaceId: row.workspace_id,
    filename: row.filename,
    contentType: row.content_type,
    size: row.size,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  }
}

export async function uploadAttachment(
  workspaceId: string,
  fileId: string,
  filename: string,
  contentType: string,
  buffer: ArrayBuffer
): Promise<{ path: string; size: number }> {
  const ext = filename.split(".").pop() || "bin"
  const path = `${workspaceId}/${fileId}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false })

  if (error) throw new Error(`Upload failed: ${error.message}`)

  return { path, size: buffer.byteLength }
}

export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  return data?.signedUrl || ""
}

export async function getAttachmentBuffer(storagePath: string): Promise<ArrayBuffer | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath)
  if (error) return null
  return data.arrayBuffer()
}

export async function deleteAttachmentFile(storagePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([storagePath])
}

export async function createAttachmentRecord(
  messageId: string,
  workspaceId: string,
  filename: string,
  contentType: string,
  size: number,
  storagePath: string
): Promise<Attachment> {
  const attachment: Attachment = {
    id: createToken("att"),
    messageId,
    workspaceId,
    filename,
    contentType,
    size,
    storagePath,
    createdAt: new Date().toISOString(),
  }

  const { error } = await supabase.from("attachments").insert({
    id: attachment.id,
    message_id: attachment.messageId,
    workspace_id: attachment.workspaceId,
    filename: attachment.filename,
    content_type: attachment.contentType,
    size: attachment.size,
    storage_path: attachment.storagePath,
    created_at: attachment.createdAt,
  })

  if (error) throw new Error(error.message)
  return attachment
}

export async function listAttachments(messageId: string): Promise<Attachment[]> {
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("message_id", messageId)
    .order("created_at", { ascending: true })

  return (data || []).map(mapAttachment)
}

export async function listAttachmentsByWorkspace(workspaceId: string): Promise<Attachment[]> {
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })

  return (data || []).map(mapAttachment)
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  const { data } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .single()

  if (data?.storage_path) {
    await deleteAttachmentFile(data.storage_path)
  }

  await supabase.from("attachments").delete().eq("id", attachmentId)
}

export async function deleteAttachmentsByMessage(messageId: string): Promise<void> {
  const { data } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("message_id", messageId)

  if (data?.length) {
    const paths = data.map((r) => r.storage_path)
    await supabase.storage.from(BUCKET).remove(paths)
  }

  await supabase.from("attachments").delete().eq("message_id", messageId)
}

export function validateFileSize(files: File[]): { valid: boolean; error?: string } {
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File "${file.name}" exceeds 10MB limit.` }
    }
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)
  if (totalSize > MAX_TOTAL_SIZE) {
    return { valid: false, error: `Total file size exceeds 25MB limit.` }
  }

  return { valid: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/attachments.ts
git commit -m "feat: add attachment library with Supabase Storage helpers"
```

---

## Task 3: Upload API Endpoint

**Covers:** File upload endpoint

**Files:**
- Create: `app/api/upload/route.ts`

- [ ] **Step 1: Create upload endpoint**

Create `app/api/upload/route.ts`:

```ts
import { NextResponse } from "next/server"
import { requireCurrentUser } from "@/lib/auth"
import { getCurrentWorkspace } from "@/lib/store"
import { uploadAttachment, validateFileSize, createAttachmentRecord, MAX_FILE_SIZE } from "@/lib/attachments"
import { createToken } from "@/lib/crypto"

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser()
    const workspace = await getCurrentWorkspace()
    if (!workspace) {
      return NextResponse.json({ error: "Workspace missing." }, { status: 400 })
    }

    const formData = await request.formData()
    const files = formData.getAll("files") as File[]

    if (!files.length) {
      return NextResponse.json({ error: "No files provided." }, { status: 400 })
    }

    const validation = validateFileSize(files)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const results = []

    for (const file of files) {
      const buffer = await file.arrayBuffer()
      const fileId = createToken("file")

      const { path, size } = await uploadAttachment(
        workspace.id,
        fileId,
        file.name,
        file.type || "application/octet-stream",
        buffer
      )

      const attachment = await createAttachmentRecord(
        "", // messageId will be set later
        workspace.id,
        file.name,
        file.type || "application/octet-stream",
        size,
        path
      )

      results.push({
        id: attachment.id,
        filename: file.name,
        contentType: file.type,
        size: file.size,
        storagePath: path,
      })
    }

    return NextResponse.json({ files: results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p app/api/upload
git add app/api/upload/route.ts
git commit -m "feat: add file upload API endpoint"
```

---

## Task 4: File Attachments UI Component

**Covers:** File upload UI in compose form

**Files:**
- Create: `components/file-attachments.tsx`

- [ ] **Step 1: Create file attachments component**

Create `components/file-attachments.tsx`:

```tsx
"use client"

import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Paperclip, X, FileIcon, ImageIcon, FilmIcon, FileTextIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type UploadedFile = {
  id: string
  filename: string
  contentType: string
  size: number
  storagePath: string
}

type FileAttachmentsProps = {
  files: UploadedFile[]
  onFilesChange: (files: UploadedFile[]) => void
  disabled?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon
  if (contentType.startsWith("video/")) return FilmIcon
  if (contentType.includes("pdf") || contentType.includes("document")) return FileTextIcon
  return FileIcon
}

export function FileAttachments({ files, onFilesChange, disabled }: FileAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newFiles = Array.from(fileList)
      if (!newFiles.length) return

      setUploading(true)
      try {
        const formData = new FormData()
        for (const file of newFiles) {
          formData.append("files", file)
        }

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const data = await response.json()
        if (!response.ok) {
          alert(data.error || "Upload failed")
          return
        }

        onFilesChange([...files, ...data.files])
      } catch {
        alert("Upload failed")
      } finally {
        setUploading(false)
      }
    },
    [files, onFilesChange]
  )

  const removeFile = useCallback(
    (id: string) => {
      onFilesChange(files.filter((f) => f.id !== id))
    },
    [files, onFilesChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      if (e.dataTransfer.files.length) {
        uploadFiles(e.dataTransfer.files)
      }
    },
    [uploadFiles]
  )

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) uploadFiles(e.target.files)
          e.target.value = ""
        }}
      />

      <div
        className={cn(
          "rounded-xl border-2 border-dashed p-4 text-center text-sm transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30",
          disabled && "pointer-events-none opacity-50"
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-2">
          <Paperclip className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            {uploading ? "Uploading..." : "Drag files here or"}
          </span>
          {!uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
            >
              Choose files
            </Button>
          )}
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file) => {
            const Icon = getFileIcon(file.contentType)
            return (
              <div
                key={file.id}
                className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{file.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeFile(file.id)}
                  disabled={disabled}
                >
                  <X className="size-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/file-attachments.tsx
git commit -m "feat: add file attachments UI component with drag-and-drop"
```

---

## Task 5: Integrate Attachments into Compose Form

**Covers:** Attachments in compose/send flow

**Files:**
- Modify: `components/email-composer.tsx`
- Modify: `app/actions.ts`

- [ ] **Step 1: Update email-composer.tsx to include file attachments**

Add state and component to `components/email-composer.tsx`. Add after the `text` state:

```tsx
const [attachedFiles, setAttachedFiles] = useState<Array<{
  id: string
  filename: string
  contentType: string
  size: number
  storagePath: string
}>>([])
```

Add import at top:

```tsx
import { FileAttachments } from "@/components/file-attachments"
```

Add hidden input for attachment IDs in the form (after the existing hidden inputs):

```tsx
{attachedFiles.map((file) => (
  <input key={file.id} type="hidden" name="attachmentIds" value={file.id} />
))}
```

Add the FileAttachments component before the submit buttons:

```tsx
<FileAttachments
  files={attachedFiles}
  onFilesChange={setAttachedFiles}
  disabled={pending}
/>
```

- [ ] **Step 2: Update app/actions.ts to handle attachments in composeAction**

In the `composeAction` function, after reading form fields, add:

```ts
const attachmentIds = formData.getAll("attachmentIds") as string[]
```

Pass `attachmentIds` to `sendMessage`. Update the `sendMessage` function signature to accept `attachmentIds: string[]`.

In `sendMessage`, after creating the message and before calling Resend API:

```ts
// Link attachments to message
if (attachmentIds.length) {
  const { supabase } = await import("@/lib/supabase")
  for (const attId of attachmentIds) {
    await supabase
      .from("attachments")
      .update({ message_id: message.id })
      .eq("id", attId)
  }
}

// Fetch attachment content for Resend API
const attachments = []
if (attachmentIds.length) {
  const { listAttachments, getAttachmentBuffer } = await import("@/lib/attachments")
  const atts = await listAttachments(message.id)
  for (const att of atts) {
    const buffer = await getAttachmentBuffer(att.storagePath)
    if (buffer) {
      const base64 = Buffer.from(buffer).toString("base64")
      attachments.push({
        filename: att.filename,
        content: base64,
      })
    }
  }
}
```

Add `attachments` to the Resend API request body:

```ts
body: JSON.stringify({
  from,
  to: payload.to,
  cc: payload.cc.length ? payload.cc : undefined,
  bcc: payload.bcc.length ? payload.bcc : undefined,
  subject,
  html,
  text: payload.text,
  attachments: attachments.length ? attachments : undefined,
  reply_to: fromEmail,
  headers: payload.replyToMessageId
    ? {
        "In-Reply-To": payload.replyToMessageId,
        References: payload.references?.join(" ") || payload.replyToMessageId,
      }
    : undefined,
}),
```

- [ ] **Step 3: Commit**

```bash
git add components/email-composer.tsx app/actions.ts
git commit -m "feat: integrate file attachments into compose and send flow"
```

---

## Task 6: Display Attachments in Thread View

**Covers:** Attachment display in thread

**Files:**
- Modify: `components/thread-view.tsx`

- [ ] **Step 1: Add attachment display to thread-view.tsx**

Add import:

```tsx
import { FileIcon, ImageIcon, FilmIcon, FileTextIcon, DownloadIcon } from "lucide-react"
```

Add a helper function (inside the file, before the component):

```tsx
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon
  if (contentType.startsWith("video/")) return FilmIcon
  if (contentType.includes("pdf") || contentType.includes("document")) return FileTextIcon
  return FileIcon
}
```

Add a `MessageAttachments` component:

```tsx
function MessageAttachments({ messageId }: { messageId: string }) {
  const [attachments, setAttachments] = useState<Array<{
    id: string
    filename: string
    contentType: string
    size: number
    url: string
  }>>([])

  useEffect(() => {
    fetch(`/api/attachments?messageId=${messageId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.attachments) setAttachments(data.attachments)
      })
      .catch(() => {})
  }, [messageId])

  if (!attachments.length) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((att) => {
        const Icon = getFileIcon(att.contentType)
        return (
          <a
            key={att.id}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{att.filename}</span>
            <span className="text-xs text-muted-foreground">{formatFileSize(att.size)}</span>
            <DownloadIcon className="size-3 text-muted-foreground" />
          </a>
        )
      })}
    </div>
  )
}
```

Add `<MessageAttachments messageId={message.id} />` after the `dangerouslySetInnerHTML` div in both the `two-pane` and `default` variants.

- [ ] **Step 2: Create attachments API endpoint**

Create `app/api/attachments/route.ts`:

```ts
import { NextResponse } from "next/server"
import { listAttachments, getAttachmentUrl } from "@/lib/attachments"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const messageId = searchParams.get("messageId")

  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 })
  }

  const attachments = await listAttachments(messageId)
  const results = []

  for (const att of attachments) {
    const url = await getAttachmentUrl(att.storagePath)
    results.push({
      id: att.id,
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
      url,
    })
  }

  return NextResponse.json({ attachments: results })
}
```

- [ ] **Step 3: Commit**

```bash
git add components/thread-view.tsx app/api/attachments/route.ts
git commit -m "feat: display attachments in thread view with download links"
```

---

## Task 7: Verify Build

**Covers:** Build verification

**Files:** (none)

- [ ] **Step 1: Build**

```bash
cd /Users/seglx/Documents/Projects/resend-panel && bun run build
```

Expected: Build succeeds.

- [ ] **Step 2: Commit if fixes needed**

```bash
git add -A && git commit -m "fix: resolve build issues for attachments"
```

Only if Step 1 had errors.
