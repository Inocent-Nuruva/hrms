// ─────────────────────────────────────────────────────────────────────────────
// components/auth/MagicLinkRequestForm.tsx
// Step 1: Email / Phone input + "Send Magic Link" button
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Phone, ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

import { sendOTPSchema, type SendOTPInput } from "@/lib/validations";
import type { ContactMethod } from "@/types/auth";

// ── Props ─────────────────────────────────────────────────────────────────────

interface MagicLinkRequestFormProps {
  defaultContact?: string;           // pre-fill from ?email= query param
  onSuccess: (contact: string, method: ContactMethod) => void;
  isLoading?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MagicLinkRequestForm({
  defaultContact = "",
  onSuccess,
  isLoading = false,
}: MagicLinkRequestFormProps) {
  const [method, setMethod] = useState<ContactMethod>("email");

  const form = useForm<SendOTPInput>({
    resolver: zodResolver(sendOTPSchema),
    defaultValues: {
      contact: defaultContact,
      method: "email",
    },
  });

  const onSubmit = async (values: SendOTPInput) => {
    onSuccess(values.contact, values.method);
  };

  const handleMethodChange = (value: string) => {
    const m = value as ContactMethod;
    setMethod(m);
    form.setValue("method", m);
    form.setValue("contact", "");         // clear on channel switch
    form.clearErrors("contact");
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Email / SMS toggle */}
        <Tabs defaultValue="email" onValueChange={handleMethodChange}>
          <TabsList className="grid w-full grid-cols-2 bg-slate-100">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
            <TabsTrigger value="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              SMS
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Contact input */}
        <FormField
          control={form.control}
          name="contact"
          render={({ field }) => (
            <FormItem>
              <Label htmlFor="contact">
                {method === "email" ? "Email Address" : "Phone Number"}
              </Label>
              <FormControl>
                <Input
                  {...field}
                  id="contact"
                  type={method === "email" ? "email" : "tel"}
                  placeholder={
                    method === "email"
                      ? "you@alliance.co.tz"
                      : "+255 7XX XXX XXX"
                  }
                  autoFocus
                  autoComplete={method === "email" ? "email" : "tel"}
                  className="rounded-lg border-slate-200 focus-visible:ring-[#303194]"
                />
              </FormControl>
              <p className="text-xs text-slate-400">
                {method === "email"
                  ? "A 6-digit code will be sent to your email"
                  : "A 6-digit code will be sent via SMS"}
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Hidden method field */}
        <input type="hidden" {...form.register("method")} />

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#ed4348] hover:bg-[#d93a3f] text-white rounded-lg py-6 font-semibold"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              Send Magic Link
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
