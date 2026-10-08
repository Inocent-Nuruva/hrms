import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, Video } from 'lucide-react-native';
import { MeetingProviderIcon } from '../components/meetings/MeetingProviderIcon';

import { MobileTopBar } from '../components/layout/MobileTopBar';
import { FluentText as Text } from '../components/ui/fluent-text';
import { useThemePreference } from '../hooks/useThemePreference';
import { useAppAccent } from '../hooks/useAppAccent';
import type { UseAuthReturn } from '../hooks/useAuth';
import { COLORS } from '../lib/config';

interface Props { auth: UseAuthReturn }
type Provider = 'google' | 'microsoft';

export function MeetingsScreen({ auth }: Props) {
  const { isDark } = useThemePreference();
  const [setupProvider, setSetupProvider] = React.useState<Provider | null>(null);
  const background = isDark ? COLORS.backgroundDark : COLORS.background;
  const surface = isDark ? COLORS.surfaceDark : COLORS.surface;
  const foreground = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const muted = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const outline = isDark ? COLORS.outlineDark : COLORS.outline;
  const accent = useAppAccent();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: background }]} edges={[]}>
      <MobileTopBar auth={auth} title="Meetings" variant="centered" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.heroIcon, { backgroundColor: `${accent}18` }]}>
          <Video size={27} color={accent} strokeWidth={1.9} />
        </View>
        <Text style={[styles.title, { color: foreground }]}>Your meetings</Text>
        <Text style={[styles.subtitle, { color: muted }]}>Connect your work calendar to see upcoming meetings and join links here.</Text>

        <View style={[styles.emptyCard, { backgroundColor: surface, borderColor: outline }]}>
          <CalendarDays size={24} color={accent} />
          <Text style={[styles.emptyTitle, { color: foreground }]}>No calendar connected</Text>
          <Text style={[styles.emptyCopy, { color: muted }]}>Meetings will appear here after you connect the account you use for work.</Text>
        </View>

        <Text style={[styles.sectionLabel, { color: foreground }]}>CONNECT A CALENDAR</Text>
        <Pressable accessibilityRole="button" onPress={() => setSetupProvider('microsoft')} style={[styles.providerCard, { backgroundColor: surface, borderColor: outline }]}>
          <View style={styles.providerIcon}><MeetingProviderIcon provider="microsoft" size={34} /></View>
          <View style={styles.providerText}><Text style={[styles.providerTitle, { color: foreground }]}>Microsoft 365 / Teams</Text><Text style={[styles.providerSubtitle, { color: muted }]}>Show Outlook meetings and Teams join links</Text></View>
          <Text style={[styles.connectLabel, { color: accent }]}>Connect</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setSetupProvider('google')} style={[styles.providerCard, { backgroundColor: surface, borderColor: outline }]}>
          <View style={styles.providerIcon}><MeetingProviderIcon provider="google" size={30} /></View>
          <View style={styles.providerText}><Text style={[styles.providerTitle, { color: foreground }]}>Google Calendar / Meet</Text><Text style={[styles.providerSubtitle, { color: muted }]}>Show calendar events with Meet links</Text></View>
          <Text style={[styles.connectLabel, { color: accent }]}>Connect</Text>
        </Pressable>

        {setupProvider ? (
          <View style={[styles.setupNotice, { backgroundColor: isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant, borderColor: outline }]}>
            <Text style={[styles.setupTitle, { color: foreground }]}>{setupProvider === 'microsoft' ? 'Microsoft 365 setup required' : 'Google Calendar setup required'}</Text>
            <Text style={[styles.setupCopy, { color: muted }]}>Sign-in cannot start until the provider app is registered and its OAuth client and redirect settings are added to the backend. Once configured, each employee can consent to read their own meetings.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36 },
  heroIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 23, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  subtitle: { marginTop: 7, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 330, alignSelf: 'center' },
  emptyCard: { marginTop: 24, borderWidth: 1, borderRadius: 14, padding: 18, alignItems: 'center' },
  emptyTitle: { marginTop: 11, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  emptyCopy: { marginTop: 5, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  sectionLabel: { marginTop: 26, marginBottom: 10, fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: 0.8 },
  providerCard: { minHeight: 74, borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 9 },
  providerIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  providerText: { flex: 1 },
  providerTitle: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  providerSubtitle: { marginTop: 2, fontSize: 10, lineHeight: 15 },
  connectLabel: { fontSize: 12, fontWeight: '700' },
  setupNotice: { marginTop: 7, padding: 13, borderWidth: 1, borderRadius: 10 },
  setupTitle: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  setupCopy: { marginTop: 4, fontSize: 11, lineHeight: 17 },
});
