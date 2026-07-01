import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const COUNTRY_STATES_URL = "https://countriesnow.space/api/v0.1/countries/states"
const STATE_CITIES_URL = "https://countriesnow.space/api/v0.1/countries/state/cities/q"

type CountryStateRecord = {
  name: string
  iso2?: string
  iso3?: string
  states?: Array<{
    name: string
    state_code?: string
  }>
}

type CountryStatesPayload = {
  error?: boolean
  msg?: string
  data?: CountryStateRecord[]
}

type CitiesPayload = {
  error?: boolean
  msg?: string
  data?: string[]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")?.trim() ?? "country-states"

  try {
    if (type === "country-states") {
      const response = await fetch(COUNTRY_STATES_URL, { cache: "no-store" })
      if (!response.ok) {
        return NextResponse.json({ error: "Failed to load locations." }, { status: response.status })
      }

      const payload = (await response.json()) as CountryStatesPayload
      if (payload.error || !Array.isArray(payload.data)) {
        return NextResponse.json({ error: payload.msg || "Failed to load locations." }, { status: 502 })
      }

      return NextResponse.json({
        data: payload.data,
      })
    }

    if (type === "cities") {
      const country = searchParams.get("country")?.trim() ?? ""
      const state = searchParams.get("state")?.trim() ?? ""

      if (!country || !state) {
        return NextResponse.json({ error: "Country and state are required." }, { status: 400 })
      }

      const upstream = new URL(STATE_CITIES_URL)
      upstream.searchParams.set("country", country)
      upstream.searchParams.set("state", state)

      const response = await fetch(upstream, { cache: "no-store" })
      if (!response.ok) {
        return NextResponse.json({ error: "Failed to load cities." }, { status: response.status })
      }

      const payload = (await response.json()) as CitiesPayload
      if (payload.error || !Array.isArray(payload.data)) {
        return NextResponse.json({ data: [] })
      }

      return NextResponse.json({
        data: payload.data,
      })
    }

    return NextResponse.json({ error: "Unsupported location request." }, { status: 400 })
  } catch {
    return NextResponse.json({ error: "Location service unavailable." }, { status: 502 })
  }
}
