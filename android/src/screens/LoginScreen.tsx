import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Image,
  Platform,
  ScrollView,
  Pressable,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { TouchableScale } from '../components/ui/touchable-scale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown, Eye, EyeOff, Fingerprint, Mail, MoonStar, ShieldCheck, SunMedium, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { COLORS } from '../lib/config';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../hooks/useToast';
import { useThemePreference } from '../hooks/useThemePreference';
import type { UseAuthReturn } from '../hooks/useAuth';
import allianceLogo from '../../assets/images/alliance-logo-wide.png';
import { Text } from '../components/ui/text';
import { getRememberedEmails, rememberSuccessfulEmail } from '../lib/remembered-emails';

interface LoginScreenProps {
  auth: UseAuthReturn;
}

export function LoginScreen({ auth }: LoginScreenProps) {
  const router = useRouter();
  const { isDark, toggleTheme } = useThemePreference();
  const { height: windowHeight } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberedEmails, setRememberedEmails] = useState<string[]>([]);
  const [showRememberedEmails, setShowRememberedEmails] = useState(false);

  const toast = useToast();

  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const subtlePanel = isDark ? COLORS.surfaceVariantDark : COLORS.surfaceVariant;
  const linkColor = isDark ? '#BFC2FF' : COLORS.primary;

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
      toast.error('Enter your email and password to continue.');
      return;
    }
    try {
      const result = await auth.login(email.trim(), password);
      if (!result.requiresOtp) {
        await saveCurrentEmail();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed. Please try again.';
      toast.error(msg, {
        action: {
          label: 'Retry',
          onPress: () => {
            // re-attempt with current values
            void handleLogin();
          },
        },
      });
    }
  };

  const handleVerify = async () => {
    if (otp.trim().length < 4) {
      toast.error('Enter the verification code sent to your account.');
      return;
    }
    try {
      await auth.verifyOtp(otp.trim());
      await saveCurrentEmail();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Invalid code. Please try again.';
      toast.error(msg, {
        action: {
          label: 'Retry',
          onPress: () => {
            void handleVerify();
          },
        },
      });
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <View style={styles.topActions}>
        <Pressable
          accessibilityLabel={isDark ? 'Use light theme' : 'Use dark theme'}
          onPress={toggleTheme}
          style={[styles.themeButton, { borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}
        >
          {isDark ? <SunMedium size={18} color={textColor} /> : <MoonStar size={18} color={textColor} />}
        </Pressable>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 18 : 0}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              minHeight: Math.max(windowHeight - 52, 0),
              justifyContent: windowHeight < 620 ? 'flex-start' : 'center',
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authShell}>
            <View style={styles.brandBlock}>
              <Image
                accessibilityLabel="Alliance Insurance"
                alt="Alliance Insurance"
                resizeMode="contain"
                source={allianceLogo}
                style={styles.logo}
              />
            </View>

            <Text style={[styles.headline, { color: textColor }]}>
              {showOtp ? 'Complete secure sign in' : 'Welcome back'}
            </Text>
            {showOtp ? (
              <Text style={[styles.supportingCopy, { color: mutedColor }]}>
                Enter the verification code sent to your account.
              </Text>
            ) : null}

          <View style={styles.authForm}>
            {showOtp ? (
              <View style={styles.cardHeader}>
                <View>
                  <Text style={[styles.cardEyebrow, { color: mutedColor }]}>Step 2 of 2</Text>
                  <Text style={[styles.cardTitle, { color: textColor }]}>
                    Verify your account
                  </Text>
                </View>
                <View style={[styles.iconBadge, { backgroundColor: subtlePanel }]}>
                  <ShieldCheck size={18} color={textColor} />
                </View>
              </View>
            ) : null}

            {!showOtp ? (
              <>
                <Input
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@company.com"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Select stored emails"
                  onPress={() => setShowRememberedEmails(true)}
                  style={styles.storedEmailTrigger}
                >
                  <Mail size={15} color={linkColor} />
                  <Text style={[styles.storedEmailTriggerText, { color: linkColor }]}>Select stored emails</Text>
                  <ChevronDown size={15} color={linkColor} />
                </Pressable>
                <View style={styles.passwordWrap}>
                  <Input
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    placeholder="Enter your password"
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    onPress={() => setShowPassword((current) => !current)}
                    style={styles.eyeButton}
                  >
                    {showPassword ? (
                      <EyeOff size={16} color={mutedColor} />
                    ) : (
                      <Eye size={16} color={mutedColor} />
                    )}
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => {
                    router.push({
                      pathname: '/forgot-password',
                      params: { email: email.trim().toLowerCase() },
                    });
                  }}
                  style={styles.forgotLink}
                >
                  <Text style={[styles.forgotLinkText, { color: linkColor }]}>Forgot password?</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Input
                  label="Verification code"
                  value={otp}
                  onChangeText={(value) => {
                    setOtp(value.replace(/\D/g, '').slice(0, 6));
                  }}
                  keyboardType="number-pad"
                  placeholder="123456"
                  hint="Enter the code sent by your organization."
                />
                <Pressable
                  onPress={() => {
                    setOtp('');
                    auth.resetOtp();
                  }}
                  hitSlop={12}
                >
                  <Text style={[styles.backLink, { color: mutedColor }]}>Use another account</Text>
                </Pressable>
              </>
            )}

            <View style={styles.actionRow}>
              <Button
                onPress={showOtp ? handleVerify : handleLogin}
                loading={auth.isLoading}
                style={[styles.submitButton, { flex: 1 }]}
              >
                {showOtp ? 'Verify and continue' : 'Sign in'}
              </Button>
              {!showOtp && showBiometricLogin && (
                <TouchableScale
                  accessibilityLabel={`Sign in with ${auth.biometricTypeLabel || 'biometrics'}`}
                  onPress={() => {
                    void auth.authenticateWithBiometricLogin();
                  }}
                  style={[styles.biometricIcon, { borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}
                >
                  <Fingerprint size={20} color={COLORS.primary} />
                </TouchableScale>
              )}
            </View>
            {showOtp ? (
              <Button
                onPress={() => {
                  setOtp('');
                  auth.resetOtp();
                }}
                variant="ghost"
                disabled={false}
              >
                Back to sign in
              </Button>
            ) : null}
          </View>

          <Text style={[styles.footerText, { color: mutedColor }]}>© {new Date().getFullYear()} Alliance Insurance Corporation Ltd</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
          <View
            style={[
              styles.emailSheet,
              {
                backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surface,
                borderColor: isDark ? COLORS.outlineDark : COLORS.outline,
              },
            ]}
          >
            <View style={styles.emailSheetHeader}>
              <View style={styles.emailSheetHeading}>
                <Text style={[styles.emailSheetTitle, { color: textColor }]}>Stored emails</Text>
                <Text style={[styles.emailSheetHelp, { color: mutedColor }]}>Choose an account used successfully on this device.</Text>
              </View>
              <Pressable
                accessibilityLabel="Close stored emails"
                onPress={() => setShowRememberedEmails(false)}
                style={[styles.sheetCloseButton, { borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}
              >
                <X size={17} color={textColor} />
              </Pressable>
            </View>

            {rememberedEmails.length ? (
              rememberedEmails.map((storedEmail) => {
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
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? COLORS.surfaceVariantDark
                            : '#F0F1FF'
                          : 'transparent',
                        borderColor: isDark ? COLORS.outlineDark : COLORS.outline,
                      },
                    ]}
                  >
                    <Mail size={17} color={isSelected ? linkColor : mutedColor} />
                    <Text numberOfLines={1} style={[styles.emailOptionText, { color: textColor }]}>
                      {storedEmail}
                    </Text>
                    {isSelected ? <Check size={17} color={linkColor} /> : null}
                  </Pressable>
                );
              })
            ) : (
              <View style={[styles.emptyEmailState, { borderColor: isDark ? COLORS.outlineDark : COLORS.outline }]}>
                <Mail size={20} color={mutedColor} />
                <Text style={[styles.emptyEmailTitle, { color: textColor }]}>No stored emails yet</Text>
                <Text style={[styles.emptyEmailText, { color: mutedColor }]}>An email appears here after it signs in successfully.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  topActions: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 2,
  },
  themeButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authShell: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  brandBlock: {
    height: 88,
    justifyContent: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 220,
    height: 88,
  },
  headline: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: -0.3,
    lineHeight: 26,
    textAlign: 'center',
  },
  supportingCopy: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: 'Comfortaa_400Regular',
    lineHeight: 19,
    textAlign: 'center',
  },
  authForm: {
    marginTop: 24,
    width: '100%',
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardEyebrow: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
    letterSpacing: -0.3,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordWrap: {
    position: 'relative',
  },
  storedEmailTrigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    marginTop: -8,
    marginBottom: 8,
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  storedEmailTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
    marginTop: -4,
    marginBottom: 12,
  },
  forgotLinkText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    top: 35,
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  submitButton: {
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    marginTop: 4,
    marginBottom: 0,
  },
  biometricIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLink: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Comfortaa_600SemiBold',
    marginBottom: 8,
  },
  footerText: {
    marginTop: 32,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Comfortaa_400Regular',
    lineHeight: 15,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  emailSheet: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
  },
  emailSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  emailSheetHeading: {
    flex: 1,
    minWidth: 0,
  },
  emailSheetTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
  },
  emailSheetHelp: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 17,
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  emailOption: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 8,
  },
  emailOptionText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Comfortaa_600SemiBold',
  },
  emptyEmailState: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  emptyEmailTitle: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Comfortaa_700Bold',
  },
  emptyEmailText: {
    marginTop: 5,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
});
