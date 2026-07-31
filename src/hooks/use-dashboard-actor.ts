"use client"

import * as React from "react"

import {
  type DashboardActorSnapshot,
  readDashboardActorSnapshotFromBrowser,
  subscribeToDashboardActorSnapshot,
} from "@/lib/dashboard-permissions"

const EMPTY_SNAPSHOT: DashboardActorSnapshot = {
  permissionLabels: [],
  accessMode: "employee",
  isAdmin: false,
  ready: false,
  version: 0,
}

function snapshotsEqual(a: DashboardActorSnapshot, b: DashboardActorSnapshot) {
  return (
    a.ready === b.ready &&
    a.accessMode === b.accessMode &&
    a.isAdmin === b.isAdmin &&
    a.permissionLabels.length === b.permissionLabels.length &&
    a.permissionLabels.every((label, index) => label === b.permissionLabels[index])
  )
}

/**
 * Dashboard actor (permissions + access mode).
 *
 * Initial state is always the empty snapshot so SSR HTML matches the first
 * client render (reading sessionStorage in useState caused hydration mismatches).
 * Browser storage is applied in an effect after mount.
 */
export function useDashboardActor() {
  const [snapshot, setSnapshot] = React.useState<DashboardActorSnapshot>(EMPTY_SNAPSHOT)

  React.useEffect(() => {
    const syncSnapshot = () => {
      const nextSnapshot = readDashboardActorSnapshotFromBrowser()
      setSnapshot((current) => (snapshotsEqual(current, nextSnapshot) ? current : nextSnapshot))
    }

    syncSnapshot()
    return subscribeToDashboardActorSnapshot(syncSnapshot)
  }, [])

  return snapshot
}
