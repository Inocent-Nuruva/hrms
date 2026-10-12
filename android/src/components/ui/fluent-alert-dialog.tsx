import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useThemePreference } from '../../hooks/useThemePreference';
import { COLORS } from '../../lib/config';
import { FluentButton } from './fluent-button';
import { FluentText } from './fluent-text';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
  onRetry?: () => void;
}

export function FluentAlertDialog({ visible, title, message, onDismiss, onRetry }: Props) {
  const { isDark } = useThemePreference();
  const surface = isDark ? COLORS.surfaceDark : COLORS.surface;
  const text = isDark ? COLORS.onSurfaceDark : COLORS.onSurface;
  const muted = isDark ? COLORS.onSurfaceVariantDark : COLORS.onSurfaceVariant;
  const border = isDark ? COLORS.outlineDark : COLORS.outline;

  const dismissAndRetry = () => {
    onDismiss();
    onRetry?.();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Dismiss alert" onPress={onDismiss} style={StyleSheet.absoluteFill} />
        <View
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: surface, borderColor: border }]}
        >
          <FluentText style={[styles.title, { color: text }]}>{title}</FluentText>
          <FluentText style={[styles.message, { color: muted }]}>{message}</FluentText>
          <View style={styles.actions}>
            {onRetry ? (
              <FluentButton appearance="outline" size="large" onPress={onDismiss} style={styles.actionButton}>
                Not now
              </FluentButton>
            ) : null}
            <FluentButton
              appearance="primary"
              size="large"
              onPress={onRetry ? dismissAndRetry : onDismiss}
              style={styles.actionButton}
            >
              {onRetry ? 'Try again' : 'OK'}
            </FluentButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  title: { fontSize: 18, lineHeight: 25, fontWeight: '700' },
  message: { marginTop: 10, fontSize: 14, lineHeight: 21 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  actionButton: { minHeight: 48, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
});
