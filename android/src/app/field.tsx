import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MeListScreen } from '../screens/MeListScreen';
import { api, getFieldVisitOfflineScope, readMobilePunchContext } from '../lib/api';
import { COLORS } from '../lib/config';
import { Text } from '../components/ui/text';
import { cacheMyFieldVisits, enqueueFieldVisitAction, flushFieldVisitOutbox, getCachedMyFieldVisits, listFieldVisitOutbox, removeFieldVisitOutboxAction, type QueuedFieldVisitAction } from '../lib/field-visit-offline-queue';

type Visit = Record<string, unknown>;
type FormMode = 'opportunity' | 'checkout' | 'manager-opportunity' | 'manager-policy';

function visitId(row: Visit) {
  return row.id ?? row.visitId ?? row.visit_id;
}

function requestId() {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return cryptoApi?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export default function FieldScreen() {
  const [selected, setSelected] = useState<Visit | null>(null);
  const [mode, setMode] = useState<FormMode>('opportunity');
  const [managerView, setManagerView] = useState(false);
  const [managedOpportunity, setManagedOpportunity] = useState<Visit | null>(null);
  const [title, setTitle] = useState('');
  const [opportunityType, setOpportunityType] = useState('LEAD');
  const [description, setDescription] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => { const date = new Date(); return new Date(date.getFullYear(), date.getMonth(), 1); });
  const [sourceSystem, setSourceSystem] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [potential, setPotential] = useState('');
  const [premium, setPremium] = useState('');
  const [currency, setCurrency] = useState('TZS');
  const [premiumCurrency, setPremiumCurrency] = useState('TZS');
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>(['TZS']);
  const [allowOpportunityValues, setAllowOpportunityValues] = useState(false);
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState('');
  const [actualValue, setActualValue] = useState('');
  const [opportunityStatus, setOpportunityStatus] = useState('IDENTIFIED');
  const [changeReason, setChangeReason] = useState('');
  const [policyCurrencies, setPolicyCurrencies] = useState('TZS');
  const [policyDefaultCurrency, setPolicyDefaultCurrency] = useState('TZS');
  const [saving, setSaving] = useState(false);
  const [refreshRows, setRefreshRows] = useState<() => Promise<void>>(() => async () => {});
  const [queuedActions, setQueuedActions] = useState<QueuedFieldVisitAction[]>([]);
  const [queueMessage, setQueueMessage] = useState('');

  const loadVisits = useCallback(async () => {
    try {
      const visits = await api.listMyFieldVisits();
      const scope = await getFieldVisitOfflineScope();
      if (scope) await cacheMyFieldVisits(scope, visits);
      return visits;
    } catch (error) {
      const scope = await getFieldVisitOfflineScope();
      const cached = scope ? await getCachedMyFieldVisits(scope) : null;
      if (cached) { setQueueMessage('Showing the last synced visit list. Offline actions will be checked by HRMS when connectivity returns.'); return cached; }
      throw error;
    }
  }, []);

  const refreshQueue = useCallback(async () => {
    const scope = await getFieldVisitOfflineScope();
    if (scope) setQueuedActions(await listFieldVisitOutbox(scope));
  }, []);
  const flushQueue = useCallback(async () => {
    const scope = await getFieldVisitOfflineScope();
    if (!scope || !(await NetInfo.fetch()).isConnected) return;
    const result = await flushFieldVisitOutbox(scope, async (action) => { await api.syncMyFieldVisitAction(action.operation, action.payload); });
    await refreshQueue();
    if (result.sent) setQueueMessage(`Synced ${result.sent} saved field action${result.sent === 1 ? '' : 's'}.`);
    else if (result.needsReview) setQueueMessage(`${result.needsReview} field action${result.needsReview === 1 ? '' : 's'} need review.`);
  }, [refreshQueue]);

  useEffect(() => {
    void refreshQueue(); void flushQueue();
    const unsubscribe = NetInfo.addEventListener((state) => { if (state.isConnected) void flushQueue(); });
    return unsubscribe;
  }, [flushQueue, refreshQueue]);

  useEffect(() => {
    void api.getMyFieldVisitCommercialPolicy().then((policy) => {
      const currencies = Array.isArray(policy.supportedCurrencies) ? policy.supportedCurrencies.filter((item): item is string => typeof item === 'string') : ['TZS'];
      setSupportedCurrencies(currencies.length ? currencies : ['TZS']);
      setCurrency(typeof policy.defaultCurrency === 'string' ? policy.defaultCurrency : 'TZS');
      setAllowOpportunityValues(policy.allowEmployeeOpportunityValues !== false);
    }).catch(() => undefined);
  }, []);

  async function checkIn(row: Visit, refresh: () => Promise<void>) {
    try {
      const id = visitId(row);
      if (!id) throw new Error('Visit ID is missing.');
      if (queuedActions.some((action) => action.status === 'QUEUED' && action.operation === 'VISIT_CHECK_IN' && Number(action.payload.visit_id) === Number(id))) {
        Alert.alert('Field visit', 'A check-in for this visit is already waiting to sync.'); return;
      }
      const location = await readMobilePunchContext();
      const payload = {
        visit_id: Number(id), client_request_id: requestId(), captured_at: new Date().toISOString(),
        latitude: location.latitude, longitude: location.longitude,
        accuracy_meters: location.accuracyMeters,
      };
      const queued = await submitOrQueue('VISIT_CHECK_IN', payload);
      await refresh();
      await refreshQueue();
      Alert.alert('Field visit', queued ? 'Check-in saved securely and will sync when you are online.' : 'Checked in successfully.');
    } catch (error) {
      Alert.alert('Check-in failed', error instanceof Error ? error.message : 'Could not check in.');
    }
  }

  function openForm(row: Visit, nextMode: FormMode, refresh: () => Promise<void>) {
    setSelected(row);
    setRefreshRows(() => refresh);
    setMode(nextMode);
    setTitle(''); setOpportunityType('LEAD'); setDescription(''); setExpectedCloseDate(''); setSourceSystem(''); setExternalReference(''); setPotential(''); setPremium(''); setPremiumCurrency(currency); setNotes(''); setOutcome('');
  }

  async function submitOrQueue(operation: QueuedFieldVisitAction['operation'], payload: Record<string, unknown>) {
    try { await api.syncMyFieldVisitAction(operation, payload); return false; }
    catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: unknown }).status) : undefined;
      if (status && status < 500) throw error;
      const scope = await getFieldVisitOfflineScope();
      if (!scope) throw new Error('Connect once to HRMS to load your company and employee profile before using offline visits.');
      await enqueueFieldVisitAction(scope, operation, payload);
      await refreshQueue();
      return true;
    }
  }

  async function discardNeedsReview(id: string) {
    const scope = await getFieldVisitOfflineScope();
    if (scope) { await removeFieldVisitOutboxAction(scope, id); await refreshQueue(); }
  }

  async function save(refresh: () => Promise<void>) {
    if (!selected) return;
    const id = visitId(selected);
    if (!id && mode !== 'manager-policy' && mode !== 'manager-opportunity') return;
    if (mode === 'opportunity' && !title.trim()) {
      Alert.alert('Required', 'Enter an opportunity title.'); return;
    }
    if (mode === 'checkout' && (!notes.trim() || !outcome.trim())) {
      Alert.alert('Required', 'Discussion notes and outcome are required.'); return;
    }
    if (mode === 'opportunity' && expectedCloseDate && !isValidDate(expectedCloseDate)) { Alert.alert('Invalid date', 'Enter a real date in YYYY-MM-DD format.'); return; }
    setSaving(true);
    try {
      if (mode === 'manager-policy') {
        const currencies = [...new Set(policyCurrencies.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean))];
        if (!currencies.length || !currencies.includes(policyDefaultCurrency.trim().toUpperCase())) throw new Error('The default currency must be included in the supported currency list.');
        await api.saveManagerFieldVisitCommercialPolicy({ default_currency: policyDefaultCurrency.trim().toUpperCase(), supported_currencies: currencies, allow_employee_opportunity_values: allowOpportunityValues });
        setSupportedCurrencies(currencies); setCurrency(policyDefaultCurrency.trim().toUpperCase());
      } else if (mode === 'manager-opportunity') {
        if (!managedOpportunity || !changeReason.trim()) throw new Error('Choose an opportunity and enter a reason for the change.');
        await api.updateManagerFieldOpportunityCommercial(String(managedOpportunity.id ?? managedOpportunity.opportunityId ?? managedOpportunity.opportunity_id), { status: opportunityStatus, actual_value: actualValue === '' ? undefined : Number(actualValue), reason: changeReason.trim() });
      } else if (mode === 'opportunity') {
        const payload = {
          visit_id: Number(id), client_request_id: requestId(),
          opportunity_type: opportunityType, title: title.trim(),
          description: description.trim() || undefined,
          potential_value: potential ? Number(potential) : undefined,
          currency: currency.trim().toUpperCase() || undefined,
          premium_value: premium ? Number(premium) : undefined,
          premium_currency: premium ? premiumCurrency.trim().toUpperCase() : undefined,
          expected_close_date: expectedCloseDate || undefined,
          source_system: sourceSystem.trim() || undefined,
          external_reference: externalReference.trim() || undefined,
        };
        const queued = await submitOrQueue('ADD_OPPORTUNITY', payload);
        if (queued) setQueueMessage('Opportunity saved securely and will sync when you are online.');
      } else {
        const location = await readMobilePunchContext();
        const payload = {
          visit_id: Number(id), client_request_id: requestId(), captured_at: new Date().toISOString(),
          latitude: location.latitude, longitude: location.longitude,
          accuracy_meters: location.accuracyMeters,
          discussion_notes: notes.trim(), outcome: outcome.trim(), follow_up_required: false,
        };
        const queued = await submitOrQueue('VISIT_CHECK_OUT', payload);
        if (queued) setQueueMessage('Check-out saved securely and will sync when you are online.');
      }
      setSelected(null);
      await refresh();
      Alert.alert('Field visit', mode === 'manager-policy' || mode === 'manager-opportunity' ? 'Manager update saved and audited.' : 'Saved successfully. If you were offline, the action is queued and will sync when connected.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    } finally { setSaving(false); }
  }

  return <>
    {queuedActions.length > 0 ? <View style={styles.queueBanner}><Text style={styles.hint}>{queuedActions.filter((item) => item.status === 'QUEUED').length} saved action(s) waiting to sync; {queuedActions.filter((item) => item.status === 'NEEDS_REVIEW').length} need review.</Text>{queuedActions.some((item) => item.status === 'QUEUED') ? <Action label="Sync now" onPress={() => void flushQueue()} /> : null}{queueMessage ? <Text style={styles.hint}>{queueMessage}</Text> : null}{queuedActions.filter((item) => item.status === 'NEEDS_REVIEW').map((item) => <View key={item.id} style={styles.actions}><Text style={styles.error}>{item.lastError}</Text><Action label="Discard rejected action" onPress={() => void discardNeedsReview(item.id)} /></View>)}</View> : null}
    <View style={styles.viewToggle}><Action label={managerView ? '✓ My visits' : 'My visits'} onPress={() => setManagerView(false)} /><Action label={managerView ? '✓ Manager tools' : 'Manager tools'} onPress={() => setManagerView(true)} />{managerView ? <Action label="Company policy" onPress={() => { void api.getManagerFieldVisitCommercialPolicy().then((policy) => { setPolicyDefaultCurrency(String(policy.defaultCurrency ?? 'TZS')); setPolicyCurrencies(Array.isArray(policy.supportedCurrencies) ? policy.supportedCurrencies.join(', ') : 'TZS'); setAllowOpportunityValues(policy.allowEmployeeOpportunityValues !== false); setMode('manager-policy'); setSelected({}); }).catch((error) => Alert.alert('Company policy unavailable', error instanceof Error ? error.message : 'Your account may not have field visit configuration access.')); }} /> : null}</View>
    <MeListScreen
      title={managerView ? 'Team field visits' : 'My field visits'}
      empty={managerView ? 'No team visits available.' : 'No field visits assigned to you.'}
      load={managerView ? api.listManagerFieldVisits : loadVisits}
      titleKeys={['purpose', 'title', 'visitNo', 'visit_no', 'status']}
      subtitleKeys={['status', 'visitDate', 'visit_date']}
      renderActions={(row, refresh) => {
        const status = String(row.status ?? '').toUpperCase();
        const opportunityValues = Array.isArray(row.opportunities) ? row.opportunities as Visit[] : [];
        if (managerView) return <View style={styles.actions}>{opportunityValues.map((opportunity, index) => <View key={String(opportunity.id ?? index)} style={styles.managerOpportunity}><Text style={styles.detail}>{String(opportunity.title ?? 'Opportunity')} · {String(opportunity.status ?? 'IDENTIFIED')} · {String(opportunity.currency ?? 'TZS')} {String(opportunity.actualValue ?? opportunity.actual_value ?? '—')}</Text><Action label="Manage stage / actual" onPress={() => { setManagedOpportunity(opportunity); setOpportunityStatus(String(opportunity.status ?? 'IDENTIFIED')); setActualValue(String(opportunity.actualValue ?? opportunity.actual_value ?? '')); setChangeReason(''); setMode('manager-opportunity'); setSelected({}); }} /></View>)}</View>;
        return <View style={styles.actions}>
          {status === 'PLANNED' ? <Action label="Check in" onPress={() => void checkIn(row, refresh)} /> : null}
          {status === 'CHECKED_IN' || status === 'IN_PROGRESS' ? <Action label="Check out" onPress={() => openForm(row, 'checkout', refresh)} /> : null}
          {allowOpportunityValues && status !== 'CANCELLED' && status !== 'REJECTED' ? <Action label="Add opportunity" onPress={() => openForm(row, 'opportunity', refresh)} /> : null}
          {opportunityValues.map((opportunity, index) => <Text key={`${String(opportunity.id ?? index)}`} style={styles.detail}>
            {String(opportunity.title ?? 'Opportunity')} · {String(opportunity.status ?? 'IDENTIFIED')} · {String(opportunity.currency ?? 'TZS')} {String(opportunity.potentialValue ?? opportunity.potential_value ?? '—')} · Premium {String(opportunity.premiumCurrency ?? opportunity.premium_currency ?? opportunity.currency ?? 'TZS')} {String(opportunity.premiumValue ?? opportunity.premium_value ?? '—')}
          </Text>)}
        </View>;
      }}
    />
    <Modal visible={Boolean(selected)} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
      <View style={styles.scrim}><View style={styles.card}>
        <Text style={styles.heading}>{mode === 'opportunity' ? 'Record opportunity' : mode === 'checkout' ? 'Check out' : mode === 'manager-opportunity' ? 'Manage opportunity' : 'Company Field Visit policy'}</Text>
        {mode === 'opportunity' ? <>
          <Text style={styles.label}>Opportunity type</Text><View style={styles.actions}>{['LEAD', 'QUOTATION', 'NEW_BUSINESS', 'RENEWAL', 'COLLECTION', 'CROSS_SELL', 'DORMANT_ACCOUNT_REVIVAL', 'OTHER'].map((item) => <Action key={item} label={opportunityType === item ? `✓ ${item}` : item} onPress={() => setOpportunityType(item)} />)}</View>
          <Input label="Opportunity title" value={title} onChangeText={setTitle} />
          <Input label="Description" value={description} onChangeText={setDescription} multiline />
          <Input label="Expected sales value" value={potential} onChangeText={setPotential} keyboardType="decimal-pad" />
          <Input label="Premium value (optional)" value={premium} onChangeText={setPremium} keyboardType="decimal-pad" />
          <Text style={styles.label}>Sales currency</Text><View style={styles.actions}>{supportedCurrencies.map((item) => <Action key={`sales-${item}`} label={currency === item ? `✓ ${item}` : item} onPress={() => setCurrency(item)} />)}</View>
          {premium ? <><Text style={styles.label}>Premium currency</Text><View style={styles.actions}>{supportedCurrencies.map((item) => <Action key={`premium-${item}`} label={premiumCurrency === item ? `✓ ${item}` : item} onPress={() => setPremiumCurrency(item)} />)}</View></> : null}
          <View style={styles.inputWrap}><Text style={styles.label}>Expected close date</Text><Action label={expectedCloseDate || 'Choose date (optional)'} onPress={() => setCalendarOpen(true)} />{expectedCloseDate ? <Action label="Clear date" onPress={() => setExpectedCloseDate('')} /> : null}</View>
          <Input label="Source system (optional)" value={sourceSystem} onChangeText={setSourceSystem} />
          <Input label="External reference (optional)" value={externalReference} onChangeText={setExternalReference} />
          <Text style={styles.hint}>Currency must be allowed by the HRMS company Field Visit policy.</Text>
        </> : mode === 'checkout' ? <>
          <Input label="Discussion notes" value={notes} onChangeText={setNotes} multiline />
          <Input label="Outcome" value={outcome} onChangeText={setOutcome} />
        </> : mode === 'manager-opportunity' ? <>
          <Text style={styles.label}>Opportunity stage</Text><View style={styles.actions}>{['IDENTIFIED','FOLLOW_UP','QUOTATION_ISSUED','WON','LOST','DEFERRED','CANCELLED'].map((item) => <Action key={item} label={opportunityStatus === item ? `✓ ${item}` : item} onPress={() => setOpportunityStatus(item)} />)}</View>
          <Input label="Realized sales value (required for WON)" value={actualValue} onChangeText={setActualValue} keyboardType="decimal-pad" />
          <Input label="Reason (required and audited)" value={changeReason} onChangeText={setChangeReason} multiline />
        </> : <>
          <Input label="Default currency" value={policyDefaultCurrency} onChangeText={setPolicyDefaultCurrency} autoCapitalize="characters" />
          <Input label="Supported currencies (comma separated)" value={policyCurrencies} onChangeText={setPolicyCurrencies} autoCapitalize="characters" />
          <View style={styles.actions}><Action label={allowOpportunityValues ? '✓ Employees may enter forecasts' : 'Employees may enter forecasts'} onPress={() => setAllowOpportunityValues(true)} /><Action label={!allowOpportunityValues ? '✓ Employee forecasts disabled' : 'Disable employee forecasts'} onPress={() => setAllowOpportunityValues(false)} /></View>
          <Text style={styles.hint}>Changes are company-scoped and recorded in the HRMS audit log.</Text>
        </>}
        <View style={styles.actions}>
          <Action label="Cancel" onPress={() => setSelected(null)} />
          <Action label={saving ? 'Saving…' : 'Save'} disabled={saving} onPress={() => void save(refreshRows)} />
        </View>
      </View></View>
    </Modal>
    <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
      <View style={styles.dateScrim}><View style={styles.dateCard}><Text style={styles.heading}>Expected close date</Text><View style={styles.monthBar}><Action label="‹" onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} /><Text style={styles.monthTitle}>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Action label="›" onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} /></View><View style={styles.calendarGrid}>{['S','M','T','W','T','F','S'].map((day, index) => <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>)}{Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() }, (_, index) => <View key={`blank-${index}`} style={styles.dayCell} />)}{Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, index) => { const day = index + 1; const value = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const active = expectedCloseDate === value; return <Pressable key={value} accessibilityRole="button" accessibilityLabel={value} onPress={() => { setExpectedCloseDate(value); setCalendarOpen(false); }} style={[styles.dayCell, active && styles.daySelected]}><Text style={[styles.dayText, active && styles.daySelectedText]}>{day}</Text></Pressable>; })}</View><Action label="Cancel" onPress={() => setCalendarOpen(false)} /></View></View>
    </Modal>
  </>;
}

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} style={[styles.button, disabled && styles.disabled]} onPress={onPress}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

function Input(props: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'decimal-pad'; multiline?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) {
  const { label, ...inputProps } = props;
  return <View style={styles.inputWrap}><Text style={styles.label}>{label}</Text><TextInput {...inputProps} style={[styles.input, props.multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  queueBanner: { paddingHorizontal: 16, paddingVertical: 10, gap: 6, backgroundColor: '#eff6ff' },
  viewToggle: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  managerOpportunity: { width: '100%', gap: 4, paddingVertical: 6 },
  dateScrim: { flex: 1, justifyContent: 'center', backgroundColor: '#0008', padding: 20 },
  dateCard: { backgroundColor: COLORS.background, padding: 18, borderRadius: 14, gap: 12 },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 15, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.285%', textAlign: 'center', paddingVertical: 8, color: '#6b7280', fontWeight: '700' },
  dayCell: { width: '14.285%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  daySelected: { backgroundColor: '#2B3A8D' },
  dayText: { color: '#111827' },
  daySelectedText: { color: '#fff', fontWeight: '700' },
  error: { color: COLORS.error, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  button: { backgroundColor: '#2B3A8D', borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9 },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  detail: { width: '100%', color: '#6b7280', fontSize: 12, marginTop: 3 },
  disabled: { opacity: 0.5 },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' },
  card: { backgroundColor: COLORS.background, padding: 20, borderTopLeftRadius: 18, borderTopRightRadius: 18, gap: 8 },
  heading: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  inputWrap: { gap: 4 },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#9ca3af', borderRadius: 7, padding: 10, color: '#111827' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  hint: { color: '#6b7280', fontSize: 12 },
});
