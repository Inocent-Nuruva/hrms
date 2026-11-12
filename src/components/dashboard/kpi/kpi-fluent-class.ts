/** Preserve layout utilities while leaving control colors, borders and focus to Fluent UI. */
export function fluentControlClass(value = "") {
  return value.split(/\s+/).filter((part) => part && !/^(?:dark:|hover:|focus:)?(?:bg-|text-(?:white|black|red|green|blue|amber|slate|primary|destructive)|border-(?:slate|red|green|blue|amber)|rounded(?:-|$)|shadow(?:-|$))/.test(part)).join(" ")
}
