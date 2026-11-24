export function kpiIdentifierFromName(name: string): string {
  const slug = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  const code = /^[A-Z]/.test(slug) ? slug : `KPI_${slug}`
  return code.slice(0, 80).replace(/_+$/g, "") || "KPI"
}
