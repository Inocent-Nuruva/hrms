import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  Text,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react-native';

import { COLORS } from '../lib/config';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';

interface LoginScreenProps {
  auth: {
    login: (email: string, password: string) => Promise<unknown>;
    verifyOtp: (code: string) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    requiresOtp: boolean;
    resetOtp: () => void;
  };
}

export function LoginScreen({ auth }: LoginScreenProps) {
  const isDark = useColorScheme() === 'dark';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const backgroundColor = isDark ? COLORS.backgroundDark : COLORS.background;
  const mutedColor = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const textColor = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const subtlePanel = isDark ? COLORS.surfaceVariantDark : '#f5f5f5';

  const showOtp = auth.requiresOtp;
  const errorMessage = auth.error || localError;

  const handleLogin = async () => {
    setLocalError(null);
    if (!email.trim() || !password.trim()) {
      setLocalError('Enter your email and password to continue.');
      return;
    }
    try {
      await auth.login(email.trim(), password);
    } catch {
      // surfaced through auth.error
    }
  };

  const handleVerify = async () => {
    setLocalError(null);
    if (otp.trim().length < 4) {
      setLocalError('Enter the verification code sent to your account.');
      return;
    }
    try {
      await auth.verifyOtp(otp.trim());
    } catch {
      // surfaced through auth.error
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.orbOne, { backgroundColor: isDark ? '#1f2937' : '#e5e7eb' }]} />
        <View style={[styles.orbTwo, { backgroundColor: isDark ? '#27272a' : '#f5f5f5' }]} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.heroBlock}>
            <Text style={[styles.headline, { color: textColor }]}>
              {showOtp ? 'Complete secure sign in' : 'Welcome back'}
            </Text>
            <Text style={[styles.supportingCopy, { color: mutedColor }]}>
              {showOtp ? 'Confirm the one-time code to finish your login securely.' : ''}
            </Text>
          </View>

          <Card style={styles.authCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.cardEyebrow, { color: mutedColor }]}>
                  {showOtp ? 'Step 2 of 2' : 'Sign in'}
                </Text>
                <Text style={[styles.cardTitle, { color: textColor }]}>
                  {showOtp ? 'Verify your account' : 'Access your workspace'}
                </Text>
              </View>
              <View style={[styles.iconBadge, { backgroundColor: subtlePanel }]}>
                {showOtp ? (
                  <ShieldCheck size={18} color={textColor} />
                ) : (
                  <Sparkles size={18} color={textColor} />
                )}
              </View>
            </View>

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
                    onPress={() => setShowPassword((current) => !current)}
                    style={[styles.eyeButton, { backgroundColor: subtlePanel }]}
                  >
                    {showPassword ? (
                      <EyeOff size={16} color={mutedColor} />
                    ) : (
                      <Eye size={16} color={mutedColor} />
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Input
                  label="Verification code"
                  value={otp}
                  onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="123456"
                  hint="Enter the code sent by your organization."
                />
                <Pressable onPress={auth.resetOtp}>
                  <Text style={[styles.backLink, { color: mutedColor }]}>Use another account</Text>
                </Pressable>
              </>
            )}

            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: isDark ? '#331b1b' : '#fef2f2', borderColor: isDark ? '#7f1d1d' : '#fecaca' }]}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <Button
              onPress={showOtp ? handleVerify : handleLogin}
              loading={auth.isLoading}
              style={styles.submitButton}
            >
              {showOtp ? 'Verify and continue' : 'Sign in'}
            </Button>
            {showOtp ? (
              <Button onPress={auth.resetOtp} variant="ghost">
                Back to login
              </Button>
            ) : null}
          </Card>

          <Text style={[styles.footerText, { color: mutedColor }]}>
            Secure employee access for attendance, leave, and profile actions.
          </Text>
          {auth.isLoading ? <ActivityIndicator style={styles.loader} color={COLORS.primary} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBlock: {
    marginBottom: 18,
    gap: 14,
    width: '100%',
    alignItems: 'center',
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 32,
    textAlign: 'center',
  },
  supportingCopy: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 520,
    textAlign: 'center',
  },
  authCard: {
    paddingTop: 20,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 520,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordWrap: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    top: 35,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: 4,
    marginBottom: 4,
  },
  backLink: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  footerText: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  loader: {
    marginTop: 12,
  },
  orbOne: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -40,
    right: -80,
    opacity: 0.35,
  },
  orbTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    bottom: 0,
    left: -70,
    opacity: 0.45,
  },
});
