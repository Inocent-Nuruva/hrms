"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex min-w-0 flex-1 truncate text-left text-inherit", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-full min-w-0 items-center justify-between gap-1 rounded-lg border border-input bg-white px-3 py-2 text-sm text-slate-900 whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-slate-500 data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-900 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:data-placeholder:text-slate-400 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  const [query, setQuery] = React.useState("")
  const popupRef = React.useRef<HTMLDivElement | null>(null)
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    const popup = popupRef.current
    if (!popup) {
      return
    }
    const items = popup.querySelectorAll<HTMLElement>('[data-slot="select-item"]')
    const loweredQuery = query.trim().toLowerCase()
    let visibleCount = 0
    items.forEach((item) => {
      const haystack = (
        item.getAttribute("data-search-text") ||
        item.textContent ||
        ""
      ).toLowerCase()
      const matches = !loweredQuery || haystack.includes(loweredQuery)
      item.style.display = matches ? "flex" : "none"
      if (matches) {
        visibleCount += 1
      }
    })
    const emptyState = popup.querySelector<HTMLElement>("[data-select-empty]")
    if (emptyState) {
      emptyState.style.display = visibleCount === 0 ? "block" : "none"
    }
  }, [query, children])

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-[300]"
      >
        <SelectPrimitive.Popup
          ref={popupRef}
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn(
            "relative isolate z-[300] max-h-(--available-height) w-(--anchor-width) min-w-[min(100vw-2rem,18rem)] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-slate-200 bg-white text-slate-900 shadow-lg ring-1 ring-black/5 duration-200 ease-out data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:ring-white/10",
            className
          )}
          {...props}
        >
          <div
            className="sticky top-0 z-20 border-b border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                // Keep typing in the search box instead of select typeahead/close.
                event.stopPropagation()
                if (event.key === "Escape") {
                  return
                }
                event.nativeEvent.stopImmediatePropagation?.()
              }}
              onKeyUp={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              placeholder="Search..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1 text-slate-900 dark:text-slate-100">
            {children}
            <div
              data-select-empty
              className="hidden px-2 py-3 text-center text-xs text-slate-500"
            >
              No matches
            </div>
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props & { "data-search-text"?: string }) {
  const {
    "data-search-text": dataSearchTextProp,
    ...itemProps
  } = props as SelectPrimitive.Item.Props & { "data-search-text"?: string }

  const searchTextFromChildren =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : undefined

  // Prefer explicit data-search-text so complex item labels stay filterable.
  const resolvedSearchText =
    (typeof dataSearchTextProp === "string" && dataSearchTextProp.trim()
      ? dataSearchTextProp.trim()
      : undefined) ?? searchTextFromChildren

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      data-search-text={resolvedSearchText}
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-2 pr-8 pl-2.5 text-sm font-medium text-slate-900 outline-hidden select-none",
        "hover:bg-slate-100 hover:text-slate-900",
        "data-highlighted:bg-slate-100 data-highlighted:text-slate-900",
        "focus:bg-slate-100 focus:text-slate-900",
        "dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-100",
        "dark:data-highlighted:bg-slate-800 dark:data-highlighted:text-slate-100",
        "dark:focus:bg-slate-800 dark:focus:text-slate-100",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      style={{ color: "inherit" }}
      {...itemProps}
    >
      <SelectPrimitive.ItemText className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm font-medium text-slate-900 dark:text-slate-100">
        <span className="text-slate-900 dark:text-slate-100">{children}</span>
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-slate-700 dark:text-slate-200" />
        }
      >
        <CheckIcon className="pointer-events-none size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-white py-1 text-slate-700 dark:bg-slate-900 dark:text-slate-200 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-white py-1 text-slate-700 dark:bg-slate-900 dark:text-slate-200 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
