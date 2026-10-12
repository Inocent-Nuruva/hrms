import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FluentButton as Button } from '../components/ui/fluent-button';
import { FluentInput as Input } from '../components/ui/fluent-input';
import { FluentText as Text } from '../components/ui/fluent-text';
import { api, type ApiError } from '../lib/api';
import { AuthScaffold, authFieldStyle, useAuthColors } from '../components/auth/auth-scaffold';

const SUCCESS_MESSAGE =
  'If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder.';

export function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const colors = useAuthColors();
  const initialEmail = Array.isArray(params.email) ? params.email[0] : params.email;
  const [email, setEmail] = React.useState(initialEmail || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const submit = async () => {
    if (!email.trim()) {
      setError('Enter your email address.');
      setSuccess('');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.forgotPassword(email);
      setSuccess(SUCCESS_MESSAGE);
    } catch (requestError: unknown) {
      const status = (requestError as ApiError)?.status;
      if (status === 404 || status === 200) {
        setSuccess(SUCCESS_MESSAGE);
      } else {
        setError(requestError instanceof Error ? requestError.message : 'Unable to send a reset link right now. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScaffold onBack={() => router.replace('/login')}>
      <Text style={[styles.headline, { color: colors.text }]}>
        {success ? 'Check your inbox' : 'Reset your password'}
      </Text>
      <Text style={[styles.supportingCopy, { color: colors.muted }]}>
        {success ? SUCCESS_MESSAGE : 'We’ll email a link if this address is on an account.'}
      </Text>

      {success ? (
        <Button onPress={() => router.replace('/login')} size="large" block style={[styles.submitButton, styles.successAction]}>
          Back to sign in
        </Button>
      ) : (
        <View style={styles.form}>
          <Text style={[styles.fieldLabel, { color: colors.muted }]}>Email</Text>
          <Input
            accessibilityLabel="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="name@alliance.co.tz"
            style={authFieldStyle(colors.field)}
            value={email}
          />
          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
          <Button loading={loading} disabled={loading} onPress={() => void submit()} size="large" block style={styles.submitButton}>
            Send reset link
          </Button>
        </View>
      )}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  supportingCopy: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
  form: {
    marginTop: 28,
    width: '100%',
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  errorText: {
    marginTop: -6,
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 52,
    marginTop: 8,
    borderRadius: 12,
  },
  successAction: {
    marginTop: 28,
  },
});
