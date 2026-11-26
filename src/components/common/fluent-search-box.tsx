"use client"

import * as React from "react"
import { SearchBox, type SearchBoxProps } from "@fluentui/react-components"
import { SearchSparkle20Color } from "@fluentui/react-icons"

function SearchSparkleIcon() {
  const instanceId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const setIconRef = React.useCallback((node: SVGSVGElement | null) => {
    if (!node) return
    const ids = new Map<string, string>()
    node.querySelectorAll<SVGElement>("[id]").forEach((element) => {
      const originalId = element.id
      const uniqueId = `${instanceId}-${originalId}`
      ids.set(originalId, uniqueId)
      element.id = uniqueId
    })
    node.querySelectorAll<SVGElement>("[fill]").forEach((element) => {
      const fill = element.getAttribute("fill")
      const originalId = /^url\(#(.+)\)$/.exec(fill ?? "")?.[1]
      const uniqueId = originalId && ids.get(originalId)
      if (uniqueId) element.setAttribute("fill", `url(#${uniqueId})`)
    })
  }, [instanceId])

  return <SearchSparkle20Color ref={setIconRef} aria-hidden="true" className="size-5 shrink-0" />
}

export const FluentSearchBox = React.forwardRef<HTMLInputElement, SearchBoxProps>(
  function FluentSearchBox(props, ref) {
    const { className, ...searchProps } = props
    return (
      <span className={`inline-flex min-w-0 ${className ?? ""}`}>
        <SearchBox
          {...searchProps}
          ref={ref}
          contentBefore={<SearchSparkleIcon />}
          className="w-full max-w-none"
        />
      </span>
    )
  },
)
