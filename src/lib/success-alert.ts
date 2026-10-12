"use client"

import { toast } from "@/components/ui/fluent-toast-store"

export function showSuccessAlert(message: string, title = "Done") {
  toast.success(title, { description: message })
}
