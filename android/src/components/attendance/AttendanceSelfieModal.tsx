import React from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ArrowLeft, Camera, Check, Clock3, MapPin, RotateCcw } from 'lucide-react-native';
import { FluentText as Text } from '../ui/fluent-text';
import { useThemePreference } from '../../hooks/useThemePreference';
import { useAppAccent, useAppAccentForeground } from '../../hooks/useAppAccent';

export interface AttendanceSelfie {
  uri: string;
  fileName: string;
  fileSize: number;
  mimeType: 'image/jpeg';
  fileString: string;
}

interface Props {
  visible: boolean;
  mode?: 'in' | 'out';
  submitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (selfie: AttendanceSelfie) => void;
}

const MAX_SELFIE_BYTES = 64 * 1024;

export function AttendanceSelfieModal({
  visible,
  mode = 'in',
  submitting = false,
  errorMessage,
  onClose,
  onSubmit,
}: Props) {
  const punchLabel = mode === 'in' ? 'check-in' : 'check-out';
  const { isDark } = useThemePreference();
  const accent = useAppAccent();
  const accentForeground = useAppAccentForeground();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = React.useState(false);
  const [pictureSize, setPictureSize] = React.useState<string>();
  const [capturing, setCapturing] = React.useState(false);
  const [captureError, setCaptureError] = React.useState<string | null>(null);
  const [selfie, setSelfie] = React.useState<AttendanceSelfie | null>(null);
  const [now, setNow] = React.useState(() => new Date());
  const cameraRef = React.useRef<CameraView>(null);

  const backgroundColor = isDark ? '#11161D' : '#F1F4F7';
  const panelColor = isDark ? '#202832' : '#FFFFFF';
  const textColor = isDark ? '#F4F7FB' : '#17212C';
  const mutedColor = isDark ? '#A5B1BF' : '#647384';

  React.useEffect(() => {
    if (!visible) {
      setSelfie(null);
      setCaptureError(null);
      setCameraReady(false);
      setPictureSize(undefined);
      return;
    }

    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const onCameraReady = React.useCallback(async () => {
    setCameraReady(true);
    setCaptureError(null);
    if (pictureSize || !cameraRef.current) return;

    try {
      const sizes = await cameraRef.current.getAvailablePictureSizesAsync();
      const parsed = sizes
        .map((size) => ({ size, dimensions: size.split('x').map(Number) }))
        .filter((item) => item.dimensions.length === 2 && item.dimensions.every(Number.isFinite))
        .sort((left, right) =>
          left.dimensions[0] * left.dimensions[1] - right.dimensions[0] * right.dimensions[1],
        );
      const compactSize = parsed.find(
        ({ dimensions }) => dimensions[0] <= 640 && dimensions[1] <= 640,
      );
      if (compactSize) {
        setPictureSize(compactSize.size);
      }
    } catch {
      // Keep the camera's default size when a device does not report its sizes.
    }
  }, [pictureSize]);

  const takeSelfie = React.useCallback(async () => {
    if (!cameraReady || !cameraRef.current || capturing) return;
    setCapturing(true);
    setCaptureError(null);

    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.22,
        base64: true,
        exif: false,
      });
      if (!picture?.uri || !picture.base64) {
        throw new Error('The camera could not prepare the selfie. Please try again.');
      }

      const padding = picture.base64.endsWith('==') ? 2 : picture.base64.endsWith('=') ? 1 : 0;
      const fileSize = Math.floor((picture.base64.length * 3) / 4) - padding;
      if (fileSize > MAX_SELFIE_BYTES) {
        throw new Error('The selfie is too large to upload. Move closer to the camera and try again.');
      }

      setSelfie({
        uri: picture.uri,
        fileName: 'attendance-selfie.jpg',
        fileSize,
        mimeType: 'image/jpeg',
        fileString: picture.base64,
      });
      Vibration.vibrate(12);
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : 'Could not capture the selfie. Try again.');
    } finally {
      setCapturing(false);
    }
  }, [cameraReady, capturing]);

  const enableCamera = React.useCallback(async () => {
    if (permission?.canAskAgain === false) {
      setCaptureError('Camera access is blocked. Enable it in your device settings to take a check-in selfie.');
      return;
    }

    const result = await requestPermission();
    if (!result.granted) {
      setCaptureError('Camera access is needed to take a check-in selfie.');
    } else {
      setCaptureError(null);
    }
  }, [permission?.canAskAgain, requestPermission]);

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Close selfie camera">
            <ArrowLeft size={20} color={textColor} />
          </Pressable>
          <View style={[styles.liveBadge, { backgroundColor: isDark ? '#1D352F' : '#E6F7EF' }]}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveBadgeText, { color: isDark ? '#A4E5C1' : '#22734A' }]}>{`SELFIE ${mode === 'in' ? 'CHECK-IN' : 'CHECK-OUT'}`}</Text>
          </View>
          <View style={styles.backButtonPlaceholder} />
        </View>

        <View style={styles.cameraStage}>
          {permission?.granted ? (
            selfie ? (
              <Image alt="Captured attendance selfie preview" accessibilityLabel="Captured attendance selfie preview" source={{ uri: selfie.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="front"
                mirror
                mode="picture"
                pictureSize={pictureSize}
                onCameraReady={onCameraReady}
                onMountError={(error) => {
                  setCameraReady(false);
                  setCaptureError(error.message || 'The camera could not start on this device.');
                }}
              />
            )
          ) : (
            <View style={[styles.permissionPanel, { backgroundColor: panelColor }]}>
              <View style={[styles.permissionIcon, { backgroundColor: accent }]}>
                <Camera size={27} color={accentForeground} />
              </View>
              <Text style={[styles.permissionTitle, { color: textColor }]}>Camera access needed</Text>
              <Text style={[styles.permissionCopy, { color: mutedColor }]}>Allow camera access to take a selfie for your attendance check-in.</Text>
              <Pressable
                style={[styles.permissionButton, { backgroundColor: accent }]}
                onPress={() => {
                  if (permission?.canAskAgain === false) {
                    void Linking.openSettings();
                  } else {
                    void enableCamera();
                  }
                }}
              >
                <Text style={[styles.permissionButtonText, { color: accentForeground }]}>
                  {permission?.canAskAgain === false ? 'Open settings' : 'Enable camera'}
                </Text>
              </Pressable>
            </View>
          )}

          {permission?.granted && !selfie ? (
            <>
              <View pointerEvents="none" style={styles.cameraShade} />
              <View pointerEvents="none" style={styles.faceGuide}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View pointerEvents="none" style={styles.scanLine} />
              <View pointerEvents="none" style={styles.cameraPrompt}>
                <Text style={styles.cameraPromptText}>Center your face in the frame</Text>
              </View>
            </>
          ) : null}
          {!cameraReady && !captureError && permission?.granted && !selfie ? (
            <View style={styles.cameraLoading} pointerEvents="none">
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        <View style={[styles.bottomPanel, { backgroundColor: panelColor }]}>
          <Text style={[styles.panelTitle, { color: textColor }]}>
            {selfie ? 'Review your selfie' : `${mode === 'in' ? 'Check-in' : 'Check-out'} selfie`}
          </Text>
          <Text style={[styles.panelSubtitle, { color: mutedColor }]}>
            {selfie ? `Make sure your face is clear before ${punchLabel}.` : 'Use a clear, well-lit photo so your attendance can be verified.'}
          </Text>

          <View style={styles.contextRow}>
            <View style={[styles.contextChip, { backgroundColor: isDark ? '#2A3541' : '#F2F5F8' }]}>
              <MapPin size={15} color="#3879AD" />
              <View style={styles.contextCopy}>
                <Text style={[styles.contextLabel, { color: mutedColor }]}>LOCATION</Text>
                <Text style={[styles.contextValue, { color: textColor }]}>Checked on submit</Text>
              </View>
            </View>
            <View style={[styles.contextChip, { backgroundColor: isDark ? '#2A3541' : '#F2F5F8' }]}>
              <Clock3 size={15} color="#3879AD" />
              <View style={styles.contextCopy}>
                <Text style={[styles.contextLabel, { color: mutedColor }]}>CURRENT TIME</Text>
                <Text style={[styles.contextValue, { color: textColor }]}>
                  {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          </View>

          {captureError || errorMessage ? (
            <Text style={styles.errorText}>{captureError || errorMessage}</Text>
          ) : null}

          {selfie ? (
            <View style={styles.reviewActions}>
              <Pressable
                disabled={submitting}
                style={[styles.retakeButton, { borderColor: isDark ? '#556474' : '#D5DEE7' }]}
                onPress={() => {
                  setSelfie(null);
                  setCaptureError(null);
                  setCameraReady(false);
                }}
              >
                <RotateCcw size={17} color={textColor} />
                <Text style={[styles.retakeText, { color: textColor }]}>Retake</Text>
              </Pressable>
              <Pressable
                disabled={submitting}
                style={[styles.submitButton, { backgroundColor: accent, shadowColor: accent }, submitting && styles.disabledButton]}
                onPress={() => onSubmit(selfie)}
              >
                {submitting ? <ActivityIndicator color={accentForeground} size="small" /> : <Check size={19} color={accentForeground} />}
                <Text style={[styles.submitButtonText, { color: accentForeground }]}>{submitting ? `Checking ${mode === 'in' ? 'in' : 'out'}…` : mode === 'in' ? 'Check in' : 'Check out'}</Text>
              </Pressable>
            </View>
          ) : permission?.granted ? (
            <Pressable
              disabled={!cameraReady || capturing}
              style={[styles.submitButton, { backgroundColor: accent, shadowColor: accent }, (!cameraReady || capturing) && styles.disabledButton]}
              onPress={() => void takeSelfie()}
            >
              {capturing ? <ActivityIndicator color={accentForeground} size="small" /> : <Camera size={19} color={accentForeground} />}
              <Text style={[styles.submitButtonText, { color: accentForeground }]}>{capturing ? 'Taking selfie…' : 'Take selfie'}</Text>
            </Pressable>
          ) : null}

          <View style={styles.privacyNote}>
            <View style={styles.privacyDot} />
            <Text style={[styles.privacyText, { color: mutedColor }]}>Your selfie will be saved with this attendance record.</Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 17 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: 'rgba(127,142,158,0.13)' },
  backButtonPlaceholder: { width: 40, height: 40 },
  liveBadge: { height: 30, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, borderRadius: 20 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3CA96B' },
  liveBadgeText: { fontSize: 9, lineHeight: 13, fontWeight: '700', letterSpacing: 0.8 },
  cameraStage: { flex: 1, minHeight: 240, marginHorizontal: 9, overflow: 'hidden', borderRadius: 25, backgroundColor: '#202832' },
  cameraShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(6,12,18,0.12)' },
  faceGuide: { position: 'absolute', top: '23%', left: '11%', width: '78%', height: '53%' },
  corner: { position: 'absolute', width: 37, height: 37, borderColor: '#FFFFFF', borderWidth: 4 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 24 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 24 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 24 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 24 },
  scanLine: { position: 'absolute', top: '31%', left: '11%', right: '11%', height: 2, backgroundColor: '#74BFFF', opacity: 0.86 },
  cameraPrompt: { position: 'absolute', top: 16, alignSelf: 'center', paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(13,20,27,0.56)' },
  cameraPromptText: { color: '#FFFFFF', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  cameraLoading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  permissionPanel: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  permissionIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  permissionTitle: { marginTop: 15, fontSize: 18, lineHeight: 25, fontWeight: '700', textAlign: 'center' },
  permissionCopy: { marginTop: 7, maxWidth: 300, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  permissionButton: { marginTop: 18, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 13 },
  permissionButtonText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  bottomPanel: { marginHorizontal: 13, marginTop: 12, marginBottom: 7, paddingHorizontal: 18, paddingTop: 17, paddingBottom: 13, borderRadius: 25 },
  panelTitle: { fontSize: 19, lineHeight: 26, fontWeight: '700', textAlign: 'center' },
  panelSubtitle: { marginTop: 4, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  contextRow: { flexDirection: 'row', gap: 9, marginTop: 15 },
  contextChip: { flex: 1, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 13 },
  contextCopy: { flex: 1, minWidth: 0 },
  contextLabel: { fontSize: 8, lineHeight: 11, fontWeight: '700', letterSpacing: 0.5 },
  contextValue: { marginTop: 2, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  errorText: { marginTop: 10, color: '#C93838', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  reviewActions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  retakeButton: { minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 15, borderWidth: 1, borderRadius: 14 },
  retakeText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  submitButton: { flex: 1, minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 15, borderRadius: 15, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 4 },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, lineHeight: 21, fontWeight: '700' },
  disabledButton: { opacity: 0.58 },
  privacyNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  privacyDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#3CA96B' },
  privacyText: { fontSize: 9, lineHeight: 13 },
});
