"use client"

import { toast } from "@/components/ui/fluent-toast-store"

export function showErrorAlert(message: string, title = "Something went wrong") {
  toast.error(title, { description: message })
}
