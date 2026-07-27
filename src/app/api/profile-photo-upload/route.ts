import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_FILE_BYTES = 5 * 1024 * 1024
const UPLOAD_DIRECTORY = path.join(process.cwd(), "public", "uploads", "profile-photos")

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
}

function resolveExtension(file: File) {
  const mapped = MIME_EXTENSION_MAP[file.type]
  if (mapped) {
    return mapped
  }

  const fromName = path.extname(file.name || "").toLowerCase()
  if (fromName && [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(fromName)) {
    return fromName === ".jpeg" ? ".jpg" : fromName
  }

  return null
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const fileEntry = formData.get("file")

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 })
    }

    if (!fileEntry.type.startsWith("image/")) {
      return NextResponse.json({ error: "Please upload an image file." }, { status: 400 })
    }

    if (fileEntry.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Please upload an image smaller than 5 MB." }, { status: 400 })
    }

    const extension = resolveExtension(fileEntry)
    if (!extension) {
      return NextResponse.json({ error: "Unsupported image format." }, { status: 400 })
    }

    await mkdir(UPLOAD_DIRECTORY, { recursive: true })

    const fileName = `${Date.now()}-${randomUUID()}${extension}`
    const destination = path.join(UPLOAD_DIRECTORY, fileName)
    const bytes = new Uint8Array(await fileEntry.arrayBuffer())
    await writeFile(destination, bytes)

    const { origin } = new URL(request.url)
    const url = `${origin}/uploads/profile-photos/${fileName}`

    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: "Failed to upload profile photo." }, { status: 500 })
  }
}
