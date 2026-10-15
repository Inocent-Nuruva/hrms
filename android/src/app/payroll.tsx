import React from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, RefreshCw } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { MobileTopBar } from "../components/layout/MobileTopBar";
import { Text } from "../components/ui/text";
import { LoadingIndicator } from "../components/ui/loading-indicator";
import { useAuth } from "../hooks/useAuth";
import { useThemePreference } from "../hooks/useThemePreference";
import { useAppAccent } from "../hooks/useAppAccent";
import { api } from "../lib/api";
import { COLORS } from "../lib/config";

type PayrollRecord = Record<string, unknown>;

function asRecord(value: unknown): PayrollRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as PayrollRecord)
    : {};
}

function textValue(record: PayrollRecord, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return fallback;
}

function money(value: unknown, currency: string) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount)
    ? `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
}

function PayrollScreen() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { isDark } = useThemePreference();
  const accent = useAppAccent();
  const background = isDark ? COLORS.backgroundDark : COLORS.background;
  const surface = isDark ? COLORS.surfaceDark : "#FFFFFF";
  const foreground = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const muted = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const border = isDark ? COLORS.outlineDark : "#E5E7EB";
  const [expandedPayslipId, setExpandedPayslipId] = React.useState<
    string | null
  >(null);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const payslipsQuery = useQuery({
    queryKey: ["myPayrollPayslips"],
    queryFn: () => api.listMyPayslips(),
    enabled: auth.isAuthenticated,
  });
  const summaryQuery = useQuery({
    queryKey: ["myPayrollSummary", new Date().getFullYear()],
    queryFn: () => api.getMyPayrollSummary(),
    enabled: auth.isAuthenticated,
  });
  const payslips = payslipsQuery.data ?? [];
  const summary = asRecord(summaryQuery.data);
  const ytd = asRecord(summary.ytd);

  const downloadPayslip = async (row: PayrollRecord) => {
    const id = textValue(row, ["id"], "");
    if (!id || !FileSystem.cacheDirectory) return;
    setDownloadingId(id);
    try {
      const file = await api.downloadMyPayslip(id);
      const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const destination = `${FileSystem.cacheDirectory}${safeFilename}`;
      await FileSystem.writeAsStringAsync(destination, file.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(destination, {
          mimeType: "application/pdf",
          dialogTitle: "Share payslip",
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert(
          "Payslip downloaded",
          `Saved ${safeFilename} to temporary app storage.`,
        );
      }
    } catch (error) {
      Alert.alert(
        "Download failed",
        error instanceof Error
          ? error.message
          : "Could not download this payslip.",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: background }]}>
      <MobileTopBar auth={auth} title="My payroll" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={payslipsQuery.isRefetching || summaryQuery.isRefetching}
            onRefresh={() =>
              void Promise.all([
                payslipsQuery.refetch(),
                summaryQuery.refetch(),
              ])
            }
            tintColor={accent}
          />
        }
      >
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={[styles.title, { color: foreground }]}>Payslips</Text>
            <Text style={[styles.subtitle, { color: muted }]}>
              Your published pay statements and year-to-date totals.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh payroll"
            onPress={() =>
              void queryClient.invalidateQueries({
                queryKey: ["myPayrollPayslips"],
              })
            }
            style={[styles.iconButton, { borderColor: border }]}
          >
            <RefreshCw size={18} color={accent} />
          </Pressable>
        </View>

        {summaryQuery.isError || payslipsQuery.isError ? (
          <View style={[styles.errorCard, { borderColor: border }]}>
            <Text style={[styles.body, { color: foreground }]}>
              Payroll information could not be loaded.
            </Text>
            <Text style={[styles.subtitle, { color: muted }]}>
              Pull down to retry. If the problem continues, contact HR.
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.summaryCard,
            { backgroundColor: surface, borderColor: border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: foreground }]}>
            Year to date
          </Text>
          <View style={styles.summaryGrid}>
            {[
              ["Gross pay", ytd.gross_pay],
              ["Deductions", ytd.deductions],
              ["Taxable pay", ytd.taxable_pay],
              ["Net pay", ytd.net_pay],
            ].map(([label, value]) => (
              <View key={String(label)} style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: muted }]}>
                  {String(label)}
                </Text>
                <Text style={[styles.summaryValue, { color: foreground }]}>
                  {money(
                    value,
                    textValue(asRecord(payslips[0]), ["currency"], "TZS"),
                  )}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.cardTitle, { color: foreground }]}>
            Payslip history
          </Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            {payslips.length} available
          </Text>
        </View>

        {payslipsQuery.isLoading ? (
          <View style={styles.loading}>
            <LoadingIndicator />
            <Text style={[styles.subtitle, { color: muted }]}>
              Loading payslips…
            </Text>
          </View>
        ) : payslips.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: surface, borderColor: border },
            ]}
          >
            <FileText size={28} color={muted} />
            <Text style={[styles.cardTitle, { color: foreground }]}>
              No payslips published yet
            </Text>
            <Text style={[styles.subtitle, { color: muted }]}>
              Published payslips will appear here.
            </Text>
          </View>
        ) : (
          payslips.map((value) => {
            const row = asRecord(value);
            const id = textValue(row, ["id"], "");
            const currency = textValue(row, ["currency"], "TZS");
            const period = textValue(
              asRecord(row.payroll_period),
              ["name", "code"],
              "Payslip",
            );
            const expanded = expandedPayslipId === id;
            const earnings = Array.isArray(row.earnings)
              ? row.earnings.map(asRecord)
              : [];
            const deductions = Array.isArray(row.deductions)
              ? row.deductions.map(asRecord)
              : [];
            return (
              <View
                key={id}
                style={[
                  styles.payslipCard,
                  { backgroundColor: surface, borderColor: border },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedPayslipId(expanded ? null : id)}
                  style={styles.payslipHeader}
                >
                  <View style={styles.payslipText}>
                    <Text style={[styles.cardTitle, { color: foreground }]}>
                      {period}
                    </Text>
                    <Text style={[styles.subtitle, { color: muted }]}>
                      {textValue(row, ["payslip_no", "payslip_number"])} ·{" "}
                      {textValue(row, ["status"], "Published")}
                    </Text>
                    <Text style={[styles.netPay, { color: foreground }]}>
                      {money(row.net_pay, currency)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Download payslip for ${period}`}
                    disabled={downloadingId === id}
                    onPress={() => void downloadPayslip(row)}
                    style={[
                      styles.downloadButton,
                      {
                        backgroundColor: accent,
                        opacity: downloadingId === id ? 0.55 : 1,
                      },
                    ]}
                  >
                    {downloadingId === id ? (
                      <LoadingIndicator />
                    ) : (
                      <Download size={18} color="#FFFFFF" />
                    )}
                  </Pressable>
                </Pressable>
                <View style={[styles.totalsRow, { borderTopColor: border }]}>
                  <Text style={[styles.subtitle, { color: muted }]}>
                    Gross {money(row.gross_pay, currency)}
                  </Text>
                  <Text style={[styles.subtitle, { color: muted }]}>
                    Issued {textValue(row, ["issued_at"]).slice(0, 10)}
                  </Text>
                </View>
                {expanded ? (
                  <View style={[styles.breakdown, { borderTopColor: border }]}>
                    {[...earnings, ...deductions].map((line, index) => (
                      <View
                        key={`${String(line.code ?? index)}-${index}`}
                        style={styles.lineRow}
                      >
                        <Text
                          style={[
                            styles.subtitle,
                            { color: foreground, flex: 1 },
                          ]}
                        >
                          {textValue(
                            line,
                            ["name", "component_name", "code"],
                            "Pay item",
                          )}
                        </Text>
                        <Text style={[styles.subtitle, { color: foreground }]}>
                          {money(line.amount, currency)}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.lineRow}>
                      <Text
                        style={[styles.subtitle, { color: muted, flex: 1 }]}
                      >
                        Tax
                      </Text>
                      <Text style={[styles.subtitle, { color: muted }]}>
                        {money(row.tax_amount, currency)}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default PayrollScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, paddingBottom: 36, gap: 16 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headingCopy: { flex: 1, gap: 4 },
  title: { fontSize: 25, fontWeight: "800" },
  subtitle: { fontSize: 13, lineHeight: 19 },
  body: { fontSize: 15, fontWeight: "600" },
  iconButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
  summaryItem: { width: "50%", gap: 4 },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 15, fontWeight: "700" },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loading: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyCard: {
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
    borderWidth: 1,
    borderRadius: 18,
  },
  errorCard: { padding: 14, borderWidth: 1, borderRadius: 14, gap: 5 },
  payslipCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 12 },
  payslipHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  payslipText: { flex: 1, gap: 4 },
  netPay: { fontSize: 18, fontWeight: "800", marginTop: 4 },
  downloadButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  breakdown: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 9,
  },
  lineRow: { flexDirection: "row", gap: 8, alignItems: "center" },
});
