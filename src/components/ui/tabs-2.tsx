"use client"

import { useRouter } from "next/navigation"
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
