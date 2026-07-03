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
