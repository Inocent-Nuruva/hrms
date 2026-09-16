import React from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bell,
  ChartNoAxesCombined,
  ChevronLeft,
  Clock,
  FileText,
  FolderOpen,
  ListChecks,
  MapPin,
  Menu,
  MoonStar,
  PanelLeftClose,
  Power,
  SunMedium,
  Trophy,
  Wallet,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { COLORS } from '../../lib/config';
import { TouchableScale } from '../ui/touchable-scale';
import type { UseAuthReturn } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { useThemePreference } from '../../hooks/useThemePreference';
import { Text } from '../ui/text';

interface Props {
  auth: UseAuthReturn;
  subtitle?: string;
  title?: string;
  variant?: 'dashboard' | 'compact' | 'centered';
  showBackButton?: boolean;
  onBackPress?: () => void;
  menuPresentation?: 'drawer' | 'dropdown';
}

export function MobileTopBar({
  auth,
  subtitle,
  title,
  variant = 'compact',
  showBackButton = false,
  onBackPress,
  menuPresentation = 'drawer',
}: Props) {
  const router = useRouter();
  const { isDark, toggleTheme } = useThemePreference();
  const notifications = useNotifications();
  const { width: screenWidth } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);

  const [slideAnim] = React.useState(() => new Animated.Value(-400));

  const drawerWidth = React.useMemo(() => Math.max(screenWidth * 0.62, 230), [screenWidth]);

  const openMenu = () => {
    if (menuPresentation === 'drawer') {
      setMenuOpen(true);
      slideAnim.setValue(-drawerWidth);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      setMenuOpen(true);
    }
  };

  const closeMenu = () => {
    if (menuPresentation === 'drawer') {
      Animated.timing(slideAnim, {
        toValue: -drawerWidth,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setMenuOpen(false);
      });
    } else {
      setMenuOpen(false);
    }
  };

  const employeeName =
    auth.user?.fullName ||
    [auth.employee?.first_name, auth.employee?.last_name].filter(Boolean).join(' ') ||
    'Employee';
  const initials = employeeName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const drawerItems = [
    { label: 'Attendance history', route: '/my-attendance', icon: ListChecks },
    { label: 'Promotions', route: '/promotions', icon: Trophy },
    { label: 'Shift', route: '/shift', icon: Clock },
    { label: 'Payroll', route: '/payroll', icon: Wallet },
    { label: 'Field work', route: '/field', icon: MapPin },
    { label: 'Finance', route: '/finance', icon: FileText },
    { label: 'Performance', route: '/performance', icon: ChartNoAxesCombined },
    { label: 'Documents', route: '/documents', icon: FolderOpen },
  ];

  const headerTitle = title || employeeName;
  const headerSubtitle = subtitle || readGreeting();
  const barBackground = isDark ? COLORS.surfaceDark : COLORS.surface;
  const primaryTextColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const actionIconBg = isDark ? COLORS.surfaceVariantDark : COLORS.surface;
  const actionIconColor = primaryTextColor;
  const secondaryTextColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const avatarBackground = isDark ? COLORS.surfaceVariantDark : COLORS.surface;
  const avatarBorder = isDark ? COLORS.outlineDark : COLORS.outline;
  const avatarTextColor = isDark ? COLORS.onSurfaceDark : COLORS.primary;

  return (
    <>
      <SafeAreaView
        edges={['top']}
        style={{
          backgroundColor: barBackground,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
        }}
      >
        <View
          style={[
            styles.shell,
            variant === 'dashboard' ? styles.shellDashboard : styles.shellCompact,
            { backgroundColor: barBackground },
          ]}
        >
          <View style={styles.actionsRow}>
            <View style={styles.leadingActionRow}>
              {showBackButton ? (
                <TouchableScale
                  style={[styles.iconButton, { backgroundColor: actionIconBg, borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}
                  pressedScale={0.92}
                  onPress={onBackPress}
                >
                  <ChevronLeft size={22} color={actionIconColor} />
                </TouchableScale>
              ) : (
                <TouchableScale
                  style={[styles.iconButton, { backgroundColor: actionIconBg, borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}
                  pressedScale={0.92}
                  onPress={openMenu}
                >
                  <Menu size={22} color={actionIconColor} />
                </TouchableScale>
              )}
            </View>

            {variant === 'centered' ? (
              <Text style={[styles.centeredTitle, { color: primaryTextColor }]} numberOfLines={1}>
                {headerTitle}
              </Text>
            ) : null}

            <View style={styles.topRightActions}>
              <TouchableScale
                style={[styles.iconButton, { backgroundColor: actionIconBg, borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}
                pressedScale={0.92}
                onPress={toggleTheme}
              >
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  {isDark ? (
                    <SunMedium size={20} color={actionIconColor} />
                  ) : (
                    <MoonStar size={20} color={actionIconColor} />
                  )}
                </View>
              </TouchableScale>

              <TouchableScale
                style={[styles.iconButton, { backgroundColor: actionIconBg, borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}
                pressedScale={0.92}
                onPress={() => setNotificationsOpen(true)}
              >
                <Bell size={20} color={actionIconColor} />
                {notifications.unreadCount ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}</Text>
                  </View>
                ) : null}
              </TouchableScale>
            </View>
          </View>

          {variant === 'dashboard' ? (
            <View style={styles.identityRow}>
              <View style={[styles.avatarShell, { backgroundColor: avatarBackground, borderColor: avatarBorder }]}>
                <Text style={[styles.avatarText, { color: avatarTextColor }]}>{initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.identityName, { color: primaryTextColor }]}>{headerTitle}</Text>
                <Text style={[styles.identitySubtitle, { color: secondaryTextColor }]}>{headerSubtitle}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </SafeAreaView>

      <Modal visible={menuOpen} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={menuPresentation === 'dropdown' ? styles.dropdownOverlay : styles.drawerOverlay}>
          {menuPresentation === 'dropdown' ? <Pressable style={styles.drawerBackdrop} onPress={closeMenu} /> : null}
          {menuPresentation === 'drawer' ? (
            <>
              <Animated.View style={[styles.drawerPanel, {
                backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
                width: drawerWidth,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                transform: [{ translateX: slideAnim }],
              }]}>
                <MenuContent
                  closeLabelIcon={<PanelLeftClose size={18} color={primaryTextColor} />}
                  closeMenu={closeMenu}
                  drawerItems={drawerItems}
                  auth={auth}
                  isDark={isDark}
                  router={router}
                />
              </Animated.View>
              <Pressable style={styles.drawerBackdrop} onPress={closeMenu} />
            </>
          ) : (
            <View style={[styles.dropdownPanel, { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface }]}>
              <MenuContent
                closeLabelIcon={null}
                closeMenu={closeMenu}
                drawerItems={drawerItems}
                auth={auth}
                isDark={isDark}
                router={router}
              />
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={notificationsOpen} transparent animationType="fade" onRequestClose={() => setNotificationsOpen(false)}>
        <View style={styles.dropdownOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => setNotificationsOpen(false)} />
          <View style={[styles.notificationsPanel, { backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface }]}>
            <View style={styles.drawerHeader}>
              <Text style={[styles.drawerTitle, { color: primaryTextColor }]}>Notifications</Text>
              {notifications.notifications.length ? (
                <TouchableScale onPress={() => void notifications.markAllAsRead()} pressedScale={0.96}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableScale>
              ) : null}
            </View>

            {notifications.notifications.length ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationList}>
                {notifications.notifications.map((item) => (
                  <TouchableScale
                    key={item.id}
                    style={[
                      styles.notificationItem,
                      {
                        backgroundColor: item.read
                          ? isDark
                            ? COLORS.surfaceDark
                            : COLORS.surface
                          : isDark
                            ? COLORS.surfaceVariantDark
                            : COLORS.surfaceVariant,
                        borderColor: isDark ? COLORS.outlineDark : COLORS.outline,
                      },
                    ]}
                    onPress={() => {
                      void notifications.markAsRead(item.id);
                      setNotificationsOpen(false);
                      router.push({
                        pathname: item.route,
                        params: { requestId: item.requestId },
                      } as never);
                    }}
                    pressedScale={0.98}
                  >
                    <Text style={[styles.notificationTitle, { color: primaryTextColor }]}>{item.title}</Text>
                    <Text style={[styles.notificationBody, { color: secondaryTextColor }]}>{item.body}</Text>
                  </TouchableScale>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.emptyNotifications}>
                <Text style={[styles.notificationBody, { color: secondaryTextColor }]}>No notifications yet</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </>
  );
}

function readGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

const styles = StyleSheet.create({
  shell: {
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  shellDashboard: {
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 56,
  },
  shellCompact: {
    paddingTop: 10,
    paddingBottom: 12,
    minHeight: 52,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leadingActionRow: {
    minWidth: 40,
  },
  centeredTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    paddingHorizontal: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.outline,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  avatarShell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '800',
  },
  identityName: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  identitySubtitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
  },
  drawerPanel: {
    paddingTop: 32,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  drawerBackdrop: {
    flex: 1,
  },
  dropdownPanel: {
    position: 'absolute',
    top: 74,
    left: 16,
    width: 272,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 12,
    elevation: 5,
  },
  notificationsPanel: {
    position: 'absolute',
    top: 74,
    right: 16,
    width: 300,
    maxHeight: 360,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 12,
    elevation: 5,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  drawerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  drawerCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 2,
  },
  drawerItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 12,
  },
  logoutText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  markAllText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  notificationList: {
    gap: 10,
  },
  notificationItem: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  notificationBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyNotifications: {
    paddingVertical: 16,
  },
});

function MenuContent({
  closeLabelIcon,
  closeMenu,
  drawerItems,
  auth,
  isDark,
  router,
}: {
  closeLabelIcon: React.ReactNode;
  closeMenu: () => void;
  drawerItems: Array<{ label: string; route: string; icon: React.ComponentType<{ size?: number; color?: string }> }>;
  auth: UseAuthReturn;
  isDark: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const primaryTextColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  return (
    <>
      <View style={styles.drawerHeader}>
        <Text style={[styles.drawerTitle, { color: primaryTextColor }]}>Menu</Text>
        {closeLabelIcon ? (
          <TouchableScale
            style={[styles.drawerCloseButton, { backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant }]}
            onPress={closeMenu}
            pressedScale={0.92}
          >
            {closeLabelIcon}
          </TouchableScale>
        ) : null}
      </View>

      {drawerItems.map((item) => {
        const Icon = item.icon;
        return (
          <TouchableScale
            key={item.label}
            style={styles.drawerItem}
            onPress={() => {
              closeMenu();
              router.push(item.route as never);
            }}
            pressedScale={0.98}
          >
            <Icon size={18} color={isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant} />
            <Text style={[styles.drawerItemText, { color: isDark ? COLORS.onSurfaceDark : COLORS.onSurface }]}>{item.label}</Text>
          </TouchableScale>
        );
      })}

      <TouchableScale
        style={styles.logoutButton}
        onPress={() => {
          closeMenu();
          void auth.logout();
        }}
        pressedScale={0.98}
      >
        <Power size={18} color={COLORS.accent} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableScale>
    </>
  );
}
