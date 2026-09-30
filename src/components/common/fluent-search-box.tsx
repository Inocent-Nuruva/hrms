"use client"

import * as React from "react"
import { SearchBox, type SearchBoxProps } from "@fluentui/react-components"
import { SearchSparkle20Regular } from "@fluentui/react-icons"

export const FluentSearchBox = React.forwardRef<HTMLInputElement, SearchBoxProps>(
  function FluentSearchBox(props, ref) {
    return (
      <SearchBox
        {...props}
        ref={ref}
        contentBefore={<SearchSparkle20Regular aria-hidden="true" />}
      />
    )
  },
)
