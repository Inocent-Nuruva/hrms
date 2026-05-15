"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type AccordionContextValue = {
  openValues: string[]
  toggle: (value: string) => void
  keepRendered: boolean
  showArrow: boolean
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null)
const AccordionItemContext = React.createContext<string | null>(null)

export function Accordion({
  children,
  className,
  multiple = false,
}: {
  children: React.ReactNode
  className?: string
  multiple?: boolean
}) {
  const [openValues, setOpenValues] = React.useState<string[]>([])

  const toggle = React.useCallback(
    (value: string) => {
      setOpenValues((previous) => {
        const isOpen = previous.includes(value)
        if (multiple) {
          return isOpen ? previous.filter((item) => item !== value) : [...previous, value]
        }
        return isOpen ? [] : [value]
      })
    },
    [multiple]
  )

  return (
    <AccordionContext.Provider value={{ openValues, toggle, keepRendered: false, showArrow: true }}>
      <div className={cn("w-full", className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

export function AccordionItem({
  children,
  value,
  className,
}: {
  children: React.ReactNode
  value: string
  className?: string
}) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div className={cn("rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60", className)}>{children}</div>
    </AccordionItemContext.Provider>
  )
}

export function AccordionTrigger({
  children,
  className,
  showArrow = true,
}: {
  children: React.ReactNode
  className?: string
  showArrow?: boolean
}) {
  const ctx = React.useContext(AccordionContext)
  const itemValue = React.useContext(AccordionItemContext)

  if (!ctx || !itemValue) {
    return null
  }

  const isOpen = ctx.openValues.includes(itemValue)

  return (
    <button
      type="button"
      onClick={() => ctx.toggle(itemValue)}
      className={cn("group flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-slate-100", className)}
      aria-expanded={isOpen}
    >
      <span>{children}</span>
      {showArrow ? (
        <ChevronDownIcon className={cn("size-4 text-slate-500 transition-transform duration-200 dark:text-slate-400", isOpen ? "rotate-180" : "rotate-0")} />
      ) : null}
    </button>
  )
}

export function AccordionPanel({
  children,
  className,
  keepRendered = false,
}: {
  children: React.ReactNode
  className?: string
  keepRendered?: boolean
}) {
  const ctx = React.useContext(AccordionContext)
  const itemValue = React.useContext(AccordionItemContext)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = React.useState<number>(0)
  const isReady = Boolean(ctx && itemValue)
  const isOpen = isReady ? ctx!.openValues.includes(itemValue as string) : false

  React.useEffect(() => {
    if (!contentRef.current || !isReady) {
      return
    }
    setHeight(contentRef.current.scrollHeight)
  }, [children, isOpen, isReady])

  if (!isReady) {
    return null
  }

  if (!keepRendered && !isOpen) {
    return null
  }

  return (
    <div
      className={cn("overflow-hidden border-t border-slate-200 transition-all duration-300 ease-out dark:border-slate-700", className)}
      style={{ maxHeight: isOpen ? `${height || 1200}px` : "0px", opacity: isOpen ? 1 : 0 }}
    >
      <div ref={contentRef} className="px-4 py-3">
        {children}
      </div>
    </div>
  )
}
