import React, { useEffect } from 'react';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { COLORS } from '../../lib/config';
import { Text } from '../ui/text';

export function AttendanceQrScannerModal({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (value: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (visible && permission && !permission.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission, visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan workplace QR</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close QR scanner" onPress={onClose} style={styles.closeButton}>
            <X color="#ffffff" size={22} />
          </Pressable>
        </View>
        {!permission?.granted ? (
          <View style={styles.permissionPanel}>
            <Text style={styles.helpText}>Camera permission is needed to scan the attendance checkpoint.</Text>
            <Pressable onPress={() => void requestPermission()} style={styles.actionButton}>
              <Text style={styles.actionText}>Allow camera</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraFrame}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(result) => {
                if (result.data) onScanned(result.data);
              }}
            />
            <View pointerEvents="none" style={styles.scanGuide} />
            <Text style={styles.scanHint}>Place the rotating attendance QR code inside the frame.</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101820' },
  header: { minHeight: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  permissionPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 },
  helpText: { color: '#ffffff', fontSize: 16, textAlign: 'center' },
  actionButton: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.primary },
  actionText: { color: '#ffffff', fontWeight: '700' },
  cameraFrame: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  scanGuide: { width: 260, height: 260, borderWidth: 3, borderColor: '#ffffff', borderRadius: 22, backgroundColor: 'transparent' },
  scanHint: { position: 'absolute', bottom: 42, color: '#ffffff', fontSize: 15, textAlign: 'center', paddingHorizontal: 28 },
});
