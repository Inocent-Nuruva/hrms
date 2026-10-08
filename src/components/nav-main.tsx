"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  CounterBadge,
  Nav,
  NavCategory,
  NavCategoryItem,
  NavItem,
  NavSubItem,
  NavSubItemGroup,
  makeStyles,
  tokens,
} from "@fluentui/react-components"
import {
  Home24Regular,
  Home24Color,
  type FluentIcon,
} from "@fluentui/react-icons"

import { useSidebar } from "@/components/ui/sidebar"
import type { AdminResourceKey } from "@/lib/admin-api"
import { routesNeedAttention } from "@/lib/notification-attention"

type NavMainNode = {
  title: string
  url?: string
  matchUrls?: string[]
  resource?: AdminResourceKey
  items?: NavMainNode[]
  disabled?: boolean
  activeIcon?: FluentIcon
}

type NavMainItem = NavMainNode & {
  icon?: FluentIcon
}

const OPEN_GROUPS_STORAGE_KEY = "hrms.sidebar.fluent-open-groups.v1"
const Home = Home24Regular
const ActiveHome = Home24Color

const useStyles = makeStyles({
  nav: {
    backgroundColor: "var(--sidebar)",
    color: tokens.colorNeutralForeground1,
    fontFamily: 'var(--font-comfortaa), "Comfortaa", sans-serif',
  },
  iconBadge: {
    display: "inline-flex",
    width: "24px",
    height: "24px",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    "& svg": {
      width: "20px",
      height: "20px",
    },
  },
  item: {
    minHeight: "32px",
    paddingInlineStart: "10px",
    paddingInlineEnd: "8px",
    columnGap: tokens.spacingHorizontalS,
    backgroundColor: "var(--sidebar)",
    color: tokens.colorNeutralForeground1,
    fontFamily: 'var(--font-comfortaa), "Comfortaa", sans-serif',
    fontSize: "12px",
    lineHeight: "16px",
    "& .fui-NavItem__icon": {
      minWidth: "18px",
      minHeight: "18px",
      fontSize: "18px",
    },
    "& .fui-NavCategoryItem__icon": {
      minWidth: "18px",
      minHeight: "18px",
      fontSize: "18px",
    },
    "& .fui-NavCategoryItem__expandIcon": {
      width: "16px",
      height: "16px",
      fontSize: "16px",
    },
    '&[data-active-category="true"] .fui-NavCategoryItem__icon': {
      color: tokens.colorCompoundBrandForeground1,
    },
    "::after": {
      width: "3px",
      marginInlineStart: "-6px",
      backgroundColor: tokens.colorBrandBackground,
    },
    ":hover": {
      backgroundColor: "var(--sidebar-accent)",
    },
  },
  subItem: {
    minHeight: "28px",
    paddingInlineStart: "38px",
    backgroundColor: "var(--sidebar)",
    color: tokens.colorNeutralForeground1,
    fontFamily: 'var(--font-comfortaa), "Comfortaa", sans-serif',
    fontSize: "11px",
    lineHeight: "16px",
    "::after": {
      width: "3px",
      marginInlineStart: "-13px",
      backgroundColor: tokens.colorBrandBackground,
    },
    ":hover": {
      backgroundColor: "var(--sidebar-accent)",
    },
  },
  label: {
    display: "flex",
    minWidth: 0,
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
  },
})

function normalizedPath(url: string) {
  const path = url.split("?")[0] ?? url
  return path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path
}

function pathMatches(url: string | undefined, currentPath: string): boolean {
  if (!url) return false
  const candidate = normalizedPath(url)
  const current = normalizedPath(currentPath)
  return current === candidate || current.startsWith(`${candidate}/`)
}

function nodeContainsCurrentPath(node: NavMainNode, currentPath: string): boolean {
  return (
    pathMatches(node.url, currentPath) ||
    (node.matchUrls ?? []).some((url) => pathMatches(url, currentPath)) ||
    (node.items ?? []).some((child) => nodeContainsCurrentPath(child, currentPath))
  )
}

function categoryValue(item: NavMainNode) {
  return `category:${item.title}`
}

function nodeNeedsAttention(node: NavMainNode, attentionUrls: string[]): boolean {
  const ownUrls = [node.url, ...(node.matchUrls ?? [])].filter(
    (url): url is string => Boolean(url),
  )
  return routesNeedAttention(ownUrls, attentionUrls) ||
    (node.items ?? []).some((child) => nodeNeedsAttention(child, attentionUrls))
}

function AttentionLabel({
  title,
  attention,
  className,
}: {
  title: string
  attention: boolean
  className: string
}) {
  return (
    <span className={className}>
      <span>{title}</span>
      {attention ? (
        <CounterBadge
          dot
          size="tiny"
          color="danger"
          aria-label={`${title} needs attention`}
          title="Unread attention — clears when its page is opened"
        />
      ) : null}
    </span>
  )
}

function collectLeafNodes(nodes: NavMainNode[]): NavMainNode[] {
  return nodes.flatMap((node) =>
    node.items?.length ? collectLeafNodes(node.items) : node.url ? [node] : [],
  )
}

function selectedNavValue(items: NavMainItem[], currentPath: string) {
  if (normalizedPath(currentPath) === "/dashboard") return "/dashboard"
  return collectLeafNodes(items)
    .map((node) => ({
      node,
      matchLength: [node.url, ...(node.matchUrls ?? [])]
        .filter((url): url is string => Boolean(url) && pathMatches(url, currentPath))
        .reduce(
          (longest, url) => Math.max(longest, normalizedPath(url).length),
          -1,
        ),
    }))
    .filter(({ matchLength }) => matchLength >= 0)
    .sort((left, right) => right.matchLength - left.matchLength)[0]?.node.url
}

function renderSubItems(
  nodes: NavMainNode[],
  subItemClassName: string,
  labelClassName: string,
  attentionUrls: string[],
): React.ReactNode {
  return nodes.map((node) => {
    const key = `${node.title}-${node.url ?? "section"}`

    if (node.items?.length) {
      return renderSubItems(node.items, subItemClassName, labelClassName, attentionUrls)
    }

    if (!node.url) return null

    return (
      <NavSubItem
        key={key}
        value={node.url}
        disabled={node.disabled}
        className={subItemClassName}
      >
        <AttentionLabel
          title={node.title}
          attention={nodeNeedsAttention(node, attentionUrls)}
          className={labelClassName}
        />
      </NavSubItem>
    )
  })
}

export function NavMain({
  items,
  attentionUrls = [],
}: {
  items: NavMainItem[]
  attentionUrls?: string[]
  activeResource?: AdminResourceKey
  onSelectResource?: (resource: AdminResourceKey) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const styles = useStyles()
  const currentPath = pathname ?? "/dashboard"
  const selectedValue = selectedNavValue(items, currentPath) ?? ""
  const selectedCategory = items.find(
    (item) => item.items?.length && nodeContainsCurrentPath(item, currentPath),
  )
  const activeCategoryValue = selectedCategory
    ? categoryValue(selectedCategory)
    : ""
  const [openCategories, setOpenCategories] = React.useState<string[]>([])

  const navigateTo = React.useCallback(
    (url: string) => {
      router.push(url)
      if (isMobile) setOpenMobile(false)
    },
    [isMobile, router, setOpenMobile],
  )

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(OPEN_GROUPS_STORAGE_KEY) ?? "[]",
      ) as unknown
      if (Array.isArray(stored)) {
        setOpenCategories(stored.filter((value): value is string => typeof value === "string"))
      }
    } catch {
      // Ignore invalid navigation preferences.
    }
  }, [])

  React.useEffect(() => {
    if (!activeCategoryValue) return
    setOpenCategories((current) =>
      current.includes(activeCategoryValue)
        ? current
        : [...current, activeCategoryValue],
    )
  }, [activeCategoryValue])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(
      OPEN_GROUPS_STORAGE_KEY,
      JSON.stringify(openCategories),
    )
  }, [openCategories])

  return (
    <Nav
      aria-label="Main navigation"
      density="small"
      multiple
      selectedValue={selectedValue}
      openCategories={openCategories}
      className={`${styles.nav} w-full min-w-0`}
      onNavCategoryItemToggle={(_event, data) => {
        const value = String(data.categoryValue ?? data.value)
        setOpenCategories((current) =>
          current.includes(value)
            ? current.filter((category) => category !== value)
            : [...current, value],
        )
      }}
      onNavItemSelect={(_event, data) => {
        const url = String(data.value)
        if (url.startsWith("/")) navigateTo(url)
      }}
    >
      <NavItem
        value="/dashboard"
        icon={<span className={styles.iconBadge} aria-hidden="true">{normalizedPath(currentPath) === "/dashboard" ? <ActiveHome /> : <Home />}</span>}
        className={styles.item}
      >
        <AttentionLabel
          title="Dashboard"
          attention={routesNeedAttention(["/dashboard"], attentionUrls)}
          className={styles.label}
        />
      </NavItem>

      {items.map((item) => {
        const isActive = nodeContainsCurrentPath(item, currentPath)
        const Icon = isActive ? item.activeIcon ?? item.icon : item.icon

        if (item.items?.length) {
          const value = categoryValue(item)
          const isActiveCategory = isActive
          return (
            <NavCategory key={value} value={value}>
              <NavCategoryItem
                icon={Icon ? <span className={styles.iconBadge} aria-hidden="true"><Icon /></span> : undefined}
                className={styles.item}
                data-active-category={isActiveCategory ? "true" : undefined}
              >
                <AttentionLabel
                  title={item.title}
                  attention={nodeNeedsAttention(item, attentionUrls)}
                  className={styles.label}
                />
              </NavCategoryItem>
              <NavSubItemGroup className="!overflow-visible">
                {renderSubItems(
                  item.items,
                  styles.subItem,
                  styles.label,
                  attentionUrls,
                )}
              </NavSubItemGroup>
            </NavCategory>
          )
        }

        if (!item.url) return null

        return (
          <NavItem
            key={`${item.title}-${item.url}`}
            value={item.url}
            icon={Icon ? <span className={styles.iconBadge} aria-hidden="true"><Icon /></span> : undefined}
            disabled={item.disabled}
            className={styles.item}
          >
            <AttentionLabel
              title={item.title}
              attention={nodeNeedsAttention(item, attentionUrls)}
              className={styles.label}
            />
          </NavItem>
        )
      })}
    </Nav>
  )
}
