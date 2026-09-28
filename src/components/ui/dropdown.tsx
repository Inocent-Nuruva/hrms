"use client"

import {
  Dropdown as FluentDropdown,
  Option,
  type DropdownProps,
  type OptionProps,
} from "@fluentui/react-components"

/** Shared Fluent UI dropdown used by app forms and filters. */
function Dropdown(props: DropdownProps) {
  return <FluentDropdown appearance="outline" {...props} />
}

export { Dropdown, Option }
export type { DropdownProps, OptionProps }
