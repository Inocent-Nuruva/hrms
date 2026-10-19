"use client"

import * as React from "react"
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMapEvents } from "react-leaflet"
import type { LatLngExpression } from "leaflet"
import "leaflet/dist/leaflet.css"

const ATTENDANCE_MAP_TILE_URL = process.env.NEXT_PUBLIC_ATTENDANCE_MAP_TILE_URL?.trim() ?? ""
const ATTENDANCE_MAP_TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_ATTENDANCE_MAP_TILE_ATTRIBUTION?.trim() ?? ""
const ATTENDANCE_MAP_TILES_ENABLED =
  ATTENDANCE_MAP_TILE_URL.startsWith("https://") && Boolean(ATTENDANCE_MAP_TILE_ATTRIBUTION)

export type AttendanceMapPoint = { latitude: number; longitude: number }

function MapClickHandler({
  editable,
  onPick,
}: {
  editable: boolean
  onPick?: (point: AttendanceMapPoint) => void
}) {
  useMapEvents({
    click(event) {
      if (editable) onPick?.({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })
  return null
}

export function AttendanceLocationMap({
  center,
  radiusMeters,
  polygon = [],
  markers = [],
  editable = false,
  onPick,
  height = 320,
}: {
  center: AttendanceMapPoint
  radiusMeters?: number
  polygon?: AttendanceMapPoint[]
  markers?: Array<AttendanceMapPoint & { label?: string }>
  editable?: boolean
  onPick?: (point: AttendanceMapPoint) => void
  height?: number
}) {
  const position: LatLngExpression = [center.latitude, center.longitude]
  const polygonPositions: LatLngExpression[] = polygon.map((point) => [point.latitude, point.longitude])
  if (!ATTENDANCE_MAP_TILES_ENABLED) {
    return (
      <div className="grid place-content-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-5 text-center" style={{ minHeight: height }} role="status">
        <p className="text-sm font-medium">Map tiles are disabled</p>
        <p className="text-xs text-muted-foreground">Configure an organization-approved HTTPS tile URL and its attribution to load a map. Coordinates remain available in the attendance record and geofence fields.</p>
        <p className="font-mono text-xs text-muted-foreground">{center.latitude.toFixed(6)}, {center.longitude.toFixed(6)}</p>
      </div>
    )
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer center={position} zoom={16} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution={ATTENDANCE_MAP_TILE_ATTRIBUTION}
          url={ATTENDANCE_MAP_TILE_URL}
        />
        <MapClickHandler editable={editable} onPick={onPick} />
        {radiusMeters && radiusMeters > 0 ? (
          <Circle center={position} radius={radiusMeters} pathOptions={{ color: "#2563eb", fillOpacity: 0.12 }} />
        ) : null}
        {polygonPositions.length > 0 ? (
          <Polygon positions={polygonPositions} pathOptions={{ color: "#7c3aed", fillOpacity: 0.14 }} />
        ) : null}
        {editable ? <Marker position={position} /> : null}
        {markers.map((marker, index) => (
          <Marker key={`${marker.latitude}:${marker.longitude}:${index}`} position={[marker.latitude, marker.longitude]}>
            {marker.label ? <Popup>{marker.label}</Popup> : null}
          </Marker>
        ))}
      </MapContainer>
      {editable ? <p className="bg-card px-3 py-2 text-xs text-muted-foreground">Click the map to set a circle center or add polygon points.</p> : null}
    </div>
  )
}

export function AttendanceGeofenceMapEditor({
  type,
  latitude,
  longitude,
  radiusMeters,
  polygonCoordinates,
  onChange,
}: {
  type: string
  latitude: string
  longitude: string
  radiusMeters: string
  polygonCoordinates: string
  onChange: (values: { latitude?: string; longitude?: string; polygonCoordinates: string }) => void
}) {
  const center = React.useMemo(() => {
    const lat = Number(latitude)
    const lng = Number(longitude)
    return Number.isFinite(lat) && Number.isFinite(lng)
      ? { latitude: lat, longitude: lng }
      : { latitude: -6.7924, longitude: 39.2083 }
  }, [latitude, longitude])
  const polygon = React.useMemo<AttendanceMapPoint[]>(() => {
    try {
      const value: unknown = JSON.parse(polygonCoordinates || "[]")
      return Array.isArray(value)
        ? value.filter((point): point is AttendanceMapPoint =>
            typeof point === "object" && point !== null &&
            "latitude" in point && "longitude" in point &&
            typeof point.latitude === "number" && typeof point.longitude === "number")
        : []
    } catch {
      return []
    }
  }, [polygonCoordinates])

  const addPoint = (point: AttendanceMapPoint) => {
    if (type === "POLYGON") {
      onChange({ polygonCoordinates: JSON.stringify([...polygon, point]) })
      return
    }
    onChange({ latitude: point.latitude.toFixed(7), longitude: point.longitude.toFixed(7), polygonCoordinates })
  }

  return (
    <section className="grid gap-2 [grid-column:1/-1]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Choose location on map</p>
        {type === "POLYGON" ? (
          <button type="button" className="text-xs underline" onClick={() => onChange({ polygonCoordinates: "[]" })}>Clear polygon points</button>
        ) : null}
      </div>
      <AttendanceLocationMap
        center={center}
        radiusMeters={type === "CIRCLE" ? Number(radiusMeters) : undefined}
        polygon={polygon}
        editable
        onPick={addPoint}
        height={300}
      />
      {type === "POLYGON" ? <p className="text-xs text-muted-foreground">{polygon.length} point(s) selected. Add at least 3 points in boundary order.</p> : null}
    </section>
  )
}
