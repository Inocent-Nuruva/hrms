"use client"

import * as React from "react"
import { Dropdown, Option, useId } from "@fluentui/react-components"

import { cn } from "@/lib/utils"

type SelectSize = "sm" | "default"

type SelectOption = {
  value: string
  label: React.ReactNode
  text: string
  disabled?: boolean
}

type SelectTriggerProps = {
  className?: string
  controlClassName?: string
  size?: SelectSize
  id?: string
  disabled?: boolean
  title?: string
  "aria-label"?: string
  children?: React.ReactNode
}

type SelectValueProps = {
  placeholder?: string
  children?: React.ReactNode | ((value: string | null) => React.ReactNode)
}

type SelectItemProps = {
  value: string
  disabled?: boolean
  children?: React.ReactNode
  className?: string
  "data-search-text"?: string
}

type SelectProps = {
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  disabled?: boolean
  name?: string
  required?: boolean
  children?: React.ReactNode
}

function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join("")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return nodeText(node.props.children)
  }
  return ""
}

function walkElements(
  node: React.ReactNode,
  visit: (element: React.ReactElement) => void,
) {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return
    visit(child)
    const props = child.props as { children?: React.ReactNode }
    if (props?.children) walkElements(props.children, visit)
  })
}

function collectSelect(children: React.ReactNode) {
  const items: SelectOption[] = []
  let placeholder: string | undefined
  let trigger: SelectTriggerProps = {}

  walkElements(children, (element) => {
    if (element.type === SelectTrigger) {
      trigger = element.props as SelectTriggerProps
    }
    if (element.type === SelectValue) {
      const props = element.props as SelectValueProps
      if (props.placeholder) placeholder = props.placeholder
    }
    if (element.type === SelectItem) {
      const props = element.props as SelectItemProps
      const text = props["data-search-text"]?.trim() || nodeText(props.children) || props.value
      items.push({
        value: String(props.value),
        label: props.children,
        text,
        disabled: props.disabled,
      })
    }
  })

  return { items, placeholder, trigger }
}

function layoutClass(className?: string) {
  if (!className) return "w-full"
  const kept = className.split(/\s+/).filter((token) =>
    /^(?:!|sm:|md:|lg:|xl:|2xl:)?(?:w-|min-w-|max-w-|shrink-|grow-|basis-|flex-none|flex-1)/.test(token),
  )
  return cn("min-w-0", kept.length > 0 ? kept : "w-full")
}

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  required,
  children,
}: SelectProps) {
  const generatedId = useId("dropdown")
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "")
  const selectedValue = value != null && value !== "" ? String(value) : value === "" ? "" : uncontrolled
  const { items, placeholder, trigger } = collectSelect(children)
  const selected = items.find((item) => item.value === selectedValue)
  const dropdownId = trigger.id || generatedId

  return (
    <div className={cn("grid justify-items-start gap-0.5", layoutClass(trigger.className))}>
      <Dropdown
        id={dropdownId}
        aria-label={trigger["aria-label"]}
        title={trigger.title}
        placeholder={placeholder || "Select"}
        value={selected?.text ?? ""}
        selectedOptions={selected ? [selected.value] : []}
        disabled={disabled || trigger.disabled}
        aria-required={required || undefined}
        size={trigger.size === "sm" ? "small" : "medium"}
        className={cn("!w-full !min-w-0", trigger.className, trigger.controlClassName)}
        onOptionSelect={(_event, data) => {
          const next = data.optionValue ?? null
          if (value === undefined) setUncontrolled(next ?? "")
          onValueChange?.(next)
        }}
      >
        {items.map((item) => (
          <Option key={item.value} value={item.value} text={item.text} disabled={item.disabled}>
            {item.label}
          </Option>
        ))}
      </Dropdown>
      {name ? <input type="hidden" name={name} value={selectedValue ?? ""} /> : null}
    </div>
  )
}

function SelectGroup({ children }: { children?: React.ReactNode; className?: string }) {
  return <>{children}</>
}

function SelectValue(props: SelectValueProps) {
  void props
  return null
}

function SelectTrigger(props: SelectTriggerProps & Record<string, unknown>) {
  void props
  return null
}

function SelectContent(props: { children?: React.ReactNode; className?: string } & Record<string, unknown>) {
  void props
  return null
}

function SelectLabel({ children }: { children?: React.ReactNode; className?: string }) {
  return <>{children}</>
}

function SelectItem(props: SelectItemProps & Record<string, unknown>) {
  void props
  return null
}

function SelectSeparator() {
  return null
}

function SelectScrollUpButton() {
  return null
}

function SelectScrollDownButton() {
  return null
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
