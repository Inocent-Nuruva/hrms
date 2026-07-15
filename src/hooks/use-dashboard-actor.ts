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

export function useDashboardActor() {
  const [snapshot, setSnapshot] = React.useState<DashboardActorSnapshot>(EMPTY_SNAPSHOT)

  React.useEffect(() => {
    const syncSnapshot = () => {
      const nextSnapshot = readDashboardActorSnapshotFromBrowser()
      setSnapshot((currentSnapshot) =>
        currentSnapshot === nextSnapshot ? currentSnapshot : nextSnapshot
      )
    }

    syncSnapshot()

    return subscribeToDashboardActorSnapshot(syncSnapshot)
  }, [])

  return snapshot
}
