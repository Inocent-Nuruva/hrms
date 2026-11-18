"use client"

import * as React from "react"
import { Dialog as FluentDialog, DialogSurface, DialogTitle } from "@fluentui/react-components"
import { Download, Loader2, PenLine, Upload, X } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/fluent-toast-store"
import {
  errorMessage,
  fetchContractFile,
  fileToBase64,
  requestSigningCode,
  saveBlob,
  signContractDigitally,
  uploadSignedContract,
  type ContractDetail,
} from "@/lib/contracts-api"
import { cn } from "@/lib/utils"

const button =
  "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"

/** Drawing pad (mouse, pen and touch). Exports a PNG data URL. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const drawing = React.useRef(false)
  const hasInk = React.useRef(false)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const context = canvas.getContext("2d")
    if (!context) return
    context.scale(ratio, ratio)
    context.lineWidth = 2.2
    context.lineCap = "round"
    context.strokeStyle = "#0f2a6b"
  }, [])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  return (
    <div className="grid gap-1">
      <canvas
        ref={canvasRef}
        aria-label="Draw your signature"
        className="h-36 w-full touch-none rounded-md border border-dashed border-slate-400 bg-white"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drawing.current = true
          const context = event.currentTarget.getContext("2d")
          const { x, y } = point(event)
          context?.beginPath()
          context?.moveTo(x, y)
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return
          const context = event.currentTarget.getContext("2d")
          const { x, y } = point(event)
          context?.lineTo(x, y)
          context?.stroke()
          hasInk.current = true
        }}
        onPointerUp={(event) => {
          drawing.current = false
          onChange(hasInk.current ? event.currentTarget.toDataURL("image/png") : null)
        }}
      />
      <button
        type="button"
        className="w-fit text-xs font-medium text-primary hover:underline"
        onClick={() => {
          const canvas = canvasRef.current
          canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height)
          hasInk.current = false
          onChange(null)
        }}
      >
        Clear
      </button>
    </div>
  )
}

function DigitalSignDialog({
  open,
  onOpenChange,
  token,
  contract,
  defaultName,
  onSigned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
  contract: ContractDetail
  defaultName: string
  onSigned: () => void
}) {
  const [consent, setConsent] = React.useState(false)
  const [kind, setKind] = React.useState<"TYPED" | "DRAWN">("TYPED")
  const [typed, setTyped] = React.useState(defaultName)
  const [drawn, setDrawn] = React.useState<string | null>(null)
  const [challenge, setChallenge] = React.useState<Awaited<ReturnType<typeof requestSigningCode>> | null>(null)
  const [code, setCode] = React.useState("")
  const [busy, setBusy] = React.useState<"code" | "sign" | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setConsent(false)
    setKind("TYPED")
    setTyped(defaultName)
    setDrawn(null)
    setChallenge(null)
    setCode("")
    setError(null)
  }, [open, defaultName])

  const getCode = async () => {
    setBusy("code")
    setError(null)
    try {
      setChallenge(await requestSigningCode(token, contract.id))
    } catch (cause) {
      setError(errorMessage(cause, "Could not start signing"))
    } finally {
      setBusy(null)
    }
  }

  const signatureReady = kind === "TYPED" ? typed.trim().length > 1 : Boolean(drawn)
  const canSign = consent && signatureReady && Boolean(challenge) && /^\d{6}$/.test(code) && !busy

  const sign = async () => {
    if (!challenge) return
    setBusy("sign")
    setError(null)
    try {
      await signContractDigitally(token, contract.id, {
        document_sha256: challenge.document_sha256,
        signature: kind === "TYPED" ? { kind, text: typed.trim() } : { kind, png_base64: drawn ?? "" },
        code,
        consent: true,
      })
      toast.success(challenge.party === "COMPANY" ? "Signed for the company" : "Contract signed")
      onOpenChange(false)
      onSigned()
    } catch (cause) {
      const message = errorMessage(cause, "Signing failed")
      setError(message)
      if (/changed since you opened it/i.test(message)) onSigned()
    } finally {
      setBusy(null)
    }
  }

  return (
    <FluentDialog open={open} onOpenChange={(_event, data) => !busy && onOpenChange(data.open)}>
      <DialogSurface className="!w-[min(560px,calc(100vw-2rem))] !max-w-[560px] !p-0 max-sm:!m-0 max-sm:!h-dvh max-sm:!w-screen max-sm:!max-w-none max-sm:!rounded-none">
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <DialogTitle as="h2" className="!text-lg !font-semibold">
                Sign digitally
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {contract.referenceNo} · version {contract.version}
              </p>
            </div>
            <button type="button" aria-label="Close" className="rounded-md p-1 hover:bg-muted" onClick={() => onOpenChange(false)}>
              <X className="size-5" />
            </button>
          </div>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={consent} onCheckedChange={(value) => setConsent(value === true)} aria-label="I agree" />
              <span>
                I have read the whole contract and agree that this electronic signature has the same effect as my
                handwritten signature.
              </span>
            </label>

            <div className="grid gap-2">
              <div role="tablist" aria-label="Signature type" className="flex gap-1 rounded-md bg-muted p-1 text-sm">
                {(["TYPED", "DRAWN"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={kind === value}
                    className={cn("flex-1 rounded px-3 py-1.5", kind === value ? "bg-background text-foreground font-medium shadow-sm" : "text-muted-foreground")}
                    onClick={() => setKind(value)}
                  >
                    {value === "TYPED" ? "Type" : "Draw"}
                  </button>
                ))}
              </div>
              {kind === "TYPED" ? (
                <div className="grid gap-1">
                  <input
                    className="h-10 rounded-md border border-border px-3 text-sm"
                    value={typed}
                    maxLength={100}
                    aria-label="Type your full name"
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <p className="rounded-md border border-dashed border-slate-300 bg-white px-3 py-2 text-2xl italic text-[#0f2a6b]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
                    {typed || " "}
                  </p>
                </div>
              ) : (
                <SignaturePad onChange={setDrawn} />
              )}
            </div>

            <div className="grid gap-2 rounded-md border border-border px-3 py-3">
              <p className="text-sm font-medium">Verification code</p>
              {!challenge ? (
                <button type="button" className={cn(button, "w-fit border border-border")} disabled={busy === "code"} onClick={() => void getCode()}>
                  {busy === "code" ? <Loader2 className="size-4 animate-spin" /> : null} Get verification code
                </button>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {challenge.method === "TOTP"
                      ? "Enter the 6-digit code from your authenticator app."
                      : `We sent a 6-digit code to ${challenge.masked_email ?? "your email"}. It expires in 10 minutes.`}
                  </p>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    aria-label="Verification code"
                    className="h-10 w-40 rounded-md border border-border px-3 text-center text-lg tracking-[0.4em]"
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                  {challenge.method === "EMAIL_OTP" ? (
                    <button type="button" className="w-fit text-xs font-medium text-primary hover:underline" disabled={busy === "code"} onClick={() => void getCode()}>
                      Send a new code
                    </button>
                  ) : null}
                </>
              )}
            </div>
            {error ? <p className="rounded-md border border-destructive bg-background px-3 py-2 text-sm text-destructive">{error}</p> : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            <button type="button" className={cn(button, "border border-border")} onClick={() => onOpenChange(false)} disabled={Boolean(busy)}>
              Cancel
            </button>
            <button type="button" className={cn(button, "bg-primary text-primary-foreground")} disabled={!canSign} onClick={() => void sign()}>
              {busy === "sign" ? <Loader2 className="size-4 animate-spin" /> : <PenLine className="size-4" />} Sign
            </button>
          </div>
        </div>
      </DialogSurface>
    </FluentDialog>
  )
}

/**
 * Actions for whoever signs next (company signatory or employee): digital
 * signing and/or paper signing, as the company settings allow.
 */
export function ContractSigningPanel({
  token,
  contract,
  signerName,
  attestOnBehalf = false,
  opened,
  onChanged,
}: {
  token: string
  contract: ContractDetail
  signerName: string
  /** HR uploading the company-signed scan for the signatory. */
  attestOnBehalf?: boolean
  /** The signer has opened the document in this session. */
  opened: boolean
  onChanged: () => void
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const fileInput = React.useRef<HTMLInputElement | null>(null)
  const party = contract.signing.my_party ?? (attestOnBehalf ? "COMPANY" : null)
  if (!party) return null
  const { digital_signing_enabled: digital, paper_signing_enabled: paper } = contract.signing
  const sha = contract.signing.current_document_sha256

  const downloadForPrinting = async () => {
    try {
      const file = await fetchContractFile(token, contract.id, contract.signing.current_document_id)
      saveBlob(file.blob, file.fileName)
    } catch (cause) {
      toast.error(errorMessage(cause, "Download failed"))
    }
  }

  const upload = async (file?: File) => {
    if (!file || !sha) return
    if (file.type !== "application/pdf") {
      toast.error("Upload the signed contract as a PDF")
      return
    }
    setUploading(true)
    try {
      await uploadSignedContract(token, contract.id, {
        file: await fileToBase64(file),
        document_sha256: sha,
        attest_on_behalf: attestOnBehalf && !contract.signing.my_party ? true : undefined,
      })
      toast.success(party === "COMPANY" ? "Company-signed copy uploaded" : "Signed copy uploaded for HR verification")
      onChanged()
    } catch (cause) {
      toast.error(errorMessage(cause, "Upload failed"))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  return (
    <section aria-label="Sign this contract" className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div>
        <h3 className="text-sm font-semibold">
          {party === "COMPANY" ? "Sign on behalf of the company" : "Your signature is needed"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {party === "COMPANY"
            ? "The company signs first. The employee is asked to sign after you."
            : "Read the whole document above, then sign."}
        </p>
      </div>
      {contract.lastRejectionReason && party === "EMPLOYEE" ? (
        <p className="rounded-md border border-destructive bg-background px-3 py-2 text-sm text-destructive">
          Your last upload was not accepted: {contract.lastRejectionReason}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {digital && contract.signing.my_party ? (
          <button
            type="button"
            className={cn(button, "bg-primary text-primary-foreground")}
            disabled={!opened}
            title={opened ? undefined : "Open the document first"}
            onClick={() => setDialogOpen(true)}
          >
            <PenLine className="size-4" /> Sign digitally
          </button>
        ) : null}
        {paper ? (
          <>
            <button type="button" className={cn(button, "border border-border bg-background")} onClick={() => void downloadForPrinting()}>
              <Download className="size-4" /> Download to print
            </button>
            <button
              type="button"
              className={cn(button, "border border-border bg-background")}
              disabled={uploading || !sha}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload signed PDF
            </button>
            <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
          </>
        ) : null}
      </div>
      {paper ? (
        <p className="text-xs text-muted-foreground">
          On paper: download, print, sign every page where indicated, scan to one PDF and upload it.
          {party === "EMPLOYEE" ? " HR checks the scan before the contract is complete." : ""}
        </p>
      ) : null}
      <DigitalSignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        token={token}
        contract={contract}
        defaultName={signerName}
        onSigned={onChanged}
      />
    </section>
  )
}
