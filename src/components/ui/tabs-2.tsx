"use client"

import { useRouter } from "next/navigation"
import {
  ArrowSync20Regular,
  ArrowExit20Regular,
  Building20Regular,
  CalendarLtr20Regular,
  ClipboardTask20Regular,
  DeviceEq20Regular,
  DocumentAdd20Regular,
  DocumentEdit20Regular,
  Door20Regular,
  DoorArrowRight20Regular,
  Document20Regular,
  History20Regular,
  Key20Regular,
  PeopleCommunity20Regular,
  Person20Regular,
  PersonFeedback20Regular,
  PersonAdd20Regular,
  PersonProhibited20Regular,
  PeopleTeam20Regular,
  ShieldKeyhole20Regular,
  Code20Regular,
  ArrowTrendingLines20Regular,
  ChartMultiple20Regular,
  DocumentText20Regular,
  Gauge20Regular,
  Target20Regular,
  Trophy20Regular,
} from "@fluentui/react-icons"
import {
  CounterBadge,
  makeStyles,
  Tab,
  TabList,
  tokens,
  type SelectTabData,
} from "@fluentui/react-components"

import type { DashboardSectionTabGroup } from "@/lib/dashboard-sections"
import { useNotificationAttentionRoutes } from "@/hooks/use-notification-attention"
import { routesNeedAttention } from "@/lib/notification-attention"
import { cn } from "@/lib/utils"

const ACCESS_CONTROL_TAB_ICONS = {
  "/dashboard/access-control/devices": [DeviceEq20Regular, ""],
  "/dashboard/access-control/doors": [Door20Regular, ""],
  "/dashboard/access-control/templates": [Document20Regular, ""],
  "/dashboard/access-control/week-plans": [CalendarLtr20Regular, ""],
  "/dashboard/access-control/organizations": [Building20Regular, ""],
  "/dashboard/access-control/groups": [PeopleTeam20Regular, ""],
  "/dashboard/access-control/access-credentials": [Key20Regular, ""],
  "/dashboard/access-control/audit-logs": [ClipboardTask20Regular, ""],
  "/dashboard/access-control/device-command-logs": [Code20Regular, ""],
  "/dashboard/access-control/hikvision-sync-logs": [ArrowSync20Regular, ""],
  "/dashboard/roles": [PeopleTeam20Regular, ""],
  "/dashboard/permissions": [ShieldKeyhole20Regular, ""],
  "/dashboard/employees/all": [PeopleTeam20Regular, ""],
  "/dashboard/employees/inactive": [PersonProhibited20Regular, ""],
  "/dashboard/employees/registration": [PersonAdd20Regular, ""],
  "/dashboard/employees/onboarding": [DocumentAdd20Regular, ""],
  "/dashboard/employees/profile-update-approvals": [DocumentEdit20Regular, ""],
  "/dashboard/employees/profile-change-requests": [PersonFeedback20Regular, ""],
  "/dashboard/employees/offboarding": [DoorArrowRight20Regular, ""],
  "/dashboard/me/profile": [Person20Regular, ""],
  "/dashboard/me/organization": [Building20Regular, ""],
  "/dashboard/me/requests/actions": [ClipboardTask20Regular, ""],
  "/dashboard/me/requests/timeline": [History20Regular, ""],
  "/dashboard/me/requests/documents": [Document20Regular, ""],
  "/dashboard/me/requests/profile-changes": [PersonFeedback20Regular, ""],
  "/dashboard/me/requests/resignation": [ArrowExit20Regular, ""],
  "/dashboard/me/onboarding": [DocumentAdd20Regular, ""],
  "/dashboard/me/offboarding": [DoorArrowRight20Regular, ""],
  "/dashboard/me/team/overview": [PeopleCommunity20Regular, ""],
  "/dashboard/me/team/members": [PeopleTeam20Regular, ""],
  "/dashboard/me/team/attendance": [CalendarLtr20Regular, ""],
  "/dashboard/me/team/actions": [ClipboardTask20Regular, ""],
  "/dashboard/me/performance/overview": [ChartMultiple20Regular, ""],
  "/dashboard/me/performance/kpis": [Target20Regular, ""],
  "/dashboard/me/performance/assignments": [ClipboardTask20Regular, ""],
  "/dashboard/me/performance/reviews": [DocumentText20Regular, ""],
  "/dashboard/me/performance/achievements": [Trophy20Regular, ""],
  "/dashboard/me/performance/improvement": [ArrowTrendingLines20Regular, ""],
  "/dashboard/me/performance/team": [PeopleTeam20Regular, ""],
  "/dashboard/me/performance/manager-kpis": [Gauge20Regular, ""],
  "/dashboard/performance/overview": [ChartMultiple20Regular, ""],
  "/dashboard/performance/setup": [Gauge20Regular, ""],
  "/dashboard/performance/plans": [Target20Regular, ""],
  "/dashboard/performance/reviews": [DocumentText20Regular, ""],
  "/dashboard/performance/improvement": [ArrowTrendingLines20Regular, ""],
} as const

type Tabs2Props = {
  groups: DashboardSectionTabGroup[]
  currentPath: string
  className?: string
}

function isActivePath(currentPath: string, url: string) {
  return currentPath === url || currentPath.startsWith(`${url}/`)
}

const useStyles = makeStyles({
  tabList: {
    minWidth: "max-content",
  },
  tab: {
    paddingLeft: tokens.spacingHorizontalXS,
    paddingRight: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
    "&[data-fui-focus-visible]:not(:focus-visible)": {
      outline: "none",
      boxShadow: "none",
    },
  },
  tabLabel: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
    fontSize: "10px",
    lineHeight: "14px",
  },
})

export function Tabs2({ groups, currentPath, className }: Tabs2Props) {
  const router = useRouter()
  const styles = useStyles()
  const attentionUrls = useNotificationAttentionRoutes()
  const activeGroup =
    groups.find((group) => group.items.some((item) => isActivePath(currentPath, item.url))) ??
    groups[0] ??
    null
  const tabs = activeGroup?.items ?? []
  const selectedValue =
    tabs.find((item) => isActivePath(currentPath, item.url))?.url ?? ""

  const navigateToTab = (_event: unknown, data: SelectTabData) => {
    const url = String(data.value)
    if (url.startsWith("/")) router.push(url)
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-nowrap items-center border-b border-border/80",
        className,
      )}
    >
      <div className="tab-rail-scroll min-w-0 flex-1">
        <TabList
          aria-label="Section pages"
          size="small"
          selectedValue={selectedValue}
          className={styles.tabList}
          onTabSelect={navigateToTab}
        >
          {tabs.map((item) => (
            <Tab key={item.url} value={item.url} className={styles.tab}>
              <span className={styles.tabLabel}>
                {item.url in ACCESS_CONTROL_TAB_ICONS ? (() => {
                  const [Icon, color] = ACCESS_CONTROL_TAB_ICONS[item.url as keyof typeof ACCESS_CONTROL_TAB_ICONS]
                  return <Icon className={cn("size-3.5 shrink-0", color)} aria-hidden="true" />
                })() : null}
                <span>{item.title}</span>
                {routesNeedAttention([item.url], attentionUrls) ? (
                  <CounterBadge
                    dot
                    size="tiny"
                    color="danger"
                    aria-label={`${item.title} needs attention`}
                    title="Unread attention — clears when this page is opened"
                  />
                ) : null}
              </span>
            </Tab>
          ))}
        </TabList>
      </div>
    </div>
  )
}
