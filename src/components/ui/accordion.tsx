"use client"

import * as React from "react"
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props & { className?: string }) {
  return <AccordionPrimitive.Root data-slot="accordion" className={className} {...props} />
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props & { className?: string }) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("rounded-lg border border-slate-200 bg-white", className)}
      {...props}
    />
  )
}

function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props & { className?: string }) {
  return (
    <AccordionPrimitive.Header className="w-full">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800",
          className
        )}
        {...props}
      >
        <span>{children}</span>
        <ChevronDownIcon className="size-4 text-slate-500 transition-transform duration-200 group-data-[panel-open]:rotate-180" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props & { className?: string }) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className={cn(
        "overflow-hidden border-t border-slate-200 px-4 text-sm data-[ending-style]:animate-accordion-up data-[starting-style]:animate-accordion-down",
        className
      )}
      {...props}
    >
      <div className="py-3">{children}</div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
