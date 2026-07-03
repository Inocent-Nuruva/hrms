"use client"

import * as React from "react"
import { EmployeeRegisterForm } from "@/components/dashboard/employee-register-form"
import { Card, CardContent } from "@/components/ui/card"

export function EmployeeRegistrationView() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-6">
          <EmployeeRegisterForm />
        </CardContent>
      </Card>
    </div>
  )
}
