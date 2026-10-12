"use client"

import * as React from "react"
import {
  Dropdown,
  Option,
  makeStyles,
  useId,
} from "@fluentui/react-components"

const useStyles = makeStyles({
  root: {
    display: "grid",
    justifyItems: "start",
    gap: "2px",
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
  },
})

export type FluentSelectOption = {
  value: string
  label: string
  disabled?: boolean
}

export function FluentSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "Select",
  disabled,
  id,
  ariaLabel,
  className,
  size = "medium",
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  options: FluentSelectOption[]
  placeholder?: string
  disabled?: boolean
  id?: string
  ariaLabel?: string
  className?: string
  size?: "small" | "medium" | "large"
}) {
  const styles = useStyles()
  const generatedId = useId("dropdown")
  const dropdownId = id ?? generatedId
  const selected = options.find((option) => option.value === value)

  return (
    <div className={`${styles.root} ${className ?? ""}`.trim()}>
      {label ? (
        <label className={styles.label} htmlFor={dropdownId}>
          {label}
        </label>
      ) : null}
      <Dropdown
        id={dropdownId}
        aria-label={ariaLabel ?? label}
        size={size}
        className={`!w-full !min-w-0 ${size === "small" ? "[&>button]:!px-[7px] [&>button]:!py-[7px]" : ""}`}
        placeholder={placeholder}
        value={selected?.label ?? ""}
        selectedOptions={selected ? [selected.value] : []}
        disabled={disabled}
        onOptionSelect={(_event, data) => onChange(data.optionValue ?? "")}
      >
        {options.map((option) => (
          <Option key={option.value || option.label} value={option.value} text={option.label} disabled={option.disabled}>
            {option.label}
          </Option>
        ))}
      </Dropdown>
    </div>
  )
}
