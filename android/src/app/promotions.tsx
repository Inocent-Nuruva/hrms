import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../lib/config';

export default function PromotionsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.title}>Promotions</Text>
        <Text style={styles.copy}>This page is intentionally empty for now.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.backgroundDark,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: COLORS.onSurfaceDark,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  copy: {
    color: COLORS.onSurfaceVariantDark,
    fontSize: 16,
  },
});
