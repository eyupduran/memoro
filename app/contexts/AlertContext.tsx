import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────

type AlertVariant = 'info' | 'success' | 'error' | 'warning' | 'confirm';

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void | Promise<void>;
}

interface AlertConfig {
  title: string;
  message?: string;
  variant?: AlertVariant;
  buttons?: AlertButton[];
}

interface AlertContextValue {
  showAlert: (config: AlertConfig) => void;
}

// ─── Context ─────────────────────────────────────────────────────────

const AlertContext = createContext<AlertContextValue | null>(null);

export const useAlert = (): AlertContextValue => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used within AlertProvider');
  return ctx;
};

// ─── Helpers ─────────────────────────────────────────────────────────

const VARIANT_ICONS: Record<AlertVariant, keyof typeof MaterialIcons.glyphMap> = {
  info: 'info-outline',
  success: 'check-circle-outline',
  error: 'error-outline',
  warning: 'warning-amber',
  confirm: 'help-outline',
};

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Provider ────────────────────────────────────────────────────────

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig | null>(null);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 18,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setConfig(null);
    });
  }, []);

  const handleButtonPress = useCallback(async (btn: AlertButton) => {
    dismiss();
    if (btn.onPress) {
      // Small delay so the modal animation finishes before any async work
      setTimeout(() => { btn.onPress?.(); }, 180);
    }
  }, [dismiss]);

  if (!config) {
    return <AlertContext.Provider value={{ showAlert }}>{children}</AlertContext.Provider>;
  }

  const variant = config.variant ?? inferVariant(config);
  const iconName = VARIANT_ICONS[variant];
  const variantColor = getVariantColor(variant, colors);

  const buttons = config.buttons ?? [{ text: 'Tamam', style: 'default' }];
  const hasCancelButton = buttons.some(b => b.style === 'cancel');

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal
        transparent
        visible={visible}
        animationType="none"
        statusBarTranslucent
        onRequestClose={dismiss}
      >
        <TouchableWithoutFeedback onPress={dismiss}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback>
              <Animated.View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    transform: [{ scale: scaleAnim }],
                    opacity: opacityAnim,
                  },
                ]}
              >
                {/* Accent strip */}
                <View style={[styles.accentStrip, { backgroundColor: variantColor }]} />

                {/* Icon */}
                <View style={[styles.iconCircle, { backgroundColor: variantColor + '15' }]}>
                  <MaterialIcons name={iconName} size={28} color={variantColor} />
                </View>

                {/* Title */}
                <Text style={[styles.title, { color: colors.text.primary }]}>
                  {config.title}
                </Text>

                {/* Message */}
                {config.message ? (
                  <Text style={[styles.message, { color: colors.text.secondary }]}>
                    {config.message}
                  </Text>
                ) : null}

                {/* Buttons */}
                <View style={[
                  styles.buttonRow,
                  { borderTopColor: colors.border },
                  !hasCancelButton && styles.buttonRowSingle,
                ]}>
                  {buttons.map((btn, i) => {
                    const isDestructive = btn.style === 'destructive';
                    const isCancel = btn.style === 'cancel';
                    const btnColor = isDestructive
                      ? colors.error
                      : isCancel
                        ? colors.text.secondary
                        : colors.primary;

                    return (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.7}
                        style={[
                          styles.button,
                          hasCancelButton && i < buttons.length - 1 && {
                            borderRightWidth: 1,
                            borderRightColor: colors.border,
                          },
                          isDestructive && { backgroundColor: colors.error + '08' },
                        ]}
                        onPress={() => handleButtonPress(btn)}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            { color: btnColor },
                            (isDestructive || (!isCancel && !hasCancelButton)) && styles.buttonTextBold,
                          ]}
                        >
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </AlertContext.Provider>
  );
};

// ─── Variant inference ───────────────────────────────────────────────

function inferVariant(cfg: AlertConfig): AlertVariant {
  if (cfg.variant) return cfg.variant;
  const hasDestructive = cfg.buttons?.some(b => b.style === 'destructive');
  const hasCancel = cfg.buttons?.some(b => b.style === 'cancel');
  if (hasDestructive) return 'confirm';
  if (hasCancel) return 'confirm';
  return 'info';
}

function getVariantColor(variant: AlertVariant, colors: any): string {
  switch (variant) {
    case 'success': return '#4CAF50';
    case 'error': return colors.error || '#f44336';
    case 'warning': return '#FF9800';
    case 'confirm': return colors.primary;
    case 'info':
    default: return colors.primary;
  }
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: Math.min(SCREEN_W - 64, 340),
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  accentStrip: {
    height: 4,
    width: '100%',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 14,
    marginHorizontal: 24,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 24,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 20,
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
  },
  buttonTextBold: {
    fontWeight: '600',
  },
});
