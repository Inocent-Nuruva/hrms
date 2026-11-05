"use client"

import * as React from "react"
import { Dropdown, type DropdownProps } from "@fluentui/react-components"

type SelectionEvent = Parameters<
  NonNullable<DropdownProps["onOptionSelect"]>
>[0]

/** Keep API values separate from the labels displayed by the Fluent dropdown. */
export function FeedbackDropdown({
  value,
  onChange,
  children,
  disabled,
  required,
}: {
  value: string
  onChange: (event: SelectionEvent, data: { value: string }) => void
  children: React.ReactNode
  disabled?: boolean
  required?: boolean
}) {
  const options = React.Children.toArray(children)
  const selected = options.find(
    (option) =>
      React.isValidElement<{ value: string }>(option) &&
      option.props.value === value,
  )
  const label = React.isValidElement<{ children: React.ReactNode }>(selected)
    ? String(selected.props.children ?? "")
    : ""
  return (
    <Dropdown
      disabled={disabled}
      aria-required={required}
      className="w-full min-w-0"
      value={label}
      selectedOptions={selected ? [value] : []}
      onOptionSelect={(event, data) =>
        onChange(event, { value: data.optionValue ?? "" })
      }
    >
      {children}
    </Dropdown>
  )
}
