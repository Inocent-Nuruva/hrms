"use client"

import * as React from "react"
import { SearchBox, type SearchBoxProps } from "@fluentui/react-components"
import { SearchSparkle20Color } from "@fluentui/react-icons"

export const FluentSearchBox = React.forwardRef<HTMLInputElement, SearchBoxProps>(
  function FluentSearchBox(props, ref) {
    const { className, ...searchProps } = props
    return (
      <span className={`relative inline-flex min-w-0 ${className ?? ""}`}>
        <SearchSparkle20Color aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-5 -translate-y-1/2" />
        <SearchBox
          {...searchProps}
          ref={ref}
          contentBefore={null}
          className="w-full max-w-none [&_input]:!pl-8"
        />
      </span>
    )
  },
)
