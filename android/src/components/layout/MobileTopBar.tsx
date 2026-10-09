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
import { usePathname, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../lib/api';
import { COLORS } from '../../lib/config';
import { DEFAULT_PROFILE_CARD_STYLE, normalizeProfileCardStyle, profilePaletteColor, profilePaletteForeground } from '../../lib/profile-card-background';
import { TouchableScale } from '../ui/touchable-scale';
import { ProfileCardDoodles } from '../ui/profile-card-doodles';
import type { UseAuthReturn } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { useThemePreference } from '../../hooks/useThemePreference';
import { useAppAccent } from '../../hooks/useAppAccent';
import { Text } from '../ui/text';
import { FluentSystemIcon } from '../ui/fluent-system-icon';
import type { TextStyle } from 'react-native';

interface Props {
  auth: UseAuthReturn;
  subtitle?: string;
  title?: string;
  titleWeight?: TextStyle['fontWeight'];
  variant?: 'dashboard' | 'compact' | 'centered';
  showBackButton?: boolean;
  onBackPress?: () => void;
  menuPresentation?: 'drawer' | 'dropdown';
  neutralBackground?: boolean;
}

export function MobileTopBar({
  auth,
  subtitle,
  title,
  titleWeight,
  variant = 'compact',
  showBackButton = false,
  onBackPress,
  menuPresentation = 'drawer',
  neutralBackground = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { isDark, toggleTheme } = useThemePreference();
  const notifications = useNotifications();
  const { width: screenWidth } = useWindowDimensions();
  const profileCardStyleQuery = useQuery({
    queryKey: ['dashboardCardStyle'],
    queryFn: () => api.getMyDashboardCardStyle(),
    enabled: auth.isAuthenticated,
  });
  const [menuOpen, setMenuOpen] = React.useState(false);

  const [slideAnim] = React.useState(() => new Animated.Value(-400));

  const drawerWidth = React.useMemo(() => Math.min(Math.max(screenWidth * 0.78, 290), 380, screenWidth - 24), [screenWidth]);

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

  const drawerItems: Array<{ label: string; route: string; icon: React.ComponentProps<typeof FluentSystemIcon>['name'] }> = [
    { label: 'Home', route: '/', icon: 'home' },
    { label: 'Notifications', route: '/notifications', icon: 'notifications' },
    { label: 'Attendance', route: '/attendance', icon: 'attendance' },
    { label: 'Attendance history', route: '/my-attendance', icon: 'history' },
    { label: 'Leave', route: '/leave', icon: 'leave' },
    { label: 'Profile', route: '/profile', icon: 'profile' },
    { label: 'Promotions', route: '/promotions', icon: 'promotion' },
    { label: 'Shift', route: '/shift', icon: 'shift' },
    { label: 'Payroll', route: '/payroll', icon: 'payroll' },
    { label: 'Field work', route: '/field', icon: 'field' },
    { label: 'My location', route: '/my-location', icon: 'field' },
    { label: 'Finance', route: '/finance', icon: 'finance' },
    { label: 'Performance', route: '/performance', icon: 'performance' },
    { label: 'Activities', route: '/activities', icon: 'work' },
    { label: 'Documents', route: '/documents', icon: 'documents' },
  ];

  const headerTitle = title || employeeName;
  const headerSubtitle = subtitle || readGreeting();
  const selectedCardStyle = normalizeProfileCardStyle(profileCardStyleQuery.data ?? DEFAULT_PROFILE_CARD_STYLE);
  const useProfileColor = !neutralBackground;
  const barBackground = useProfileColor
    ? profilePaletteColor(selectedCardStyle.palette, isDark)
    : isDark ? COLORS.backgroundDark : COLORS.background;
  const topBarBackground = neutralBackground ? 'transparent' : barBackground;
  const headerForeground = useProfileColor
    ? profilePaletteForeground(barBackground)
    : isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const lightPalette = headerForeground !== '#FFFFFF';
  const primaryTextColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const actionIconBg = 'transparent';
  const actionIconColor = headerForeground;
  const avatarBackground = lightPalette ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.14)';
  const avatarBorder = lightPalette ? 'rgba(15,23,42,0.18)' : 'rgba(255,255,255,0.38)';
  const avatarTextColor = headerForeground;

  return (
    <>
      <SafeAreaView
        edges={['top']}
        style={{
          backgroundColor: topBarBackground,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: neutralBackground
            ? 'transparent'
            : lightPalette ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.2)',
        }}
      >
        <View
          style={[
            styles.shell,
            variant === 'dashboard' ? styles.shellDashboard : styles.shellCompact,
            { backgroundColor: topBarBackground },
          ]}
        >
          {useProfileColor ? <ProfileCardDoodles artwork={selectedCardStyle.artwork} onLight={lightPalette} /> : null}
          <View style={styles.actionsRow}>
            <View style={styles.leadingActionRow}>
              {showBackButton ? (
                <TouchableScale
                  style={[styles.iconButton, { backgroundColor: actionIconBg, borderColor: 'transparent' }]}
                  pressedScale={0.92}
                  onPress={onBackPress}
                >
                  <FluentSystemIcon name="chevron-left" size={22} color={actionIconColor} />
                </TouchableScale>
              ) : (
                <TouchableScale
                  style={[styles.menuButton, { backgroundColor: actionIconBg, borderRadius: 8 }]}
                  pressedScale={0.92}
                  onPress={openMenu}
                >
                  <FluentSystemIcon name="menu" size={22} color={actionIconColor} />
                </TouchableScale>
              )}
            </View>

            {variant === 'centered' ? (
              <Text style={[styles.centeredTitle, { color: headerForeground }, titleWeight ? { fontWeight: titleWeight } : null]} numberOfLines={1}>
                {headerTitle}
              </Text>
            ) : null}

            <View style={styles.topRightActions}>
              <TouchableScale
                style={[styles.menuButton, { backgroundColor: actionIconBg, borderRadius: 8 }]}
                pressedScale={0.92}
                onPress={toggleTheme}
              >
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  {isDark ? (
                    <FluentSystemIcon name="sun" size={20} color={actionIconColor} />
                  ) : (
                    <FluentSystemIcon name="moon" size={20} color={actionIconColor} />
                  )}
                </View>
              </TouchableScale>

              <TouchableScale
                style={[styles.menuButton, { backgroundColor: actionIconBg, borderRadius: 8 }]}
                pressedScale={0.92}
                onPress={() => router.navigate('/notifications' as never)}
              >
                <FluentSystemIcon name="notifications" size={22} color={actionIconColor} />
                {notifications.unreadCount ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}</Text>
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
                <Text style={[styles.identityName, { color: headerForeground }]}>{headerTitle}</Text>
              <Text style={[styles.identitySubtitle, { color: lightPalette ? '#64748B' : 'rgba(255,255,255,0.78)' }]}>{headerSubtitle}</Text>
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
                  closeLabelIcon={<FluentSystemIcon name="menu" size={22} color={primaryTextColor} />}
                  closeMenu={closeMenu}
                  drawerItems={drawerItems}
                  pathname={pathname}
                  auth={auth}
                  isDark={isDark}
                  unreadCount={notifications.unreadCount}
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
                pathname={pathname}
                auth={auth}
                isDark={isDark}
                unreadCount={notifications.unreadCount}
                router={router}
              />
            </View>
          )}
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
    position: 'relative',
    overflow: 'hidden',
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
  menuButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerList: { flex: 1 },
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
    marginBottom: 10,
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
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 1,
    borderRadius: 9,
  },
  drawerItemMarker: { width: 3, height: 18, marginRight: -8 },
  drawerItemText: {
    fontSize: 15,
    fontWeight: '400',
  },
  drawerNotificationBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 'auto',
  },
  drawerItemTextActive: { fontWeight: '700' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '400',
  },
  markAllText: {
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
  pathname,
  auth,
  isDark,
  unreadCount,
  router,
}: {
  closeLabelIcon: React.ReactNode;
  closeMenu: () => void;
  drawerItems: Array<{ label: string; route: string; icon: React.ComponentProps<typeof FluentSystemIcon>['name'] }>;
  pathname: string;
  auth: UseAuthReturn;
  isDark: boolean;
  unreadCount: number;
  router: ReturnType<typeof useRouter>;
}) {
  const appAccent = useAppAccent();
  const primaryTextColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  return (
    <>
      <View style={styles.drawerHeader}>
        <Text style={[styles.drawerTitle, { color: primaryTextColor }]}>Menu</Text>
        {closeLabelIcon ? (
          <TouchableScale
            style={styles.drawerCloseButton}
            onPress={closeMenu}
            pressedScale={0.92}
          >
            {closeLabelIcon}
          </TouchableScale>
        ) : null}
      </View>

      <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
        {drawerItems.map((item) => {
          const active = pathnameMatches(pathname, item.route);
          return (
            <TouchableScale
              key={item.label}
              style={styles.drawerItem}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                closeMenu();
                router.push(item.route as never);
              }}
              pressedScale={0.98}
            >
              <View style={[styles.drawerItemMarker, { backgroundColor: active ? appAccent : 'transparent' }]} />
              <FluentSystemIcon
                name={item.icon}
                active={active}
                size={25}
                color={active ? appAccent : isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant}
              />
              <Text style={[
                styles.drawerItemText,
                { color: isDark ? COLORS.onSurfaceDark : COLORS.onSurface },
                active && styles.drawerItemTextActive,
              ]}>{item.label}</Text>
              {item.label === 'Notifications' && unreadCount > 0 ? (
                <View style={styles.drawerNotificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </TouchableScale>
          );
        })}
      </ScrollView>

      <TouchableScale
        style={styles.logoutButton}
        onPress={() => {
          closeMenu();
          void auth.logout();
        }}
        pressedScale={0.98}
      >
        <FluentSystemIcon name="logout" size={20} color={appAccent} />
        <Text style={[styles.logoutText, { color: appAccent }]}>Logout</Text>
      </TouchableScale>
    </>
  );
}

function pathnameMatches(pathname: string, route: string) {
  if (route === '/') return pathname === '/';
  return pathname === route || pathname.startsWith(`${route}/`);
}
