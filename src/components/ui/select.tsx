"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon, SearchIcon } from "lucide-react"

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
        "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 text-sm text-foreground whitespace-nowrap shadow-xs outline-none transition-colors select-none",
        "hover:border-foreground/20 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
        "data-placeholder:font-medium data-placeholder:text-muted-foreground",
        "not-data-placeholder:border-primary/50 not-data-placeholder:bg-primary/5 not-data-placeholder:font-semibold not-data-placeholder:text-primary",
        "data-popup-open:border-primary data-popup-open:ring-2 data-popup-open:ring-primary/20",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        "data-[size=default]:h-9 data-[size=sm]:h-8",
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:items-center",
        "dark:border-border dark:bg-background dark:hover:bg-muted/40",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-primary [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-primary" />
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
            "relative isolate z-[300] max-h-(--available-height) w-(--anchor-width) min-w-[min(100vw-2rem,16rem)] max-w-[calc(100vw-1.25rem)] origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-xl duration-150 ease-out data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          <div
            className="sticky top-0 z-20 border-b border-border bg-popover p-2"
            onKeyDown={(event) => event.stopPropagation()}
            onKeyUp={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === "Escape") {
                    return
                  }
                  event.nativeEvent.stopImmediatePropagation?.()
                }}
                onKeyUp={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                placeholder="Search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="h-8 w-full rounded-sm border border-input bg-muted/35 pr-3 pl-8 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>
          <SelectScrollUpButton />
          <SelectPrimitive.List className="p-1 text-popover-foreground">
            {children}
            <div
              data-select-empty
              className="hidden px-2 py-3 text-center text-xs text-muted-foreground"
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
        "relative flex min-h-9 w-full cursor-default items-center gap-1.5 rounded-md py-2 pr-8 pl-3 text-sm font-medium outline-hidden select-none",
        "text-popover-foreground hover:bg-muted",
        "data-highlighted:bg-muted data-highlighted:text-foreground",
        "data-selected:bg-primary data-selected:font-semibold data-selected:text-white",
        "data-selected:data-highlighted:bg-primary data-selected:data-highlighted:text-white",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...itemProps}
    >
      <SelectPrimitive.ItemText className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm font-medium">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
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
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
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
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
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
