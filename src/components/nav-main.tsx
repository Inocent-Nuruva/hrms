"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  CounterBadge,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
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
  ArrowSort20Regular,
  Pin20Filled,
  Pin20Regular,
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
const PINNED_LINKS_STORAGE_KEY = "hrms.sidebar.pinned-links.v1"
const NAV_SORT_STORAGE_KEY = "hrms.sidebar.sort-order.v1"
const NAV_USAGE_STORAGE_KEY = "hrms.sidebar.link-usage.v1"
const Home = Home24Regular

const sidebarIconColors: Record<string, string> = {
  "Access Control": tokens.colorPalettePurpleForeground2,
  Attendance: tokens.colorPaletteTealForeground2,
  Branches: tokens.colorPaletteRoyalBlueForeground2,
  Companies: tokens.colorPaletteRoyalBlueForeground2,
  Departments: tokens.colorPaletteSeafoamForeground2,
  Employees: tokens.colorPaletteTealForeground2,
  Promotion: tokens.colorPaletteGreenForeground2,
  "Leave Management": tokens.colorPaletteMarigoldForeground2,
  "Performance & Activities": tokens.colorPalettePurpleForeground2,
  Probation: tokens.colorPaletteMarigoldForeground2,
  Field: tokens.colorPaletteTealForeground2,
  Finance: tokens.colorPaletteGreenForeground2,
  Movements: tokens.colorPalettePeachForeground2,
  Positions: tokens.colorPaletteRoyalBlueForeground2,
  Structure: tokens.colorPalettePurpleForeground2,
  "Invite & register": tokens.colorPaletteTealForeground2,
  Payroll: tokens.colorPaletteGreenForeground2,
  "Reports & Analytics": tokens.colorPaletteRoyalBlueForeground2,
  Notifications: tokens.colorPaletteMarigoldForeground2,
  SMS: tokens.colorPaletteTealForeground2,
  Insights: tokens.colorPalettePurpleForeground2,
  "To do": tokens.colorPaletteMarigoldForeground2,
}

const useStyles = makeStyles({
  nav: {
    backgroundColor: "var(--sidebar)",
    color: tokens.colorNeutralForeground1,
    fontFamily: 'var(--font-comfortaa), "Comfortaa", sans-serif',
  },
  iconBadge: {
    color: tokens.colorBrandForeground1,
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
    flexGrow: 1,
    minWidth: 0,
    width: "100%",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
    "&:hover button": {
      opacity: 1,
    },
  },
  pinButton: {
    display: "inline-flex",
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    padding: 0,
    border: 0,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground3,
    cursor: "pointer",
    opacity: 0,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3,
      color: tokens.colorBrandForeground1,
    },
    ":focus-visible": {
      opacity: 1,
      outlineStyle: "solid",
      outlineWidth: "2px",
      outlineColor: tokens.colorBrandStroke1,
    },
  },
  pinButtonPinned: {
    color: tokens.colorBrandForeground1,
    opacity: 1,
  },
  pinButtonFixed: {
    color: tokens.colorNeutralForeground4,
    cursor: "default",
    opacity: 1,
  },
  arranger: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "4px",
    padding: "6px 10px 3px",
  },
  sectionLabel: {
    padding: "7px 10px 3px",
    color: tokens.colorNeutralForeground3,
    fontFamily: 'var(--font-comfortaa), "Comfortaa", sans-serif',
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  arrangerButton: {
    display: "inline-flex",
    alignItems: "center",
    width: "28px",
    height: "28px",
    padding: 0,
    border: 0,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: "var(--sidebar)",
    color: tokens.colorNeutralForeground2,
    cursor: "pointer",
    fontFamily: 'var(--font-comfortaa), "Comfortaa", sans-serif',
    fontSize: "11px",
    ":hover": {
      backgroundColor: "var(--sidebar-accent)",
      color: tokens.colorNeutralForeground1,
    },
  },
})

type NavSortOrder = "alpha-asc" | "alpha-desc" | "usage" | "random"

const NAV_SORT_LABELS: Record<NavSortOrder, string> = {
  "alpha-asc": "A–Z",
  "alpha-desc": "Z–A",
  usage: "Most used",
  random: "Random",
}

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
  pinned = false,
  onTogglePin,
  pinButtonClassName,
  pinButtonPinnedClassName,
  fixedPinned = false,
  pinButtonFixedClassName,
}: {
  title: string
  attention: boolean
  className: string
  pinned?: boolean
  onTogglePin?: () => void
  pinButtonClassName?: string
  pinButtonPinnedClassName?: string
  fixedPinned?: boolean
  pinButtonFixedClassName?: string
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
      {onTogglePin ? (
        <button
          type="button"
          className={`${pinButtonClassName ?? ""} ${pinned ? pinButtonPinnedClassName ?? "" : ""}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onTogglePin()
          }}
          title={pinned ? `Unpin ${title}` : `Pin ${title}`}
          aria-label={pinned ? `Unpin ${title}` : `Pin ${title}`}
        >
          {pinned ? <Pin20Filled /> : <Pin20Regular />}
        </button>
      ) : null}
      {fixedPinned ? (
        <span
          className={`${pinButtonClassName ?? ""} ${pinButtonFixedClassName ?? ""}`}
          title="Pinned by default"
          aria-label="Pinned by default"
        >
          <Pin20Filled />
        </span>
      ) : null}
    </span>
  )
}

function collectLeafNodes(nodes: NavMainNode[]): NavMainNode[] {
  return nodes.flatMap((node) =>
    node.items?.length ? collectLeafNodes(node.items) : node.url ? [node] : [],
  )
}

function collectPinnableNodes(nodes: NavMainNode[]): NavMainNode[] {
  return nodes.flatMap((node) =>
    node.items?.length ? collectPinnableNodes(node.items) : node.url ? [node] : [],
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
  pinnedUrls: string[],
  togglePin: (url: string) => void,
  pinButtonClassName: string,
  pinButtonPinnedClassName: string,
): React.ReactNode {
  return nodes.map((node) => {
    const key = `${node.title}-${node.url ?? "section"}`

    if (node.items?.length) {
      return renderSubItems(
        node.items,
        subItemClassName,
        labelClassName,
        attentionUrls,
        pinnedUrls,
        togglePin,
        pinButtonClassName,
        pinButtonPinnedClassName,
      )
    }

    if (!node.url) return null
    if (pinnedUrls.includes(node.url)) return null

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
          onTogglePin={() => togglePin(node.url!)}
          pinButtonClassName={pinButtonClassName}
          pinButtonPinnedClassName={pinButtonPinnedClassName}
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
  const [pinnedUrls, setPinnedUrls] = React.useState<string[]>([])
  const [sortOrder, setSortOrder] = React.useState<NavSortOrder>("alpha-asc")
  const [randomOrder, setRandomOrder] = React.useState<string[]>([])
  const [linkUsage, setLinkUsage] = React.useState<Record<string, number>>({})
  const pinnableNodes = React.useMemo(() => collectPinnableNodes(items), [items])
  const todoItem = React.useMemo(() => items.find((item) => item.title === "To do"), [items])
  const pinnedItems = React.useMemo(
    () => pinnedUrls
      .map((url) => pinnableNodes.find((node) => node.url === url))
      .filter((node): node is NavMainNode & { url: string } => Boolean(node?.url)),
    [pinnableNodes, pinnedUrls],
  )
  const arrangedItems = React.useMemo(() => {
    const compareTitle = (left: NavMainItem, right: NavMainItem) =>
      left.title.localeCompare(right.title, undefined, { sensitivity: "base" })
    const next = items.filter((item) => item.title !== "To do")

    if (sortOrder === "alpha-desc") return next.sort((left, right) => compareTitle(right, left))
    if (sortOrder === "usage") {
      return next.sort((left, right) => {
        const leftUsage = [left.url, ...(left.matchUrls ?? [])]
          .filter((url): url is string => Boolean(url))
          .reduce((total, url) => total + (linkUsage[url] ?? 0), 0)
        const rightUsage = [right.url, ...(right.matchUrls ?? [])]
          .filter((url): url is string => Boolean(url))
          .reduce((total, url) => total + (linkUsage[url] ?? 0), 0)
        return rightUsage - leftUsage || compareTitle(left, right)
      })
    }
    if (sortOrder === "random") {
      const position = new Map(randomOrder.map((title, index) => [title, index]))
      return next.sort((left, right) =>
        (position.get(left.title) ?? Number.MAX_SAFE_INTEGER) -
        (position.get(right.title) ?? Number.MAX_SAFE_INTEGER),
      )
    }
    return next.sort(compareTitle)
  }, [items, linkUsage, randomOrder, sortOrder])

  const navigateTo = React.useCallback(
    (url: string) => {
      setLinkUsage((current) => ({ ...current, [url]: (current[url] ?? 0) + 1 }))
      router.push(url)
      if (isMobile) setOpenMobile(false)
    },
    [isMobile, router, setOpenMobile],
  )

  const togglePin = React.useCallback((url: string) => {
    setPinnedUrls((current) =>
      current.includes(url) ? current.filter((item) => item !== url) : [...current, url],
    )
  }, [])

  const applySortOrder = React.useCallback((nextOrder: NavSortOrder) => {
    setSortOrder(nextOrder)
    if (nextOrder === "random") {
      setRandomOrder((current) => {
        const source = current.length === items.length ? [...current] : items.map((item) => item.title)
        for (let index = source.length - 1; index > 0; index -= 1) {
          const target = Math.floor(Math.random() * (index + 1))
          ;[source[index], source[target]] = [source[target]!, source[index]!]
        }
        return source
      })
    }
  }, [items])

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
    if (typeof window === "undefined") return
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(PINNED_LINKS_STORAGE_KEY) ?? "[]",
      ) as unknown
      if (Array.isArray(stored)) {
        setPinnedUrls(
          stored.filter(
            (value): value is string =>
              typeof value === "string" && pinnableNodes.some((node) => node.url === value),
          ),
        )
      }
    } catch {
      // Ignore invalid navigation preferences.
    }
  }, [pinnableNodes])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const storedSort = window.localStorage.getItem(NAV_SORT_STORAGE_KEY)
    if (storedSort === "alpha-asc" || storedSort === "alpha-desc" || storedSort === "usage") {
      setSortOrder(storedSort)
    }
    try {
      const storedUsage = JSON.parse(window.localStorage.getItem(NAV_USAGE_STORAGE_KEY) ?? "{}") as unknown
      if (storedUsage && typeof storedUsage === "object" && !Array.isArray(storedUsage)) {
        setLinkUsage(
          Object.fromEntries(
            Object.entries(storedUsage).filter(([, value]) => typeof value === "number" && value >= 0),
          ),
        )
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

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(PINNED_LINKS_STORAGE_KEY, JSON.stringify(pinnedUrls))
  }, [pinnedUrls])

  React.useEffect(() => {
    if (typeof window === "undefined" || sortOrder === "random") return
    window.localStorage.setItem(NAV_SORT_STORAGE_KEY, sortOrder)
  }, [sortOrder])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(NAV_USAGE_STORAGE_KEY, JSON.stringify(linkUsage))
  }, [linkUsage])

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
      <div className={styles.sectionLabel}>Favourites</div>
      <NavItem
        value="/dashboard"
        icon={<span className={styles.iconBadge} aria-hidden="true"><Home /></span>}
        className={styles.item}
      >
        <AttentionLabel
          title="Dashboard"
          attention={routesNeedAttention(["/dashboard"], attentionUrls)}
          className={styles.label}
          fixedPinned
          pinButtonClassName={styles.pinButton}
          pinButtonFixedClassName={styles.pinButtonFixed}
        />
      </NavItem>

      {todoItem?.items?.length ? (() => {
        const isActive = nodeContainsCurrentPath(todoItem, currentPath)
        const Icon = todoItem.icon
        const value = categoryValue(todoItem)
        return (
          <NavCategory key={value} value={value}>
            <NavCategoryItem
              icon={Icon ? <span className={styles.iconBadge} style={{ color: sidebarIconColors[todoItem.title] ?? tokens.colorBrandForeground1 }} aria-hidden="true"><Icon /></span> : undefined}
              className={styles.item}
              data-active-category={isActive ? "true" : undefined}
            >
              <AttentionLabel
                title={todoItem.title}
                attention={nodeNeedsAttention(todoItem, attentionUrls)}
                className={styles.label}
                fixedPinned
                pinButtonClassName={styles.pinButton}
                pinButtonFixedClassName={styles.pinButtonFixed}
              />
            </NavCategoryItem>
            <NavSubItemGroup className="!overflow-visible">
              {renderSubItems(
                todoItem.items,
                styles.subItem,
                styles.label,
                attentionUrls,
                pinnedUrls,
                togglePin,
                styles.pinButton,
                styles.pinButtonPinned,
              )}
            </NavSubItemGroup>
          </NavCategory>
        )
      })() : null}

      {pinnedItems.map((item) => (
        <NavItem
          key={`pinned-${item.url}`}
          value={item.url}
          icon={<span className={styles.iconBadge} style={{ color: tokens.colorBrandForeground1 }} aria-hidden="true"><Pin20Filled /></span>}
          className={styles.item}
        >
          <AttentionLabel
            title={item.title}
            attention={nodeNeedsAttention(item, attentionUrls)}
            className={styles.label}
            pinned
            onTogglePin={() => togglePin(item.url!)}
            pinButtonClassName={styles.pinButton}
            pinButtonPinnedClassName={styles.pinButtonPinned}
          />
        </NavItem>
      ))}

      <div className={styles.arranger}>
        <span className={styles.sectionLabel} style={{ padding: 0 }}>All workspaces</span>
        <Menu>
          <MenuTrigger disableButtonEnhancement>
            <button
              type="button"
              className={styles.arrangerButton}
              aria-label={`Arrange navigation links, currently ${NAV_SORT_LABELS[sortOrder]}`}
              title={`Arrange links (${NAV_SORT_LABELS[sortOrder]})`}
            >
              <ArrowSort20Regular />
            </button>
          </MenuTrigger>
          <MenuPopover>
            <MenuList>
              <MenuItem onClick={() => applySortOrder("alpha-asc")}>Alphabetical: A–Z</MenuItem>
              <MenuItem onClick={() => applySortOrder("alpha-desc")}>Alphabetical: Z–A</MenuItem>
              <MenuItem onClick={() => applySortOrder("usage")}>Most used</MenuItem>
              <MenuItem onClick={() => applySortOrder("random")}>Randomize</MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>

      {arrangedItems.map((item) => {
        const isActive = nodeContainsCurrentPath(item, currentPath)
        const Icon = item.icon

        if (item.items?.length) {
          const value = categoryValue(item)
          const isActiveCategory = isActive
          return (
            <NavCategory key={value} value={value}>
              <NavCategoryItem
                icon={Icon ? <span className={styles.iconBadge} style={{ color: sidebarIconColors[item.title] ?? tokens.colorBrandForeground1 }} aria-hidden="true"><Icon /></span> : undefined}
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
                  pinnedUrls,
                  togglePin,
                  styles.pinButton,
                  styles.pinButtonPinned,
                )}
              </NavSubItemGroup>
            </NavCategory>
          )
        }

        if (!item.url) return null
        if (pinnedUrls.includes(item.url)) return null

        return (
          <NavItem
            key={`${item.title}-${item.url}`}
            value={item.url}
            icon={Icon ? <span className={styles.iconBadge} style={{ color: sidebarIconColors[item.title] ?? tokens.colorBrandForeground1 }} aria-hidden="true"><Icon /></span> : undefined}
            disabled={item.disabled}
            className={styles.item}
          >
            <AttentionLabel
              title={item.title}
              attention={nodeNeedsAttention(item, attentionUrls)}
              className={styles.label}
              onTogglePin={() => togglePin(item.url!)}
              pinButtonClassName={styles.pinButton}
              pinButtonPinnedClassName={styles.pinButtonPinned}
            />
          </NavItem>
        )
      })}
    </Nav>
  )
}
