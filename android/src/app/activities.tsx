import React from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { Text } from '../components/ui/text';
import { FluentActivityIndicator } from '../components/ui/fluent-activity-indicator';
import { useAuth } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { useAppAccent } from '../hooks/useAppAccent';
import { COLORS } from '../lib/config';
import { api } from '../lib/api';

type Row = Record<string, unknown>;
const str = (v: unknown, fallback = '') => typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback;

export default function ActivitiesScreen() {
  const auth = useAuth();
  const { isDark } = useThemePreference();
  const accent = useAppAccent();
  const [view, setView] = React.useState<'reports' | 'tasks'>('reports');
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState(false);
  const [edit, setEdit] = React.useState<Row | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [dueDate, setDueDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = React.useState('');
  const [report, setReport] = React.useState<Row | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      if (view === 'tasks') {
        setRows(await api.listMyActivityTasks());
      } else {
        setRows(await api.listMyActivities());
        setReport(await api.getMyActivityToday());
      }
    } catch (error) {
      Alert.alert('Could not load activities', error instanceof Error ? error.message : 'Try again.');
      setRows([]);
    } finally { setLoading(false); }
  }, [view]);
  React.useEffect(() => { void refresh(); }, [refresh]);

  const startCreate = () => { setEdit(null); setTitle(''); setDescription(''); setDueDate(new Date().toISOString().slice(0, 10)); setForm(true); };
  const startEdit = (row: Row) => { setEdit(row); setTitle(str(row.title)); setDescription(str(row.description)); setDueDate(str(row.dueDate ?? row.due_date, new Date().toISOString().slice(0, 10)).slice(0, 10)); setForm(true); };
  const save = async () => {
    if (!title.trim() || !description.trim()) { Alert.alert('Required fields', 'Enter a title and description.'); return; }
    setBusy(true);
    try {
      if (view === 'tasks' && edit) {
        const reportId = str(edit.report_id ?? edit.reportId);
        const entryId = str(edit.id);
        await api.updateMyActivityEntry(reportId, entryId, { title: title.trim(), description: description.trim(), due_date: dueDate, status: 'PLANNED' });
      } else if (view === 'tasks') {
        await api.createMyActivityTask({ activity_date: new Date().toISOString().slice(0, 10), title: title.trim(), description: description.trim(), due_date: dueDate });
      } else {
        await api.createMyActivityTask({ activity_date: new Date().toISOString().slice(0, 10), title: title.trim(), description: description.trim(), due_date: dueDate });
      }
      setForm(false); await refresh();
    } catch (error) { Alert.alert('Could not save activity', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };
  const remove = (row: Row) => Alert.alert('Delete activity?', 'This activity will be removed from your draft report.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { void (async () => {
      try { await api.deleteMyActivityEntry(str(row.report_id ?? row.reportId), str(row.id)); await refresh(); }
      catch (error) { Alert.alert('Could not delete activity', error instanceof Error ? error.message : 'Try again.'); }
    })(); } },
  ]);
  const submit = async () => {
    const id = str(report?.id);
    if (!id) return;
    if (!summary.trim()) { Alert.alert('Summary required', 'Add a summary before submitting the report.'); return; }
    setBusy(true);
    try { await api.submitMyActivityReport(id, { employee_summary: summary.trim(), client_request_id: `${Date.now()}-mobile` }); setSummary(''); await refresh(); }
    catch (error) { Alert.alert('Could not submit report', error instanceof Error ? error.message : 'Try again.'); }
    finally { setBusy(false); }
  };

  const bg = isDark ? COLORS.backgroundDark : COLORS.background;
  const fg = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const muted = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const inputStyle = [styles.input, { color: fg, borderColor: isDark ? '#475361' : '#CBD5E1', backgroundColor: isDark ? '#252B32' : '#FFFFFF' }];
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <MobileTopBar auth={auth} title="My activities" showBackButton variant="compact" />
      <View style={styles.tabs}>
        {(['reports', 'tasks'] as const).map((item) => <Pressable key={item} onPress={() => { setForm(false); setView(item); }} style={[styles.tab, view === item && { backgroundColor: accent }]}><Text style={[styles.tabText, view === item && styles.selectedText]}>{item === 'reports' ? 'Reports' : 'Tasks'}</Text></Pressable>)}
      </View>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
        <View style={styles.actions}>
          <Pressable onPress={startCreate} style={[styles.button, { backgroundColor: accent }]}><Text style={styles.buttonText}>{view === 'reports' ? 'Add report entry' : 'New task'}</Text></Pressable>
        </View>
        {view === 'reports' && report && ['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(str(report.status)) ? <View style={styles.submitBox}>
          <Text style={[styles.label, { color: fg }]}>Daily summary</Text>
          <TextInput value={summary} onChangeText={setSummary} placeholder="Summarize your work for today" placeholderTextColor={muted} multiline style={[...inputStyle, styles.multiline]} />
          <Pressable disabled={busy} onPress={() => void submit()} style={[styles.button, { backgroundColor: accent }]}><Text style={styles.buttonText}>{busy ? 'Submitting…' : 'Submit report'}</Text></Pressable>
        </View> : null}
        {loading ? <FluentActivityIndicator color={accent} /> : null}
        {!loading && !rows.length ? <Text style={[styles.empty, { color: muted }]}>{view === 'reports' ? 'No daily activity reports yet.' : 'No activity tasks yet.'}</Text> : null}
        {rows.map((row, i) => <View key={str(row.id, String(i))} style={[styles.card, { borderColor: isDark ? '#3F4852' : '#E2E8F0' }]}>
          <Text style={[styles.cardTitle, { color: fg }]}>{view === 'reports' ? str(row.activityDate ?? row.activity_date, 'Daily report') : str(row.title, 'Activity')}</Text>
          <Text style={[styles.copy, { color: muted }]}>{view === 'reports' ? str(row.status) : `${str(row.status)}${str(row.dueDate ?? row.due_date) ? ` · due ${str(row.dueDate ?? row.due_date).slice(0, 10)}` : ''}`}</Text>
          {view === 'tasks' ? <View style={styles.rowActions}><Pressable onPress={() => startEdit(row)}><Text style={[styles.actionText, { color: accent }]}>Edit</Text></Pressable><Pressable onPress={() => remove(row)}><Text style={[styles.actionText, { color: COLORS.error }]}>Delete</Text></Pressable></View> : null}
        </View>)}
        {form ? <View style={[styles.form, { borderColor: isDark ? '#3F4852' : '#E2E8F0' }]}>
          <Text style={[styles.heading, { color: fg }]}>{edit ? 'Edit activity' : view === 'reports' ? 'Add report entry' : 'Create task'}</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={muted} style={inputStyle} />
          <TextInput value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={muted} multiline style={[...inputStyle, styles.multiline]} />
          {view === 'tasks' ? <TextInput value={dueDate} onChangeText={setDueDate} placeholder="Due date (YYYY-MM-DD)" placeholderTextColor={muted} style={inputStyle} /> : null}
          <View style={styles.rowActions}><Pressable onPress={() => setForm(false)}><Text style={[styles.actionText, { color: muted }]}>Cancel</Text></Pressable><Pressable disabled={busy} onPress={() => void save()}><Text style={[styles.actionText, { color: accent }]}>{busy ? 'Saving…' : 'Save'}</Text></Pressable></View>
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 16, paddingBottom: 40 }, tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }, tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: '#E9EFF5' }, tabText: { color: '#334155', fontSize: 13, fontWeight: '600' }, selectedText: { color: '#FFFFFF' }, actions: { alignItems: 'flex-end', marginBottom: 10 }, button: { alignSelf: 'flex-start', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 9 }, buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' }, card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 }, cardTitle: { fontSize: 15, fontWeight: '700' }, copy: { marginTop: 5, fontSize: 12 }, rowActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 14 }, actionText: { fontSize: 13, fontWeight: '700' }, form: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 14, gap: 10 }, heading: { fontSize: 16, fontWeight: '700' }, label: { fontSize: 13, fontWeight: '700', marginBottom: 6 }, input: { minHeight: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 }, multiline: { minHeight: 86, textAlignVertical: 'top' }, submitBox: { marginBottom: 16, padding: 14, borderRadius: 12, backgroundColor: '#0877B914', gap: 8 }, empty: { paddingVertical: 20, fontSize: 14, textAlign: 'center' },
});
