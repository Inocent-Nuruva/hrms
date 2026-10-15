import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { Text } from '../components/ui/text';
import { FluentActivityIndicator } from '../components/ui/fluent-activity-indicator';
import { useAuth } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { COLORS } from '../lib/config';
import { api } from '../lib/api';

type Row = Record<string, unknown>;
type FinanceTab = 'products' | 'applications' | 'accounts';

function value(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const item = row[key];
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (typeof item === 'number' && Number.isFinite(item)) return String(item);
  }
  return '';
}

function records(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.filter((item): item is Row => typeof item === 'object' && item !== null && !Array.isArray(item))
    : [];
}

export default function FinanceScreen() {
  const auth = useAuth();
  const { isDark } = useThemePreference();
  const [tab, setTab] = useState<FinanceTab>('products');
  const [products, setProducts] = useState<Row[]>([]);
  const [applications, setApplications] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Row | null>(null);
  const [defermentRequest, setDefermentRequest] = useState<{ accountId: string; installmentId: string } | null>(null);
  const [defermentReason, setDefermentReason] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [purpose, setPurpose] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const background = isDark ? COLORS.backgroundDark : COLORS.background;
  const surface = isDark ? COLORS.surfaceDark : COLORS.surface;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const muted = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const accent = '#2B3A8D';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [productRows, applicationRows, accountRows] = await Promise.all([
        api.listMyFinanceProducts(),
        api.listMyFinanceApplications(),
        api.listMyFinanceAccounts(),
      ]);
      setProducts(productRows);
      setApplications(applicationRows);
      setAccounts(accountRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your finance details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function apply() {
    if (!selectedProduct) return;
    const productId = value(selectedProduct, 'id', 'product_id');
    const requestedAmount = Number(amount);
    const requestedTerm = Number(term);
    if (!productId || !Number.isFinite(requestedAmount) || requestedAmount <= 0 || !Number.isInteger(requestedTerm) || requestedTerm < 1 || !purpose.trim()) {
      Alert.alert('Check application details', 'Enter a valid amount, repayment term, and purpose.');
      return;
    }
    setWorking(true);
    try {
      const draft = await api.createMyFinanceApplication({
        product_id: Number(productId),
        requested_amount: requestedAmount.toFixed(2),
        requested_term_months: requestedTerm,
        purpose: purpose.trim(),
      });
      const id = value(draft, 'id');
      const rawDocs = selectedProduct.requiredDocumentTypes ?? selectedProduct.required_document_types;
      const guarantors = Number((selectedProduct.approvalConfiguration as Row | undefined)?.required_guarantors ?? (selectedProduct.approval_configuration as Row | undefined)?.required_guarantors ?? 0);
      if ((Array.isArray(rawDocs) && rawDocs.length > 0) || guarantors > 0) {
        Alert.alert('Draft saved', 'This product requires documents or guarantors. Open My Finance on the web to complete those steps before submitting.');
      } else if (id) {
        await api.submitMyFinanceApplication(id);
        Alert.alert('Application submitted', 'Your request has been submitted for approval.');
      } else {
        Alert.alert('Draft saved', 'Open My Finance on the web to review and submit your application.');
      }
      setSelectedProduct(null);
      setAmount(''); setTerm(''); setPurpose('');
      setTab('applications');
      await refresh();
    } catch (submitError) {
      Alert.alert('Could not submit application', submitError instanceof Error ? submitError.message : 'Please try again.');
      await refresh();
    } finally {
      setWorking(false);
    }
  }

  async function showStatement(account: Row) {
    const id = value(account, 'id', 'account_id');
    if (!id) return;
    try {
      const statement = await api.getMyFinanceAccountStatement(id);
      const statementAccount = (statement.account ?? {}) as Row;
      const summary = value(statementAccount, 'outstandingTotal', 'outstanding_total', 'outstandingPrincipal') || value(account, 'outstandingTotal', 'outstanding_total', 'outstandingPrincipal');
      const entries = records(statement.ledger_entries ?? statement.ledgerEntries ?? statement.installments);
      Alert.alert('Loan statement', `Account ${value(account, 'accountNo', 'account_no') || id}\nOutstanding: TZS ${summary || '—'}\nStatement entries: ${entries.length}`);
    } catch (statementError) {
      Alert.alert('Could not load statement', statementError instanceof Error ? statementError.message : 'Please try again.');
    }
  }

  async function requestDeferment(account: Row) {
    const id = value(account, 'id', 'account_id');
    if (!id) return;
    try {
      const statement = await api.getMyFinanceAccountStatement(id);
      const installments = records(statement.installments);
      const next = installments.find((item) => ['SCHEDULED', 'OVERDUE', 'PARTIALLY_PAID'].includes(value(item, 'status').toUpperCase()));
      const installmentId = next ? value(next, 'id', 'installment_id') : '';
      if (!installmentId) {
      Alert.alert('No eligible instalment', 'A deferment can be requested when an upcoming instalment is available.');
      return;
      }
      setDefermentRequest({ accountId: id, installmentId });
      setDefermentReason('');
    } catch (deferError) {
      Alert.alert('Could not load instalments', deferError instanceof Error ? deferError.message : 'Please try again.');
    }
  }

  async function submitDeferment() {
    if (!defermentRequest || !defermentReason.trim()) {
      Alert.alert('Reason required', 'Enter a reason for your deferment request.');
      return;
    }
    setWorking(true);
    try {
      await api.requestMyFinanceDeferment(defermentRequest.accountId, {
        installment_id: Number(defermentRequest.installmentId),
        reason: defermentReason.trim(),
      });
      setDefermentRequest(null);
      setDefermentReason('');
      Alert.alert('Request sent', 'Finance will review your deferment request.');
      await refresh();
    } catch (deferError) {
      Alert.alert('Could not request deferment', deferError instanceof Error ? deferError.message : 'Please try again.');
    } finally {
      setWorking(false);
    }
  }

  const activeRows = tab === 'products' ? products : tab === 'applications' ? applications : accounts;
  const label = tab === 'products' ? 'Products' : tab === 'applications' ? 'Applications' : 'My loans';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top']}>
      <MobileTopBar auth={auth} title="My finance" showBackButton variant="compact" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}
      >
        <View style={styles.tabs}>
          {(['products', 'applications', 'accounts'] as FinanceTab[]).map((key) => (
            <Pressable key={key} onPress={() => { setSelectedProduct(null); setTab(key); }} style={[styles.tab, { backgroundColor: tab === key ? accent : surface }]}>
              <Text style={{ color: tab === key ? '#fff' : textColor, fontWeight: '700' }}>{key === 'accounts' ? 'My loans' : key[0].toUpperCase() + key.slice(1)}</Text>
            </Pressable>
          ))}
        </View>
        {error ? <Text style={[styles.copy, { color: COLORS.error }]}>{error}</Text> : null}
        {loading && !activeRows.length ? <FluentActivityIndicator color={accent} /> : null}
        {!loading && !activeRows.length ? <Text style={[styles.copy, { color: muted }]}>No {label.toLowerCase()} found. Pull down to refresh.</Text> : null}
        {tab === 'products' && products.map((product, index) => (
          <View key={value(product, 'id') || index} style={[styles.card, { backgroundColor: surface }]}>
            <Text style={[styles.heading, { color: textColor }]}>{value(product, 'name') || 'Loan product'}</Text>
            <Text style={[styles.copy, { color: muted }]}>{value(product, 'description')}</Text>
            <Text style={[styles.copy, { color: textColor }]}>Amount: TZS {value(product, 'minimumAmount', 'minimum_amount')} – {value(product, 'maximumAmount', 'maximum_amount') || 'subject to eligibility'}</Text>
            <Text style={[styles.copy, { color: textColor }]}>Term: {value(product, 'minimumTermMonths', 'minimum_term_months')}–{value(product, 'maximumTermMonths', 'maximum_term_months')} months · Interest: {value(product, 'annualInterestRate', 'annual_interest_rate')}%</Text>
            <Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => { setSelectedProduct(product); setTerm(value(product, 'minimumTermMonths', 'minimum_term_months') || '1'); setTab('products'); }}>
              <Text style={styles.actionText}>{selectedProduct === product ? 'Selected' : 'Apply'}</Text>
            </Pressable>
          </View>
        ))}
        {selectedProduct && tab === 'products' ? (
          <View style={[styles.card, { backgroundColor: surface }]}>
            <Text style={[styles.heading, { color: textColor }]}>Apply: {value(selectedProduct, 'name')}</Text>
            <TextInput accessibilityLabel="Requested amount in TZS" keyboardType="decimal-pad" placeholder="Amount (TZS)" placeholderTextColor={muted} value={amount} onChangeText={setAmount} style={[styles.input, { color: textColor, borderColor: muted }]} />
            <TextInput accessibilityLabel="Repayment term in months" keyboardType="number-pad" placeholder="Term in months" placeholderTextColor={muted} value={term} onChangeText={setTerm} style={[styles.input, { color: textColor, borderColor: muted }]} />
            <TextInput accessibilityLabel="Loan purpose" placeholder="Purpose" placeholderTextColor={muted} value={purpose} onChangeText={setPurpose} style={[styles.input, styles.multiline, { color: textColor, borderColor: muted }]} multiline />
            <Pressable disabled={working} style={[styles.action, { backgroundColor: accent, opacity: working ? 0.6 : 1 }]} onPress={() => void apply()}>
              <Text style={styles.actionText}>{working ? 'Submitting…' : 'Submit application'}</Text>
            </Pressable>
          </View>
        ) : null}
        {tab === 'applications' && applications.map((application, index) => (
          <View key={value(application, 'id') || index} style={[styles.card, { backgroundColor: surface }]}>
            <Text style={[styles.heading, { color: textColor }]}>{value(application, 'applicationNo', 'application_no') || value(application, 'productName', 'product_name') || 'Loan application'}</Text>
            <Text style={[styles.copy, { color: muted }]}>Status: {value(application, 'status') || '—'} · TZS {value(application, 'requestedAmount', 'requested_amount')} · {value(application, 'requestedTermMonths', 'requested_term_months')} months</Text>
          </View>
        ))}
        {tab === 'accounts' && accounts.map((account, index) => (
          <View key={value(account, 'id') || index} style={[styles.card, { backgroundColor: surface }]}>
            <Text style={[styles.heading, { color: textColor }]}>{value(account, 'accountNo', 'account_no') || 'Loan account'}</Text>
            <Text style={[styles.copy, { color: muted }]}>Status: {value(account, 'status')} · Outstanding: TZS {value(account, 'outstandingTotal', 'outstanding_total', 'outstandingPrincipal')}</Text>
            <View style={styles.actions}>
              <Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => void showStatement(account)}><Text style={styles.actionText}>View statement</Text></Pressable>
              <Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => void requestDeferment(account)}><Text style={styles.actionText}>Request deferment</Text></Pressable>
            </View>
          </View>
        ))}
        {tab === 'accounts' && defermentRequest ? (
          <View style={[styles.card, { backgroundColor: surface }]}>
            <Text style={[styles.heading, { color: textColor }]}>Defer an instalment</Text>
            <TextInput accessibilityLabel="Reason for deferment" placeholder="Reason for request" placeholderTextColor={muted} value={defermentReason} onChangeText={setDefermentReason} style={[styles.input, styles.multiline, { color: textColor, borderColor: muted }]} multiline />
            <View style={styles.actions}>
              <Pressable disabled={working} style={[styles.action, { backgroundColor: accent }]} onPress={() => void submitDeferment()}><Text style={styles.actionText}>{working ? 'Sending…' : 'Send request'}</Text></Pressable>
              <Pressable style={[styles.action, { backgroundColor: muted }]} onPress={() => setDefermentRequest(null)}><Text style={styles.actionText}>Cancel</Text></Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  card: { borderRadius: 12, padding: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#9ca3af' },
  heading: { fontSize: 16, fontWeight: '700' },
  copy: { fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderRadius: 8, minHeight: 44, paddingHorizontal: 12, fontSize: 15 },
  multiline: { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 },
  action: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
