import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Portal } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { useThemePreference } from './useThemePreference';
import { useAppAccent } from './useAppAccent';
import { Text } from '../components/ui/text';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  show: (options: ToastOptions | string) => void;
  error: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) => void;
  success: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) => void;
  info: (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) => void;
  hide: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface CurrentToast extends ToastOptions {
  id: number;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<CurrentToast | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [translateY] = useState(() => new Animated.Value(-80));
  const [opacity] = useState(() => new Animated.Value(0));
  const idCounter = useRef(0);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -80,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrent(null);
      translateY.setValue(-80);
      opacity.setValue(0);
    });
  }, [translateY, opacity]);

  const show = useCallback(
    (options: ToastOptions | string) => {
      const toastOptions: ToastOptions =
        typeof options === 'string' ? { message: options } : options;

      // Clear any existing
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const newToast: CurrentToast = {
        ...toastOptions,
        type: toastOptions.type ?? 'info',
        duration: toastOptions.duration ?? 4500,
        id: ++idCounter.current,
      };

      setCurrent(newToast);

      // Animate in
      translateY.setValue(-80);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          speed: 20,
          bounciness: 4,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss (longer if has action)
      const baseDuration = newToast.duration ?? 4500;
      const dismissAfter = newToast.action ? Math.max(baseDuration, 8000) : baseDuration;

      timeoutRef.current = setTimeout(() => {
        hide();
      }, dismissAfter);
    },
    [hide, translateY, opacity]
  );

  const error = useCallback(
    (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) => {
      show({ message, type: 'error', ...options });
    },
    [show]
  );

  const success = useCallback(
    (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) => {
      show({ message, type: 'success', ...options });
    },
    [show]
  );

  const info = useCallback(
    (message: string, options?: Partial<Omit<ToastOptions, 'message' | 'type'>>) => {
      show({ message, type: 'info', ...options });
    },
    [show]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const value = React.useMemo(
    () => ({ show, error, success, info, hide }),
    [show, error, success, info, hide]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current && (
        <Portal>
          <ToastRenderer
            toast={current}
            onHide={hide}
            translateY={translateY}
            opacity={opacity}
          />
        </Portal>
      )}
    </ToastContext.Provider>
  );
}

function ToastRenderer({
  toast,
  onHide,
  translateY,
  opacity,
}: {
  toast: CurrentToast;
  onHide: () => void;
  translateY: Animated.Value;
  opacity: Animated.Value;
}) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemePreference();
  const appAccent = useAppAccent();

  const type = toast.type ?? 'info';

  // Use the shared app accent for success and informational toast markers.
  let backgroundColor: string;
  let textColor: string;
  let accentColor: string;

  if (type === 'error') {
    backgroundColor = isDark ? '#292929' : '#F3F2F1';
    textColor = isDark ? '#F3F2F1' : '#242424';
    accentColor = isDark ? '#FF99A4' : '#C50F1F';
  } else if (type === 'success') {
    backgroundColor = isDark ? '#292929' : '#F3F2F1';
    textColor = isDark ? '#F3F2F1' : '#242424';
    accentColor = appAccent;
  } else {
    backgroundColor = isDark ? '#292929' : '#F3F2F1';
    textColor = isDark ? '#F3F2F1' : '#242424';
    accentColor = appAccent;
  }

  const handleActionPress = () => {
    if (toast.action) {
      toast.action.onPress();
      // Close after action unless the action itself shows another toast
      onHide();
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          opacity,
          transform: [{ translateY }],
          backgroundColor,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {/* Left accent bar */}
      <View style={[styles.accent, { backgroundColor: accentColor }]} />

      <View style={styles.content}>
        <Text style={[styles.message, { color: textColor }]} numberOfLines={3}>
          {toast.message}
        </Text>

        <View style={styles.actions}>
          {toast.action ? (
            <Pressable
              onPress={handleActionPress}
              style={[styles.actionButton, { borderColor: accentColor }]}
            >
              <Text style={[styles.actionText, { color: accentColor }]}>
                {toast.action.label}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onHide}
            hitSlop={12}
            style={styles.closeButton}
            accessibilityLabel="Close notification"
          >
            <X size={18} color={textColor} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingRight: 8,
    paddingLeft: 4,
    zIndex: 9999,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  } as ViewStyle,
  accent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginVertical: 4,
    marginRight: 10,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
    paddingTop: 2,
  } as TextStyle,
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 1,
  },
  actionButton: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 4,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeButton: {
    padding: 6,
    marginLeft: 2,
  },
});

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
