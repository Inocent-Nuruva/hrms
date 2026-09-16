import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { COLORS } from '../lib/config';
import { useAuth } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { Text } from '../components/ui/text';

type Row = Record<string, unknown>;

function readString(row: Row, keys: string[], fallback = '—') {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

export function MeListScreen({
  title,
  empty,
  load,
}: {
  title: string;
  empty: string;
  load: () => Promise<Row[]>;
}) {
  const auth = useAuth();
  const { isDark } = useThemePreference();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await load());
    } catch (errorObject) {
      setRows([]);
      setError(errorObject instanceof Error ? errorObject.message : 'Could not load this list.');
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={['top']}>
      <MobileTopBar auth={auth} title={title} showBackButton variant="compact" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
        {loading && rows.length === 0 ? (
          <ActivityIndicator color={COLORS.primary} />
        ) : null}
        {error ? <Text style={[styles.copy, { color: COLORS.error }]}>{error}</Text> : null}
        {!loading && !error && rows.length === 0 ? (
          <Text style={[styles.copy, { color: mutedColor }]}>{empty}</Text>
        ) : null}
        {rows.map((row, index) => (
          <View key={index} style={[styles.row, { borderBottomColor: isDark ? '#3f3f46' : '#e5e7eb' }]}>
            <Text style={[styles.title, { color: textColor }]}>
              {readString(row, ['title', 'name', 'document_type', 'product_name', 'status'], `Item ${index + 1}`)}
            </Text>
            <Text style={[styles.copy, { color: mutedColor }]}>
              {readString(row, ['status', 'state', 'date', 'created_at', 'createdAt'], '')}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16, fontWeight: '700' },
  copy: { marginTop: 4, fontSize: 13 },
});
