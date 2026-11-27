"use client"

import * as React from "react"
import { FileIcon, UploadCloudIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

/**
 * The shared single-file picker: drop a file or click/press Enter to browse.
 * Shows the chosen file with its size and a Remove button. Validates the
 * optional size limit and reports problems through `onError`.
 */
export function FileDropzone({
  file,
  onFileChange,
  accept,
  maxSizeMb,
  id,
  disabled,
  invalid,
  hint,
  onError,
  className,
}: {
  file: File | { name: string; size?: number } | null
  onFileChange: (file: File | null) => void
  /** Same as the input accept attribute, e.g. ".pdf,image/*". */
  accept?: string
  maxSizeMb?: number
  id?: string
  disabled?: boolean
  invalid?: boolean
  /** Shown under the prompt, e.g. "PDF or image, up to 10 MB". */
  hint?: React.ReactNode
  onError?: (message: string) => void
  className?: string
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const accept_ = (picked: File | undefined) => {
    if (!picked) return
    if (maxSizeMb && picked.size > maxSizeMb * 1024 * 1024) {
      onError?.(`The file is larger than ${maxSizeMb} MB.`)
      return
    }
    onFileChange(picked)
  }

  if (file) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-[var(--hrms-control-radius)] border border-input bg-background px-3 py-2.5",
          invalid && "border-destructive",
          className
        )}
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <FileIcon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
          {typeof file.size === "number" ? <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p> : null}
        </div>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Remove ${file.name}`}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          onClick={() => onFileChange(null)}
        >
          <XIcon className="size-4" aria-hidden="true" />
          Remove
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          accept_(event.target.files?.[0])
          event.currentTarget.value = ""
        }}
      />
      <button
        type="button"
        disabled={disabled}
        aria-describedby={id ? `${id}-message` : undefined}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-1.5 rounded-[var(--hrms-control-radius)] border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50",
          dragging ? "border-primary bg-primary/5" : "border-input bg-background hover:border-primary/50 hover:bg-muted/40",
          invalid && "border-destructive"
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!disabled) accept_(event.dataTransfer.files?.[0])
        }}
      >
        <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloudIcon className="size-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium text-foreground">
          Drop a file here or <span className="text-primary underline-offset-2 hover:underline">browse</span>
        </span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </button>
    </div>
  )
}
