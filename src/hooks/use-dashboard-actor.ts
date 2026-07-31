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

function readInitialSnapshot(): DashboardActorSnapshot {
  if (typeof window === "undefined") {
    return EMPTY_SNAPSHOT
  }
  // Hydrate from session/local storage immediately so nav tabs do not flash empty
  // (ready:false) on every soft navigation remount.
  return readDashboardActorSnapshotFromBrowser()
}

export function useDashboardActor() {
  const [snapshot, setSnapshot] = React.useState<DashboardActorSnapshot>(readInitialSnapshot)

  React.useEffect(() => {
    const syncSnapshot = () => {
      const nextSnapshot = readDashboardActorSnapshotFromBrowser()
      setSnapshot((current) => {
        if (
          current.ready === nextSnapshot.ready &&
          current.accessMode === nextSnapshot.accessMode &&
          current.isAdmin === nextSnapshot.isAdmin &&
          current.permissionLabels.length === nextSnapshot.permissionLabels.length &&
          current.permissionLabels.every((label, index) => label === nextSnapshot.permissionLabels[index])
        ) {
          return current
        }
        return nextSnapshot
      })
    }

    syncSnapshot()
    return subscribeToDashboardActorSnapshot(syncSnapshot)
  }, [])

  return snapshot
}
