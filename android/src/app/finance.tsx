import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { MobileTopBar } from '../components/layout/MobileTopBar';
import { Text } from '../components/ui/text';
import { FluentActivityIndicator } from '../components/ui/fluent-activity-indicator';
import { useAuth } from '../hooks/useAuth';
import { useThemePreference } from '../hooks/useThemePreference';
import { COLORS } from '../lib/config';
import { api } from '../lib/api';

type Row = Record<string, unknown>;
type FinanceTab = 'products' | 'applications' | 'accounts' | 'guarantors';
type PickedFile = { name: string; size: number; mimeType: string; uri: string };

function value(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const item = row[key];
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (typeof item === 'number' && Number.isFinite(item)) return String(item);
  }
  return '';
}

function records(input: unknown): Row[] {
  return Array.isArray(input)
    ? input.filter((item): item is Row => typeof item === 'object' && item !== null && !Array.isArray(item))
    : [];
}

function rowRecord(input: unknown): Row {
  return typeof input === 'object' && input !== null && !Array.isArray(input) ? input as Row : {};
}

function requiredDocs(row: Row): string[] {
  const snapshot = rowRecord(row.productSnapshot ?? row.product_snapshot);
  const raw = row.requiredDocumentTypes ?? row.required_document_types ?? snapshot.requiredDocumentTypes ?? snapshot.required_document_types;
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
}

function requiredGuarantors(row: Row): number {
  const snapshot = rowRecord(row.productSnapshot ?? row.product_snapshot);
  const config = rowRecord(row.approvalConfiguration ?? row.approval_configuration ?? snapshot.approvalConfiguration ?? snapshot.approval_configuration);
  const count = Number(config.required_guarantors ?? config.requiredGuarantors ?? 0);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

export default function FinanceScreen() {
  const auth = useAuth();
  const { isDark } = useThemePreference();
  const [tab, setTab] = useState<FinanceTab>('products');
  const [products, setProducts] = useState<Row[]>([]);
  const [applications, setApplications] = useState<Row[]>([]);
  const [accounts, setAccounts] = useState<Row[]>([]);
  const [guarantorRequests, setGuarantorRequests] = useState<Row[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Row | null>(null);
  const [activeApplication, setActiveApplication] = useState<Row | null>(null);
  const [applicationDocuments, setApplicationDocuments] = useState<Row[]>([]);
  const [applicationGuarantors, setApplicationGuarantors] = useState<Row[]>([]);
  const [candidates, setCandidates] = useState<Row[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [statement, setStatement] = useState<Row | null>(null);
  const [statementAccountId, setStatementAccountId] = useState('');
  const [defermentRequest, setDefermentRequest] = useState<{ accountId: string; installmentId: string } | null>(null);
  const [defermentReason, setDefermentReason] = useState('');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('');
  const [purpose, setPurpose] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editTerm, setEditTerm] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [downloading, setDownloading] = useState(false);
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
      const [productRows, applicationRows, accountRows, requests] = await Promise.all([
        api.listMyFinanceProducts(), api.listMyFinanceApplications(), api.listMyFinanceAccounts(), api.listMyFinanceGuarantorRequests(),
      ]);
      setProducts(productRows); setApplications(applicationRows); setAccounts(accountRows); setGuarantorRequests(requests);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your finance details.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function openApplication(application: Row, product?: Row) {
    const merged = { ...application, ...(product ?? {}) };
    setActiveApplication(merged);
    setEditAmount(value(application, 'requestedAmount', 'requested_amount'));
    setEditTerm(value(application, 'requestedTermMonths', 'requested_term_months'));
    setEditPurpose(value(application, 'purpose'));
    setTab('applications');
    try {
      const id = value(application, 'id');
      const [documents, guarantors] = await Promise.all([
        api.listMyFinanceApplicationDocuments(id), api.listMyFinanceApplicationGuarantors(id),
      ]);
      setApplicationDocuments(documents); setApplicationGuarantors(guarantors);
    } catch (loadError) {
      Alert.alert('Could not load application requirements', loadError instanceof Error ? loadError.message : 'Please try again.');
    }
  }

  async function saveApplicationChanges() {
    if (!activeApplication) return;
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(editAmount.trim()) || Number(editAmount) <= 0 || !Number.isInteger(Number(editTerm)) || Number(editTerm) < 1 || !editPurpose.trim()) {
      Alert.alert('Check application details', 'Enter a valid amount, repayment term, and purpose.'); return;
    }
    setWorking(true);
    try {
      const updated = await api.updateMyFinanceApplication(value(activeApplication, 'id'), {
        requested_amount: editAmount.trim(), requested_term_months: Number(editTerm), purpose: editPurpose.trim(),
      });
      setActiveApplication({ ...activeApplication, ...updated }); await refresh();
      Alert.alert('Draft updated', 'Your corrected application details have been saved.');
    } catch (updateError) { Alert.alert('Could not update application', updateError instanceof Error ? updateError.message : 'Please review the terms and try again.'); }
    finally { setWorking(false); }
  }

  async function apply() {
    if (!selectedProduct) return;
    const productId = value(selectedProduct, 'id', 'product_id');
    const cleanAmount = amount.trim();
    const requestedTerm = Number(term);
    if (!productId || !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(cleanAmount) || Number(cleanAmount) <= 0 || !Number.isInteger(requestedTerm) || requestedTerm < 1 || !purpose.trim()) {
      Alert.alert('Check application details', 'Enter a valid amount (up to two decimal places), repayment term, and purpose.');
      return;
    }
    setWorking(true);
    try {
      const draft = await api.createMyFinanceApplication({
        product_id: Number(productId), requested_amount: cleanAmount, requested_term_months: requestedTerm, purpose: purpose.trim(),
      });
      setSelectedProduct(null); setAmount(''); setTerm(''); setPurpose('');
      await refresh();
      await openApplication({ ...draft, productSnapshot: selectedProduct });
      Alert.alert('Draft saved', 'Complete the document and guarantor requirements below, then submit your application.');
    } catch (submitError) {
      Alert.alert('Could not save application', submitError instanceof Error ? submitError.message : 'Please try again.');
    } finally { setWorking(false); }
  }

  async function pickDocument(documentType: string) {
    if (!activeApplication) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0] as PickedFile;
      if (!file.size || file.size > 8 * 1024 * 1024) {
        Alert.alert('File too large', 'Choose a document smaller than 8 MB.'); return;
      }
      const fileString = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
      await api.uploadMyFinanceApplicationDocument(value(activeApplication, 'id'), {
        document_type: documentType,
        file: { fileName: file.name, fileSize: file.size, mimeType: file.mimeType || 'application/octet-stream', fileString },
      });
      setApplicationDocuments(await api.listMyFinanceApplicationDocuments(value(activeApplication, 'id')));
      Alert.alert('Document uploaded', `${documentType} was attached to your draft.`);
    } catch (uploadError) {
      Alert.alert('Upload failed', uploadError instanceof Error ? uploadError.message : 'Could not upload the document.');
    }
  }

  async function searchCandidates() {
    if (candidateSearch.trim().length < 2) { Alert.alert('Search employees', 'Enter at least two characters.'); return; }
    try { setCandidates(await api.searchMyFinanceGuarantorCandidates(candidateSearch.trim())); }
    catch (searchError) { Alert.alert('Search failed', searchError instanceof Error ? searchError.message : 'Could not find employees.'); }
  }

  async function addGuarantor(candidate: Row) {
    if (!activeApplication) return;
    setWorking(true);
    try {
      await api.addMyFinanceApplicationGuarantor(value(activeApplication, 'id'), value(candidate, 'id'));
      setApplicationGuarantors(await api.listMyFinanceApplicationGuarantors(value(activeApplication, 'id')));
      setCandidates([]); setCandidateSearch('');
    } catch (addError) { Alert.alert('Could not add guarantor', addError instanceof Error ? addError.message : 'Please try again.'); }
    finally { setWorking(false); }
  }

  async function submitDraft() {
    if (!activeApplication) return;
    const missingDocs = requiredDocs(activeApplication).filter((type) => !applicationDocuments.some((doc) => value(doc, 'documentType', 'document_type').toUpperCase() === type.toUpperCase() && value(doc, 'status').toUpperCase() !== 'REJECTED'));
    const validGuarantors = applicationGuarantors.filter((item) => value(item, 'status').toUpperCase() !== 'REJECTED').length;
    if (missingDocs.length || validGuarantors < requiredGuarantors(activeApplication)) {
      Alert.alert('Requirements incomplete', `${missingDocs.length ? `Missing documents: ${missingDocs.join(', ')}. ` : ''}${Math.max(0, requiredGuarantors(activeApplication) - validGuarantors)} more guarantor(s) required.`); return;
    }
    setWorking(true);
    try {
      await api.submitMyFinanceApplication(value(activeApplication, 'id'));
      setActiveApplication(null); await refresh();
      Alert.alert('Application submitted', 'Your application is now in the approval workflow.');
    } catch (submitError) { Alert.alert('Could not submit application', submitError instanceof Error ? submitError.message : 'Please check the requirements and retry.'); }
    finally { setWorking(false); }
  }

  async function showStatement(account: Row) {
    const id = value(account, 'id', 'account_id');
    if (!id) return;
    try { setStatement(await api.getMyFinanceAccountStatement(id)); setStatementAccountId(id); }
    catch (statementError) { Alert.alert('Could not load statement', statementError instanceof Error ? statementError.message : 'Please try again.'); }
  }

  async function downloadStatement(format: 'pdf' | 'xlsx') {
    if (!statementAccountId || !FileSystem.cacheDirectory) return;
    setDownloading(true);
    try {
      const file = await api.downloadMyFinanceStatement(statementAccountId, format);
      const filename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, file.base64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Share loan statement' });
      else Alert.alert('Statement downloaded', `Saved ${filename} to temporary app storage.`);
    } catch (downloadError) { Alert.alert('Download failed', downloadError instanceof Error ? downloadError.message : 'Could not download this statement.'); }
    finally { setDownloading(false); }
  }

  async function downloadSanctionLetter(id: string) {
    if (!FileSystem.cacheDirectory) return;
    setDownloading(true);
    try {
      const file = await api.downloadMyFinanceSanctionLetter(id);
      const filename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, file.base64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path, { mimeType: 'application/pdf', dialogTitle: 'Review sanction letter' });
      else Alert.alert('Sanction letter downloaded', `Saved ${filename} to temporary app storage.`);
    } catch (letterError) { Alert.alert('Could not open sanction letter', letterError instanceof Error ? letterError.message : 'Please try again.'); }
    finally { setDownloading(false); }
  }

  async function acceptSanctionLetter(id: string) {
    setWorking(true);
    try { await api.acceptMyFinanceApplication(id); await refresh(); Alert.alert('Loan accepted', 'Your acceptance has been recorded.'); }
    catch (acceptError) { Alert.alert('Could not accept loan', acceptError instanceof Error ? acceptError.message : 'Please review the sanction letter and try again.'); }
    finally { setWorking(false); }
  }

  async function requestDeferment(account: Row) {
    const id = value(account, 'id', 'account_id');
    if (!id) return;
    try {
      const data = await api.getMyFinanceAccountStatement(id);
      const next = records(data.installments).find((item) => ['SCHEDULED', 'OVERDUE', 'PARTIALLY_PAID'].includes(value(item, 'status').toUpperCase()));
      const installmentId = next ? value(next, 'id', 'installment_id') : '';
      if (!installmentId) { Alert.alert('No eligible instalment', 'A deferment can be requested when an upcoming instalment is available.'); return; }
      setDefermentRequest({ accountId: id, installmentId }); setDefermentReason('');
    } catch (deferError) { Alert.alert('Could not load instalments', deferError instanceof Error ? deferError.message : 'Please try again.'); }
  }

  async function submitDeferment() {
    if (!defermentRequest || !defermentReason.trim()) { Alert.alert('Reason required', 'Enter a reason for your deferment request.'); return; }
    setWorking(true);
    try {
      await api.requestMyFinanceDeferment(defermentRequest.accountId, { installment_id: Number(defermentRequest.installmentId), reason: defermentReason.trim() });
      setDefermentRequest(null); setDefermentReason(''); await refresh(); Alert.alert('Request sent', 'Finance will review your deferment request.');
    } catch (deferError) { Alert.alert('Could not request deferment', deferError instanceof Error ? deferError.message : 'Please try again.'); }
    finally { setWorking(false); }
  }

  async function decideGuarantor(id: string, decision: 'APPROVED' | 'REJECTED') {
    try { await api.decideMyFinanceGuarantorRequest(id, decision); await refresh(); }
    catch (decisionError) { Alert.alert('Could not record decision', decisionError instanceof Error ? decisionError.message : 'Please try again.'); }
  }

  const activeRows = tab === 'products' ? products : tab === 'applications' ? applications : tab === 'accounts' ? accounts : guarantorRequests;
  const label = tab === 'products' ? 'Products' : tab === 'applications' ? 'Applications' : tab === 'accounts' ? 'My loans' : 'Guarantor requests';
  const statementAccount = rowRecord(statement?.account);
  const statementLedger = records(statement?.ledger ?? statement?.ledger_entries ?? statement?.ledgerEntries);
  const statementInstallments = records(statement?.installments);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: background }]} edges={['top']}>
      <MobileTopBar auth={auth} title="My finance" showBackButton variant="compact" />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} />}>
        <View style={styles.tabs}>
          {(['products', 'applications', 'accounts', 'guarantors'] as FinanceTab[]).map((key) => (
            <Pressable key={key} onPress={() => { setSelectedProduct(null); setTab(key); }} style={[styles.tab, { backgroundColor: tab === key ? accent : surface }]}>
              <Text style={{ color: tab === key ? '#fff' : textColor, fontWeight: '700' }}>{key === 'accounts' ? 'Loans' : key === 'guarantors' ? 'Guarantor' : key[0].toUpperCase() + key.slice(1)}</Text>
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
            <Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => { setSelectedProduct(product); setTerm(value(product, 'minimumTermMonths', 'minimum_term_months') || '1'); }}><Text style={styles.actionText}>Apply</Text></Pressable>
          </View>
        ))}
        {selectedProduct && tab === 'products' ? <View style={[styles.card, { backgroundColor: surface }]}>
          <Text style={[styles.heading, { color: textColor }]}>Apply: {value(selectedProduct, 'name')}</Text>
          <TextInput accessibilityLabel="Requested amount in TZS" keyboardType="decimal-pad" placeholder="Amount (TZS)" placeholderTextColor={muted} value={amount} onChangeText={setAmount} style={[styles.input, { color: textColor, borderColor: muted }]} />
          <TextInput accessibilityLabel="Repayment term in months" keyboardType="number-pad" placeholder="Term in months" placeholderTextColor={muted} value={term} onChangeText={setTerm} style={[styles.input, { color: textColor, borderColor: muted }]} />
          <TextInput accessibilityLabel="Loan purpose" placeholder="Purpose" placeholderTextColor={muted} value={purpose} onChangeText={setPurpose} style={[styles.input, styles.multiline, { color: textColor, borderColor: muted }]} multiline />
          <Pressable disabled={working} style={[styles.action, { backgroundColor: accent, opacity: working ? 0.6 : 1 }]} onPress={() => void apply()}><Text style={styles.actionText}>{working ? 'Saving…' : 'Save application draft'}</Text></Pressable>
        </View> : null}

        {tab === 'applications' && applications.map((application, index) => (
          <View key={value(application, 'id') || index} style={[styles.card, { backgroundColor: surface }]}>
            <Text style={[styles.heading, { color: textColor }]}>{value(application, 'applicationNo', 'application_no') || value(application, 'productName', 'product_name') || 'Loan application'}</Text>
            <Text style={[styles.copy, { color: muted }]}>Status: {value(application, 'status') || '—'} · TZS {value(application, 'requestedAmount', 'requested_amount')} · {value(application, 'requestedTermMonths', 'requested_term_months')} months</Text>
            {value(application, 'decisionComments', 'decision_comments', 'returnReason', 'return_reason') ? <Text style={[styles.copy, { color: COLORS.error }]}>Review note: {value(application, 'decisionComments', 'decision_comments', 'returnReason', 'return_reason')}</Text> : null}
            {['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(value(application, 'status').toUpperCase()) ? <Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => void openApplication(application)}><Text style={styles.actionText}>Complete and submit</Text></Pressable> : null}
            {value(application, 'status').toUpperCase() === 'PENDING_EMPLOYEE_ACCEPTANCE' ? <View style={styles.actions}><Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => void downloadSanctionLetter(value(application, 'id'))}><Text style={styles.actionText}>Review sanction letter</Text></Pressable><Pressable disabled={working} style={[styles.action, { backgroundColor: accent }]} onPress={() => void acceptSanctionLetter(value(application, 'id'))}><Text style={styles.actionText}>{working ? 'Recording…' : 'Accept loan'}</Text></Pressable></View> : null}
          </View>
        ))}
        {tab === 'applications' && activeApplication ? <View style={[styles.card, { backgroundColor: surface }]}>
          <Text style={[styles.heading, { color: textColor }]}>Complete {value(activeApplication, 'applicationNo', 'application_no') || 'draft'}</Text>
          <Text style={[styles.copy, { color: muted }]}>You can correct these details before resubmitting.</Text>
          <TextInput accessibilityLabel="Corrected requested amount" keyboardType="decimal-pad" placeholder="Amount (TZS)" placeholderTextColor={muted} value={editAmount} onChangeText={setEditAmount} style={[styles.input, { color: textColor, borderColor: muted }]} />
          <TextInput accessibilityLabel="Corrected repayment term" keyboardType="number-pad" placeholder="Term in months" placeholderTextColor={muted} value={editTerm} onChangeText={setEditTerm} style={[styles.input, { color: textColor, borderColor: muted }]} />
          <TextInput accessibilityLabel="Corrected loan purpose" placeholder="Purpose" placeholderTextColor={muted} value={editPurpose} onChangeText={setEditPurpose} style={[styles.input, styles.multiline, { color: textColor, borderColor: muted }]} multiline />
          <Pressable disabled={working} style={[styles.action, { backgroundColor: accent }]} onPress={() => void saveApplicationChanges()}><Text style={styles.actionText}>{working ? 'Saving…' : 'Save corrected details'}</Text></Pressable>
          {requiredDocs(activeApplication).map((docType) => {
            const uploaded = applicationDocuments.some((doc) => value(doc, 'documentType', 'document_type').toUpperCase() === docType.toUpperCase() && value(doc, 'status').toUpperCase() !== 'REJECTED');
            return <View key={docType} style={styles.inlineRow}><Text style={[styles.copy, { color: textColor }]}>{docType}: {uploaded ? 'Uploaded' : 'Required'}</Text>{!uploaded ? <Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => void pickDocument(docType)}><Text style={styles.actionText}>Choose file</Text></Pressable> : null}</View>;
          })}
          {applicationGuarantors.map((item) => <Text key={value(item, 'id')} style={[styles.copy, { color: textColor }]}>Guarantor {value(rowRecord(item.snapshot), 'full_name', 'employee_no') || value(item, 'guarantorEmployeeId', 'guarantor_employee_id')}: {value(item, 'status')}</Text>)}
          {requiredGuarantors(activeApplication) > applicationGuarantors.filter((item) => value(item, 'status').toUpperCase() !== 'REJECTED').length ? <>
            <Text style={[styles.copy, { color: muted }]}>Find an active colleague to invite as guarantor.</Text>
            <TextInput accessibilityLabel="Search active employees" placeholder="Employee name or number" placeholderTextColor={muted} value={candidateSearch} onChangeText={setCandidateSearch} style={[styles.input, { color: textColor, borderColor: muted }]} />
            <Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => void searchCandidates()}><Text style={styles.actionText}>Search employees</Text></Pressable>
            {candidates.map((candidate) => <View key={value(candidate, 'id')} style={styles.inlineRow}><Text style={[styles.copy, { color: textColor }]}>{value(candidate, 'first_name')} {value(candidate, 'last_name')} · {value(candidate, 'employee_no')}</Text><Pressable disabled={working} style={[styles.action, { backgroundColor: accent }]} onPress={() => void addGuarantor(candidate)}><Text style={styles.actionText}>Invite</Text></Pressable></View>)}
          </> : null}
          <Text style={[styles.copy, { color: muted }]}>Guarantors must accept before the loan reaches final approval.</Text>
          <View style={styles.actions}><Pressable disabled={working} style={[styles.action, { backgroundColor: accent, opacity: working ? 0.6 : 1 }]} onPress={() => void submitDraft()}><Text style={styles.actionText}>{working ? 'Submitting…' : 'Submit application'}</Text></Pressable><Pressable style={[styles.action, { backgroundColor: muted }]} onPress={() => setActiveApplication(null)}><Text style={styles.actionText}>Close</Text></Pressable></View>
        </View> : null}

        {tab === 'accounts' && accounts.map((account, index) => (
          <View key={value(account, 'id') || index} style={[styles.card, { backgroundColor: surface }]}>
            <Text style={[styles.heading, { color: textColor }]}>{value(account, 'accountNo', 'account_no') || 'Loan account'}</Text>
            <Text style={[styles.copy, { color: muted }]}>Status: {value(account, 'status')} · Outstanding: TZS {value(account, 'outstandingTotal', 'outstanding_total', 'outstandingPrincipal')}</Text>
            <View style={styles.actions}><Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => void showStatement(account)}><Text style={styles.actionText}>View statement</Text></Pressable><Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => void requestDeferment(account)}><Text style={styles.actionText}>Request deferment</Text></Pressable></View>
          </View>
        ))}
        {tab === 'accounts' && defermentRequest ? <View style={[styles.card, { backgroundColor: surface }]}>
          <Text style={[styles.heading, { color: textColor }]}>Defer an instalment</Text>
          <TextInput accessibilityLabel="Reason for deferment" placeholder="Reason for request" placeholderTextColor={muted} value={defermentReason} onChangeText={setDefermentReason} style={[styles.input, styles.multiline, { color: textColor, borderColor: muted }]} multiline />
          <View style={styles.actions}><Pressable disabled={working} style={[styles.action, { backgroundColor: accent }]} onPress={() => void submitDeferment()}><Text style={styles.actionText}>{working ? 'Sending…' : 'Send request'}</Text></Pressable><Pressable style={[styles.action, { backgroundColor: muted }]} onPress={() => setDefermentRequest(null)}><Text style={styles.actionText}>Cancel</Text></Pressable></View>
        </View> : null}
        {tab === 'guarantors' && guarantorRequests.map((request, index) => (
          <View key={value(request, 'id') || index} style={[styles.card, { backgroundColor: surface }]}>
            <Text style={[styles.heading, { color: textColor }]}>Guarantor request · {value(request, 'applicantName', 'applicant_name')}</Text>
            <Text style={[styles.copy, { color: muted }]}>{value(request, 'applicationNo', 'application_no')} · Status: {value(request, 'status')} · Requested amount: TZS {value(request, 'requestedAmount', 'requested_amount') || '—'}</Text>
            {value(request, 'status').toUpperCase() === 'PENDING' ? <View style={styles.actions}><Pressable style={[styles.action, { backgroundColor: accent }]} onPress={() => void decideGuarantor(value(request, 'id'), 'APPROVED')}><Text style={styles.actionText}>Accept</Text></Pressable><Pressable style={[styles.action, { backgroundColor: COLORS.error }]} onPress={() => void decideGuarantor(value(request, 'id'), 'REJECTED')}><Text style={styles.actionText}>Decline</Text></Pressable></View> : null}
          </View>
        ))}
      </ScrollView>
      <Modal visible={Boolean(statement)} animationType="slide" onRequestClose={() => setStatement(null)}>
        <SafeAreaView style={[styles.safe, { backgroundColor: background }]}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.heading, { color: textColor }]}>Loan statement · {value(statementAccount, 'accountNo', 'account_no') || statementAccountId}</Text>
            <Text style={[styles.copy, { color: textColor }]}>Outstanding principal: TZS {value(statementAccount, 'outstandingPrincipal', 'outstanding_principal')}</Text>
            <Text style={[styles.copy, { color: textColor }]}>Outstanding interest: TZS {value(statementAccount, 'outstandingInterest', 'outstanding_interest')}</Text>
            <Text style={[styles.copy, { color: textColor }]}>Fees and penalties: TZS {value(statementAccount, 'outstandingFees', 'outstanding_fees', 'outstandingPenalties', 'outstanding_penalties')}</Text>
            <Text style={[styles.copy, { color: textColor }]}>Total outstanding: TZS {value(statementAccount, 'outstandingTotal', 'outstanding_total')}</Text>
            <Text style={[styles.heading, { color: textColor }]}>Repayment schedule</Text>
            {statementInstallments.map((row, index) => <Text key={value(row, 'id') || index} style={[styles.copy, { color: muted }]}>{value(row, 'dueDate', 'due_date')} · {value(row, 'status')} · Principal {value(row, 'principalAmount', 'principal_amount')} · Interest {value(row, 'interestAmount', 'interest_amount')} · Paid {value(row, 'paidAmount', 'paid_amount')}</Text>)}
            <Text style={[styles.heading, { color: textColor }]}>Account activity</Text>
            {statementLedger.map((row, index) => <Text key={value(row, 'id') || index} style={[styles.copy, { color: muted }]}>{value(row, 'entryDate', 'entry_date', 'createdAt', 'created_at')} · {value(row, 'entryType', 'entry_type', 'type')} · {value(row, 'description')} · TZS {value(row, 'totalAmount', 'total_amount', 'amount')}</Text>)}
            <View style={styles.actions}><Pressable disabled={downloading} style={[styles.action, { backgroundColor: accent }]} onPress={() => void downloadStatement('pdf')}><Text style={styles.actionText}>{downloading ? 'Preparing…' : 'Download PDF'}</Text></Pressable><Pressable disabled={downloading} style={[styles.action, { backgroundColor: accent }]} onPress={() => void downloadStatement('xlsx')}><Text style={styles.actionText}>Download Excel</Text></Pressable><Pressable style={[styles.action, { backgroundColor: muted }]} onPress={() => setStatement(null)}><Text style={styles.actionText}>Close</Text></Pressable></View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 16, paddingBottom: 40, gap: 12 }, tabs: { flexDirection: 'row', gap: 6 },
  tab: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  card: { borderRadius: 12, padding: 14, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#9ca3af' },
  heading: { fontSize: 16, fontWeight: '700' }, copy: { fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderRadius: 8, minHeight: 44, paddingHorizontal: 12, fontSize: 15 },
  multiline: { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 },
  action: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, minHeight: 40, justifyContent: 'center' },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '700' }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
});
