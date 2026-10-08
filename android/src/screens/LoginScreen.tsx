import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
} from 'react-native';
import { TouchableScale } from '../components/ui/touchable-scale';
import { useRouter } from 'expo-router';

import { FluentButton as Button } from '../components/ui/fluent-button';
import { FluentInput as Input } from '../components/ui/fluent-input';
import { FluentAlertDialog } from '../components/ui/fluent-alert-dialog';
import { FluentSystemIcon } from '../components/ui/fluent-system-icon';
import type { UseAuthReturn } from '../hooks/useAuth';
import { FluentText as Text } from '../components/ui/fluent-text';
import { getRememberedEmails, rememberSuccessfulEmail } from '../lib/remembered-emails';
import { COLORS } from '../lib/config';
import { AuthScaffold, authFieldStyle, useAuthColors } from '../components/auth/auth-scaffold';

interface LoginScreenProps {
  auth: UseAuthReturn;
}

export function LoginScreen({ auth }: LoginScreenProps) {
  const router = useRouter();
  const colors = useAuthColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberedEmails, setRememberedEmails] = useState<string[]>([]);
  const [showRememberedEmails, setShowRememberedEmails] = useState(false);
  const [authAlert, setAuthAlert] = useState<{ title: string; message: string; onRetry?: () => void } | null>(null);

  const fieldStyle = { ...authFieldStyle(colors.field), minHeight: 46 };
  const showOtp = auth.requiresOtp;
  const showBiometricLogin = auth.biometricEnabled && auth.hasStoredSession && !showOtp;

  React.useEffect(() => {
    let active = true;
    void getRememberedEmails().then((storedEmails) => {
      if (active) setRememberedEmails(storedEmails);
    });

    return () => {
      active = false;
    };
  }, []);

  const saveCurrentEmail = async () => {
    const updated = await rememberSuccessfulEmail(email);
    setRememberedEmails(updated);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setAuthAlert({
        title: 'Complete sign in',
        message: 'Enter your email and password to continue.',
      });
      return;
    }
    try {
      const result = await auth.login(email.trim(), password);
      if (!result.requiresOtp) {
        await saveCurrentEmail();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed. Please try again.';
      const invalidCredentials = /invalid credentials|invalid email or password|incorrect (email|password)|unauthorized|authentication failed|\b401\b/i.test(msg);
      setAuthAlert({
        title: invalidCredentials ? 'Check your sign-in details' : 'Could not sign in',
        message: invalidCredentials
          ? 'The email or password did not match. Check the details and try again. Your entries are still here.'
          : msg,
        onRetry: () => {
          void handleLogin();
        },
      });
    }
  };

  const handleVerify = async () => {
    if (otp.trim().length < 4) {
      setAuthAlert({
        title: 'Verification code required',
        message: 'Enter the verification code sent to your account.',
      });
      return;
    }
    try {
      await auth.verifyOtp(otp.trim());
      await saveCurrentEmail();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid code. Please try again.';
      setAuthAlert({
        title: 'Could not verify your account',
        message: msg,
        onRetry: () => {
          void handleVerify();
        },
      });
    }
  };

  return (
    <AuthScaffold>
      <Text style={[styles.headline, { color: colors.text }]}>
        {showOtp ? 'Enter your code' : 'Welcome back'}
      </Text>
      {showOtp ? (
        <Text style={[styles.supportingCopy, { color: colors.muted }]}>
          Enter the verification code sent to your account.
        </Text>
      ) : null}

      <View style={styles.authForm}>
        {!showOtp ? (
          <>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Email</Text>
            <Input
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              accessibilityLabel="Email"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="name@alliance.co.tz"
              style={fieldStyle}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select stored emails"
              onPress={() => setShowRememberedEmails(true)}
              style={styles.storedEmailTrigger}
            >
              <Text style={[styles.storedEmailTriggerText, { color: colors.muted }]}>Saved emails</Text>
              <FluentSystemIcon name="chevron-down" size={14} color={colors.muted} />
            </Pressable>
            <View style={styles.labelRow}>
              <Text style={[styles.fieldLabel, styles.labelRowLabel, { color: colors.muted }]}>Password</Text>
              <Pressable
                accessibilityRole="link"
                onPress={() => {
                  router.push({
                    pathname: '/forgot-password',
                    params: { email: email.trim().toLowerCase() },
                  });
                }}
                hitSlop={8}
              >
                <Text style={[styles.forgotLinkText, { color: colors.text }]}>Forgot password?</Text>
              </Pressable>
            </View>
            <Input
              value={password}
              onChangeText={setPassword}
              accessibilityLabel="Password"
              secureTextEntry={!showPassword}
              autoComplete="password"
              placeholder="Enter your password"
              style={fieldStyle}
              trailing={(
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  onPress={() => setShowPassword((current) => !current)}
                  style={styles.eyeButton}
                >
                  <FluentSystemIcon name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.muted} />
                </Pressable>
              )}
            />
          </>
        ) : (
          <>
            <Text style={[styles.fieldLabel, { color: colors.muted }]}>Verification code</Text>
            <Input
              value={otp}
              onChangeText={(value) => {
                setOtp(value.replace(/\D/g, '').slice(0, 6));
              }}
              keyboardType="number-pad"
              placeholder="6-digit code"
              style={fieldStyle}
            />
          </>
        )}

        <Button
          onPress={showOtp ? handleVerify : handleLogin}
          loading={auth.isSubmitting}
          disabled={auth.isSubmitting}
          size="large"
          block
          style={styles.submitButton}
        >
          {showOtp ? 'Verify and continue' : 'Sign in'}
        </Button>

        {!showOtp && showBiometricLogin ? (
          <TouchableScale
            accessibilityLabel={`Sign in with ${auth.biometricTypeLabel || 'biometrics'}`}
            onPress={() => {
              if (auth.isSubmitting) return;
              void auth.authenticateWithBiometricLogin();
            }}
            style={[
              styles.biometricRow,
              { borderColor: colors.line, backgroundColor: colors.sheet, opacity: auth.isSubmitting ? 0.6 : 1 },
            ]}
          >
            <FluentSystemIcon name="fingerprint" size={22} color={COLORS.primary} />
            <Text style={[styles.biometricText, { color: colors.text }]}>
              {`Use ${auth.biometricTypeLabel || 'biometrics'}`}
            </Text>
          </TouchableScale>
        ) : null}

        {showOtp ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setOtp('');
              auth.resetOtp();
            }}
            hitSlop={12}
            style={styles.backLinkButton}
          >
            <Text style={[styles.backLink, { color: colors.muted }]}>Back to sign in</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setShowRememberedEmails(false)}
        transparent
        visible={showRememberedEmails}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Close stored emails"
            onPress={() => setShowRememberedEmails(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.emailSheet, { backgroundColor: colors.canvas }]}>
            <View style={styles.emailSheetHeader}>
              <View style={styles.emailSheetHeading}>
                <Text style={[styles.emailSheetTitle, { color: colors.text }]}>Saved emails</Text>
                <Text style={[styles.emailSheetHelp, { color: colors.muted }]}>
                  Accounts that have signed in on this phone.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close stored emails"
                onPress={() => setShowRememberedEmails(false)}
                hitSlop={8}
                style={styles.sheetCloseButton}
              >
                <FluentSystemIcon name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            {rememberedEmails.length ? (
              rememberedEmails.map((storedEmail, index) => {
                const isSelected = storedEmail === email.trim().toLowerCase();
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={storedEmail}
                    onPress={() => {
                      setEmail(storedEmail);
                      setPassword('');
                      setShowRememberedEmails(false);
                    }}
                    style={[
                      styles.emailOption,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
                      isSelected && { backgroundColor: colors.isDark ? '#242424' : '#F6F6F6' },
                    ]}
                  >
                    <Text numberOfLines={1} style={[styles.emailOptionText, { color: colors.text }]}>
                      {storedEmail}
                    </Text>
                    {isSelected ? <FluentSystemIcon name="check" size={16} color={colors.text} /> : null}
                  </Pressable>
                );
              })
            ) : (
              <Text style={[styles.emptyEmailText, { color: colors.muted }]}>
                An email appears here after a successful sign in.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      <FluentAlertDialog
        visible={!!authAlert}
        title={authAlert?.title || ''}
        message={authAlert?.message || ''}
        onRetry={authAlert?.onRetry}
        onDismiss={() => setAuthAlert(null)}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  supportingCopy: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 300,
  },
  authForm: {
    marginTop: 16,
    width: '100%',
    maxWidth: 440,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  labelRowLabel: {
    marginBottom: 6,
  },
  storedEmailTrigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
    marginTop: 2,
    marginBottom: 8,
  },
  storedEmailTriggerText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  forgotLinkText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  eyeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 46,
    marginTop: 12,
    borderRadius: 12,
  },
  biometricRow: {
    marginTop: 8,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  biometricText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  backLinkButton: {
    alignSelf: 'center',
    marginTop: 8,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  backLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  emailSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 28,
  },
  emailSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 8,
  },
  emailSheetHeading: {
    flex: 1,
    minWidth: 0,
  },
  emailSheetTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  },
  emailSheetHelp: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  emailOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyEmailText: {
    paddingVertical: 20,
    fontSize: 14,
    lineHeight: 20,
  },
});
