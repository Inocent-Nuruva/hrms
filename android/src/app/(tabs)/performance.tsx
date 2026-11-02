import React from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '../../lib/api';
import { MeListScreen } from '../../screens/MeListScreen';
import { Text } from '../../components/ui/text';
import { MobileTopBar } from '../../components/layout/MobileTopBar';
import { useAuth } from '../../hooks/useAuth';
import { useAppAccent } from '../../hooks/useAppAccent';
import { FluentButton } from '../../components/ui/fluent-button';
import { FluentInput } from '../../components/ui/fluent-input';

type Row = Record<string, unknown>;
const valueOf = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
};

const isKpiProposalPeriodOpen = (period: Row) => {
  if (valueOf(period, 'status').toUpperCase() !== 'OPEN') return false;
  const phase = valueOf(period, 'kpiPhase', 'kpi_phase').toUpperCase();
  if (!phase || phase === 'REOPENED') return true;
  const deadline = valueOf(period, 'goalSettingDeadline', 'goal_setting_deadline').slice(0, 10);
  return phase === 'GOAL_SETTING' && (!deadline || new Date().toISOString().slice(0, 10) <= deadline);
};

export default function PerformanceScreen() {
  const [view, setView] = React.useState('kpis');
  const [reload, setReload] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [formRow, setFormRow] = React.useState<Row | null>(null);
  const [formMode, setFormMode] = React.useState<'create' | 'edit' | 'actual' | 'achievement' | 'review' | 'appeal' | 'feedback' | 'decline' | 'development'>('create');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [numberValue, setNumberValue] = React.useState('');
  const [note, setNote] = React.useState('');
  const [periodId, setPeriodId] = React.useState('');
  const [dueDate, setDueDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [periods, setPeriods] = React.useState<Row[]>([]);
  const [periodPickerOpen, setPeriodPickerOpen] = React.useState(false);
  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [calendarMonth, setCalendarMonth] = React.useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [saving, setSaving] = React.useState(false);
  const auth = useAuth();
  const accent = useAppAccent();
  const sections = [
    { id: 'summary', label: 'Overview', title: 'Performance overview', empty: 'No performance summary available.', load: async () => [await api.getMyPerformanceSummary()], titleKeys: ['overallScore', 'overall_score', 'rating', 'status'], subtitleKeys: ['periodName', 'performancePeriod.name', 'updatedAt'] },
    { id: 'kpis', label: 'KPIs', title: 'My KPIs', empty: 'No performance KPIs assigned yet.', load: () => api.listMyPerformanceKpis(), titleKeys: ['title', 'name', 'kpiDefinition.name'], subtitleKeys: ['status', 'actualValue', 'actual_value', 'targetValue', 'target_value', 'dueDate', 'due_date'] },
    { id: 'assignments', label: 'Performance', title: 'My performance', empty: 'No performance assignments yet.', load: () => api.listMyPerformanceAssignments(), titleKeys: ['performancePeriod.name', 'performancePeriod.title', 'periodName', 'name', 'title', 'status'], subtitleKeys: ['status', 'performancePeriod.startDate', 'performancePeriod.start_date', 'createdAt'] },
    { id: 'achievements', label: 'Achievements', title: 'My achievements', empty: 'No KPI achievements yet.', load: () => api.listMyPerformanceAchievements(), titleKeys: ['title', 'name', 'kpiTitle', 'kpi_title'], subtitleKeys: ['status', 'achievementValue', 'achievement_value', 'updatedAt'] },
    { id: 'reviews', label: 'Reviews', title: 'My reviews', empty: 'No performance reviews yet.', load: () => api.listMyPerformanceReviews(), titleKeys: ['periodName', 'performancePeriod.name', 'title', 'status'], subtitleKeys: ['status', 'overallScore', 'overall_score', 'publishedAt'] },
    { id: 'published-scores', label: 'Published scores', title: 'Published performance scores', empty: 'No quarterly or annual scores have been published yet.', load: () => api.listMyPerformanceAggregates(), titleKeys: ['financial_year_name', 'financial_year_code', 'name', 'period_type'], subtitleKeys: ['aggregate_score', 'rating_code', 'published_at'] },
    { id: 'feedback', label: '360 Feedback', title: 'Assigned feedback', empty: 'No 360 feedback requests assigned.', load: () => api.listMyPerformanceFeedback360(), titleKeys: ['reviewTitle', 'title', 'reviewerName', 'status'], subtitleKeys: ['status', 'dueDate', 'due_date'] },
    { id: 'improvement', label: 'Improvement', title: 'Improvement plans', empty: 'No improvement plans.', load: () => api.listMyPerformanceImprovementPlans(), titleKeys: ['title', 'name', 'status'], subtitleKeys: ['status', 'startDate', 'endDate'] },
    { id: 'development', label: 'Development', title: 'Development plans', empty: 'No development plans.', load: () => api.listMyPerformanceDevelopmentPlans(), titleKeys: ['title', 'name', 'status'], subtitleKeys: ['status', 'startDate', 'endDate'] },
  ] as const;
  const selected = sections.find((section) => section.id === view) ?? sections[0];
  const openForm = (mode: typeof formMode, row: Row | null = null) => {
    setFormMode(mode); setFormRow(row); setTitle(valueOf(row ?? {}, 'title', 'name'));
    setDescription(valueOf(row ?? {}, 'description')); setNumberValue(valueOf(row ?? {}, 'actualValue', 'actual_value', 'achievementValue', 'achievement_value', 'overallScore'));
    setNote(''); setPeriodId(valueOf(row ?? {}, 'performancePeriodId', 'performance_period_id', 'periodId'));
    setDueDate(valueOf(row ?? {}, 'dueDate', 'due_date').slice(0, 10) || new Date().toISOString().slice(0, 10)); setFormOpen(true);
    if (mode === 'create') {
      void api.listPerformancePeriods().then((items) => setPeriods([...items].sort((a, b) => Number(isKpiProposalPeriodOpen(b)) - Number(isKpiProposalPeriodOpen(a))))).catch((error) => Alert.alert('Could not load performance periods', error instanceof Error ? error.message : 'Try again.'));
    }
  };
  const run = async (operation: () => Promise<unknown>) => {
    setSaving(true);
    try { await operation(); setFormOpen(false); setReload((n) => n + 1); }
    catch (error) { Alert.alert('Performance update failed', error instanceof Error ? error.message : 'Please try again.'); }
    finally { setSaving(false); }
  };
  const saveForm = () => {
    const id = valueOf(formRow ?? {}, 'id');
    const numericValue = Number(numberValue);
    if (formMode === 'create') {
      if (!periodId || !title.trim() || !description.trim() || !dueDate) { Alert.alert('Required', 'Enter period ID, title, description, and due date.'); return; }
      if (!isKpiProposalPeriodOpen(periods.find((period) => valueOf(period, 'id') === periodId) ?? {})) { Alert.alert('Goal setting is closed', 'Choose a period accepting KPI proposals.'); return; }
      return void run(() => api.createMyPerformanceKpi({ performance_period_id: Number(periodId), title: title.trim(), description: description.trim(), measurement_type: 'NUMBER', target_value: Number.isFinite(numericValue) ? numericValue : 1, weight: 1, due_date: dueDate, progress_source: 'MANUAL' }));
    }
    if (!id) { Alert.alert('Missing item ID', 'This item cannot be updated.'); return; }
    if (formMode === 'edit') return void run(() => api.updateMyPerformanceKpi(id, { title: title.trim(), description: description.trim(), due_date: dueDate }));
    if (formMode === 'actual') return void run(() => api.updateMyPerformanceKpiActual(id, numericValue));
    if (formMode === 'achievement') return void run(() => api.updateMyPerformanceAchievement(id, { achievement_value: numericValue, submit: true }));
    if (formMode === 'review') return void run(() => api.submitMyPerformanceSelfReview(valueOf(formRow ?? {}, 'periodAssignmentId', 'period_assignment_id', 'id'), { review: { comments: note.trim(), self_assessment: note.trim() } }));
    if (formMode === 'appeal') return void run(() => api.submitMyPerformanceAppeal(id, { reason: note.trim() }));
    if (formMode === 'feedback') return void run(() => api.submitMyPerformanceFeedback360(id, { ratings: {}, overall_score: numericValue, comments: note.trim() }));
    if (formMode === 'decline') return void run(() => api.declineMyPerformanceFeedback360(id, { reason: note.trim() }));
    if (formMode === 'development') return void run(() => api.updateMyPerformanceDevelopmentGoal(id, { progress_percent: numericValue, employee_comment: note.trim() }));
  };
  const actions = (row: Row) => {
    const id = valueOf(row, 'id');
    const button = (label: string, onPress: () => void, danger = false) => <Pressable key={label} onPress={onPress} style={styles.action}><Text style={[styles.actionLabel, { color: danger ? '#B42318' : accent }]}>{label}</Text></Pressable>;
    if (view === 'kpis') return <View style={styles.actions}>{button('Update actual', () => openForm('actual', row))}{button('Edit', () => openForm('edit', row))}{button('Delete', () => Alert.alert('Delete KPI?', 'This KPI will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void run(() => api.deleteMyPerformanceKpi(id)) }]), true)}{valueOf(row, 'performancePeriodId', 'performance_period_id') ? button('Submit period', () => Alert.alert('Submit KPIs?', 'Submit all your KPIs for this period?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: () => void run(() => api.submitMyPerformanceKpis(valueOf(row, 'performancePeriodId', 'performance_period_id'))) }])) : null}</View>;
    if (view === 'achievements') return <View style={styles.actions}>{button('Update', () => openForm('achievement', row))}</View>;
    if (view === 'reviews') return <View style={styles.actions}>{button('Self review', () => openForm('review', row))}{button('Appeal', () => openForm('appeal', row))}</View>;
    if (view === 'feedback') return <View style={styles.actions}>{button('Submit feedback', () => openForm('feedback', row))}{button('Decline', () => openForm('decline', row), true)}</View>;
    if (view === 'improvement') return <View style={styles.actions}>{button('Acknowledge', () => Alert.alert('Acknowledge plan?', 'Confirm that you have read this improvement plan.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Acknowledge', onPress: () => void run(() => api.acknowledgeMyPerformanceImprovementPlan(id)) }]))}</View>;
    if (view === 'development') return <View style={styles.actions}>{button('Update progress', () => openForm('development', row))}</View>;
    return null;
  };
  return (
    <View style={styles.screen}>
      <MobileTopBar auth={auth} title="KPIs" variant="compact" />
      <ScrollView horizontal style={styles.tabScroller} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
        {sections.map((section) => <Pressable key={section.id} accessibilityRole="tab" accessibilityState={{ selected: view === section.id }} onPress={() => setView(section.id)} style={[styles.tab, view === section.id && { borderBottomColor: accent }]}><Text style={[styles.tabText, { color: view === section.id ? accent : '#64748B' }]}>{section.label}</Text></Pressable>)}
      </ScrollView>
      <MeListScreen key={`${selected.id}-${reload}`} title={selected.title} hideHeader empty={selected.empty} load={selected.load} titleKeys={[...selected.titleKeys]} subtitleKeys={[...selected.subtitleKeys]} createLabel={view === 'kpis' ? 'Create KPI' : undefined} onCreate={view === 'kpis' ? () => openForm('create') : undefined} renderActions={view === 'summary' || view === 'assignments' ? undefined : (row) => actions(row)} />
      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.modalBackdrop}><ScrollView contentContainerStyle={styles.modalScroll}><View style={styles.modal}>
          <Text style={styles.modalTitle}>{formMode === 'create' ? 'Create KPI' : formMode === 'edit' ? 'Edit KPI' : formMode === 'actual' ? 'Update actual value' : formMode === 'achievement' ? 'Update achievement' : formMode === 'review' ? 'Submit self review' : formMode === 'appeal' ? 'Appeal review' : formMode === 'feedback' ? 'Submit 360 feedback' : formMode === 'decline' ? 'Decline feedback' : 'Update development progress'}</Text>
          {formMode === 'create' ? <View style={styles.formField}><Text style={styles.fieldLabel}>Performance period</Text><FluentButton appearance="outline" block onPress={() => setPeriodPickerOpen(true)}>{periods.find((period) => valueOf(period, 'id') === periodId) ? valueOf(periods.find((period) => valueOf(period, 'id') === periodId)!, 'name', 'title', 'period_name') : 'Choose a performance period'}</FluentButton></View> : null}
          {formMode === 'create' || formMode === 'edit' ? <FluentInput label="KPI title" placeholder="e.g. Improve customer response time" value={title} onChangeText={setTitle} /> : null}
          {formMode === 'create' || formMode === 'edit' ? <FluentInput label="Description" placeholder="Describe the expected result" value={description} onChangeText={setDescription} multiline style={styles.multiline} /> : null}
          {['create','edit'].includes(formMode) ? <View style={styles.formField}><Text style={styles.fieldLabel}>Due date</Text><FluentButton appearance="outline" block onPress={() => setCalendarOpen(true)}>{new Date(`${dueDate}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'long' })}</FluentButton></View> : null}
          {['create','actual','achievement','feedback','development'].includes(formMode) ? <FluentInput label={formMode === 'create' ? 'Target value' : formMode === 'feedback' ? 'Overall score (0–100)' : 'Value'} placeholder="Enter a number" value={numberValue} onChangeText={setNumberValue} keyboardType="decimal-pad" /> : null}
          {formMode !== 'actual' && formMode !== 'achievement' && formMode !== 'create' && formMode !== 'edit' ? <FluentInput label={formMode === 'appeal' || formMode === 'decline' ? 'Reason' : 'Comments'} placeholder="Add details" value={note} onChangeText={setNote} multiline style={styles.multiline} /> : null}
          <View style={styles.modalActions}><FluentButton appearance="secondary" onPress={() => setFormOpen(false)}>Cancel</FluentButton><FluentButton loading={saving} onPress={saveForm}>Save</FluentButton></View>
        </View></ScrollView></View>
      </Modal>
      <Modal visible={periodPickerOpen} transparent animationType="fade" onRequestClose={() => setPeriodPickerOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.pickerModal}><Text style={styles.modalTitle}>Choose performance period</Text><Text style={styles.periodDates}>Only periods in goal setting can be selected for KPI creation.</Text><ScrollView style={styles.periodList}>{periods.map((period) => { const id = valueOf(period, 'id'); const label = valueOf(period, 'name', 'title', 'period_name', 'code') || `Period ${id}`; const status = valueOf(period, 'status').toUpperCase(); const isOpen = isKpiProposalPeriodOpen(period); const dates = [valueOf(period, 'startDate', 'start_date'), valueOf(period, 'endDate', 'end_date')].filter(Boolean).map((date) => date.slice(0, 10)).join(' – '); return <Pressable key={id} disabled={!isOpen} onPress={() => { setPeriodId(id); setPeriodPickerOpen(false); }} style={[styles.periodRow, !isOpen && styles.disabledPeriod]}><View style={styles.periodInfo}><Text style={styles.periodTitle}>{label}</Text><Text style={styles.periodDates}>{dates}</Text></View><Text style={[styles.periodStatus, isOpen ? styles.openStatus : styles.closedStatus]}>{valueOf(period, 'kpiPhase', 'kpi_phase') || status || 'UNKNOWN'}</Text></Pressable>; })}{periods.length === 0 ? <Text style={styles.periodDates}>No performance periods found.</Text> : null}{periods.length > 0 && !periods.some(isKpiProposalPeriodOpen) ? <Text style={styles.periodDates}>There are currently no periods accepting KPI proposals.</Text> : null}</ScrollView><FluentButton appearance="secondary" onPress={() => setPeriodPickerOpen(false)}>Cancel</FluentButton></View></View>
      </Modal>
      <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.pickerModal}><Text style={styles.modalTitle}>Choose due date</Text><View style={styles.monthBar}><FluentButton appearance="subtle" size="small" onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>‹</FluentButton><Text style={styles.periodTitle}>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><FluentButton appearance="subtle" size="small" onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>›</FluentButton></View><View style={styles.calendarGrid}>{['S','M','T','W','T','F','S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}{Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }, (_, index) => <View key={`blank-${index}`} />)}{Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, index) => { const day = index + 1; const key = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const selected = dueDate === key; return <Pressable key={key} onPress={() => setDueDate(key)} style={[styles.dayCell, selected && { backgroundColor: accent }]}><Text style={[styles.dayText, selected && styles.selectedDay]}>{day}</Text></Pressable>; })}</View><View style={styles.modalActions}><FluentButton appearance="secondary" onPress={() => setCalendarOpen(false)}>Cancel</FluentButton><FluentButton onPress={() => setCalendarOpen(false)}>Choose date</FluentButton></View></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 }, tabScroller: { height: 43, flexGrow: 0, flexShrink: 0 }, tabs: { flexDirection: 'row', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1' }, tab: { minWidth: 88, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -StyleSheet.hairlineWidth }, tabText: { fontSize: 13, fontWeight: '600' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 10 }, action: { paddingVertical: 3 }, actionLabel: { fontSize: 12, fontWeight: '700' }, modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.42)', padding: 20 }, modalScroll: { flexGrow: 1, justifyContent: 'center' }, modal: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, gap: 12 }, pickerModal: { maxHeight: '85%', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18, gap: 12 }, modalTitle: { color: '#111827', fontSize: 18, fontWeight: '700', marginBottom: 4 }, multiline: { minHeight: 86, textAlignVertical: 'top' }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }, formField: { gap: 6, marginBottom: 12 }, fieldLabel: { color: '#475569', fontSize: 12, fontWeight: '600' }, periodList: { maxHeight: 380 }, periodRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#CBD5E1' }, disabledPeriod: { opacity: 0.45 }, periodInfo: { flex: 1 }, periodStatus: { fontSize: 10, fontWeight: '700', marginLeft: 10 }, openStatus: { color: '#107C10' }, closedStatus: { color: '#64748B' }, periodTitle: { color: '#111827', fontSize: 14, fontWeight: '600' }, periodDates: { color: '#64748B', fontSize: 12, marginTop: 3 }, monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }, weekday: { width: '14.285%', textAlign: 'center', color: '#64748B', paddingVertical: 8, fontWeight: '700' }, dayCell: { width: '14.285%', height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, dayText: { color: '#111827', fontSize: 14 }, selectedDay: { color: '#FFFFFF', fontWeight: '700' } });
