import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  Switch,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';

import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';
import { RootStackParamList } from '../types/navigation';

import {
  autoWallpaperService,
  AutoWallpaperSettings,
  OverlaySnapshot,
} from '../services/autoWallpaper';
import * as Wallpaper from 'expo-wallpaper';
import type { Word } from '../types/words';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoWallpaperSettings'>;

const MIUI_ONBOARDING_FLAG = 'auto_wallpaper_miui_onboarding_done';

const SCREEN = Dimensions.get('screen');
const WINDOW = Dimensions.get('window');

// ---- Constants matching WordOverlayScreen defaults ----
const LEVEL_OPTIONS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WORD_COUNT_OPTIONS = [3, 4, 5];

/**
 * Match WordOverlayScreen's getInitialVerticalPosition formula so that
 * the preview and the captured PNG place words at the same spot. Uses
 * absolute top-down positioning (not center-offset). Minimum floor of
 * 50% of screen height keeps words below the MIUI lock-screen clock
 * and visually centered in the preview (which is partially covered by
 * the button bar at the bottom).
 */
const getInitialVerticalPosition = (wordCount: number): number => {
  const estimatedWordHeight = 110;
  const totalContentHeight = wordCount * estimatedWordHeight;
  const minTop = WINDOW.height * 0.45;
  const centeredTop = WINDOW.height * 0.49 - totalContentHeight / 2;
  const maxTop = WINDOW.height * 0.75;
  return Math.min(Math.max(centeredTop, minTop), maxTop);
};

/**
 * Auto-wallpaper settings screen.
 *
 * User-tunable options: level, word count, time, enable toggle.
 * Every visual aspect (layout, colour, font, position, background) uses
 * the defaults that WordOverlayScreen uses on first open.
 *
 * The preview is a full-screen ViewShot scaled down with a CSS transform.
 * "Şimdi Dene" captures the *same* ViewShot (at real screen size), so
 * what the user sees in the preview is byte-for-byte identical to the
 * PNG applied to the lock screen.
 */
export const AutoWallpaperSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const { showAlert } = useAlert();

  const [settings, setSettings] = useState<AutoWallpaperSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'test' | 'save' | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<Wallpaper.DeviceInfo>({
    isMiui: false,
    manufacturer: 'unknown',
    androidApiLevel: 0,
  });

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [pendingHour, setPendingHour] = useState(8);
  const [pendingMinute, setPendingMinute] = useState(0);

  const [miuiOnboardingVisible, setMiuiOnboardingVisible] = useState(false);
  const [miuiStep, setMiuiStep] = useState<1 | 2 | 3>(1);

  // Real words picked from DB for the preview (matches what will go to cache)
  const [previewWords, setPreviewWords] = useState<Word[]>([]);
  const [previewBackground, setPreviewBackground] = useState<string>('');

  const viewShotRef = useRef<ViewShot>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, di] = await Promise.all([
        autoWallpaperService.getSettings(),
        Promise.resolve(Wallpaper.getDeviceInfo()),
      ]);
      setSettings(s);
      setDeviceInfo(di);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = navigation.addListener('focus', load);
    return unsubscribe;
  }, [load, navigation]);

  // Whenever settings change (level / word count), refresh preview words and background
  useEffect(() => {
    if (!settings) return;
    let cancelled = false;
    (async () => {
      try {
        const words = await autoWallpaperService.pickWordsForSnapshot(
          settings.snapshot,
          currentLanguagePairRef.current
        );
        if (cancelled) return;
        setPreviewWords(words);

        const bg = await autoWallpaperService.resolveBackgroundImage(settings.snapshot);
        if (cancelled) return;
        setPreviewBackground(bg);
      } catch (e) {
        console.warn('[AutoWallpaperSettings] preview refresh failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings?.snapshot.level, settings?.snapshot.wordCount]);

  const currentLanguagePairRef = useRef(currentLanguagePair);
  useEffect(() => {
    currentLanguagePairRef.current = currentLanguagePair;
  }, [currentLanguagePair]);

  const isAndroid = Platform.OS === 'android';

  const updateSnapshot = useCallback(
    (partial: Partial<OverlaySnapshot>) => {
      if (!settings) return;
      const updated: OverlaySnapshot = { ...settings.snapshot, ...partial };
      setSettings({ ...settings, snapshot: updated });
      autoWallpaperService
        .updateSnapshot(partial)
        .catch((e) => console.warn('[AutoWallpaperSettings] updateSnapshot failed:', e));
    },
    [settings]
  );

  const captureAndCache = useCallback(async (): Promise<string | null> => {
    const ref = viewShotRef.current;
    if (!ref || typeof ref.capture !== 'function') return null;
    // @ts-ignore
    const uri: string = await ref.capture({ format: 'png', quality: 1 });
    await autoWallpaperService.registerPreparedWallpaper(uri);
    return uri;
  }, []);

  const handleToggleEnabled = useCallback(
    async (value: boolean) => {
      if (!settings) return;
      if (!isAndroid) {
        showAlert({ title: translations.alerts.error, message: translations.wallpaper.errors.unsupported, variant: 'error' });
        return;
      }
      setBusy('save');
      try {
        if (value) {
          // Give the ViewShot a moment to settle with current words
          await new Promise((r) => setTimeout(r, 300));
          await captureAndCache();
          await autoWallpaperService.enable(settings.hour, settings.minute);
          showAlert({
            title: translations.alerts.success,
            message: translations.wallpaper.auto.successDescription.replace(
              '{0}',
              `${settings.hour.toString().padStart(2, '0')}:${settings.minute
                .toString()
                .padStart(2, '0')}`
            ),
            variant: 'success',
          });
        } else {
          await autoWallpaperService.disable();
          showAlert({ title: translations.alerts.success, message: translations.wallpaper.auto.stopped, variant: 'success' });
        }
        await load();
      } catch (e: any) {
        console.error('[AutoWallpaperSettings] toggle failed:', e);
        const code = e?.code || 'UNKNOWN';
        const needsMiui =
          typeof e?.message === 'string' && e.message.includes('needsMiuiPermission=true');
        let message = translations.wallpaper.errors.setFailed;
        if (code === 'PERMISSION_DENIED') message = translations.wallpaper.errors.permissionDenied;
        const buttons: any[] = [{ text: translations.alerts.okay }];
        if (needsMiui || code === 'PERMISSION_DENIED') {
          buttons.unshift({
            text: translations.wallpaper.openSettings,
            onPress: () => Wallpaper.openMiuiOtherPermissions(),
          });
        }
        showAlert({ title: translations.alerts.error, message, variant: 'error', buttons });
      } finally {
        setBusy(null);
      }
    },
    [settings, isAndroid, translations, load, captureAndCache]
  );

  const handleTestNow = useCallback(async () => {
    if (!isAndroid) {
      showAlert({ title: translations.alerts.error, message: translations.wallpaper.errors.unsupported, variant: 'error' });
      return;
    }
    setBusy('test');
    try {
      await new Promise((r) => setTimeout(r, 300));
      const uri = await captureAndCache();
      if (!uri) throw new Error('Capture failed');
      await Wallpaper.applyCachedWallpaperNow();
      showAlert({ title: translations.wallpaper.success, message: translations.wallpaper.successDescription, variant: 'success' });
    } catch (e: any) {
      const code = e?.code || 'UNKNOWN';
      const needsMiui =
        typeof e?.message === 'string' && e.message.includes('needsMiuiPermission=true');
      let message = translations.wallpaper.errors.setFailed;
      if (code === 'PERMISSION_DENIED') message = translations.wallpaper.errors.permissionDenied;
      const buttons: any[] = [{ text: translations.alerts.okay }];
      if (needsMiui || code === 'PERMISSION_DENIED') {
        buttons.unshift({
          text: translations.wallpaper.openSettings,
          onPress: () => Wallpaper.openMiuiOtherPermissions(),
        });
      }
      showAlert({ title: translations.alerts.error, message, variant: 'error', buttons });
    } finally {
      setBusy(null);
    }
  }, [isAndroid, translations, captureAndCache]);

  const openTimePicker = useCallback(() => {
    if (!settings) return;
    setPendingHour(settings.hour);
    setPendingMinute(settings.minute);
    setTimePickerVisible(true);
  }, [settings]);

  const handleConfirmNewTime = useCallback(async () => {
    setTimePickerVisible(false);
    try {
      await autoWallpaperService.updateTime(pendingHour, pendingMinute);
      await load();
    } catch (e) {
      console.error('[AutoWallpaperSettings] updateTime failed:', e);
    }
  }, [pendingHour, pendingMinute, load]);

  const openMiuiOnboardingModal = () => {
    setMiuiStep(1);
    setMiuiOnboardingVisible(true);
  };

  const completeMiuiOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(MIUI_ONBOARDING_FLAG, 'true');
    setMiuiOnboardingVisible(false);
  }, []);

  const styles = useMemo(() => createStyles(colors), [colors]);

  if (loading || !settings) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const snapshot = settings.snapshot;
  // Position Y must match what WordOverlayScreen uses on first open,
  // and it depends on wordCount — recompute on the fly.
  const previewPositionY = getInitialVerticalPosition(snapshot.wordCount);

  // Preview scale so the full-screen ViewShot fits the settings card
  const previewPadding = 32;
  const previewWidth = Dimensions.get('window').width - previewPadding;
  const previewScale = previewWidth / SCREEN.width;
  const previewHeight = SCREEN.height * previewScale;

  // Always pure white — matches WordOverlayScreen default, independent
  // of the current theme so preview and capture stay readable on photo
  // backgrounds regardless of dark/light/pastel theme.
  const effectiveTextColor = '#FFFFFF';

  const renderPill = <T extends string | number>(
    value: T,
    current: T,
    label: string,
    onPress: () => void
  ) => (
    <TouchableOpacity
      key={String(value)}
      style={[styles.pill, current === value && { backgroundColor: colors.primary }]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.pillText,
          { color: current === value ? colors.text.onPrimary : colors.primary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{translations.wallpaper.auto.title}</Text>
          <Text style={styles.subtitle}>{translations.wallpaper.auto.subtitle}</Text>
        </View>

        {!isAndroid && (
          <View style={[styles.card, styles.warningCard]}>
            <MaterialIcons name="info" size={22} color={colors.warning} />
            <Text style={styles.warningText}>{translations.wallpaper.errors.unsupported}</Text>
          </View>
        )}

        {/* Preview card — scaled view of the real full-screen ViewShot */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{translations.wallpaper.auto.preview}</Text>
          <View
            style={[
              styles.previewFrame,
              { width: previewWidth, height: previewHeight, overflow: 'hidden' },
            ]}
          >
            {/*
              The ViewShot renders at real screen size. A scale transform
              anchored to top-left shrinks it visually so it fits the
              settings card. On capture, the real-size bitmap is what
              gets written to the cache — so preview and output match
              pixel-for-pixel.
            */}
            <View
              style={{
                width: SCREEN.width,
                height: SCREEN.height,
                transform: [{ scale: previewScale }],
                // @ts-ignore — RN 0.74+ supports transformOrigin
                transformOrigin: 'top left',
              }}
            >
              <ViewShot
                ref={viewShotRef}
                style={{ width: SCREEN.width, height: SCREEN.height }}
                options={{ format: 'png', quality: 1, result: 'tmpfile' }}
              >
                {(() => {
                  const wordsList = (
                    <View
                      style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        padding: 20,
                      }}
                    >
                      <View
                        style={{
                          // Absolute top-down positioning — no flex centering.
                          // Matches WordOverlayScreen.wordContainer exactly.
                          transform: [{ translateX: 0 }, { translateY: previewPositionY }],
                        }}
                      >
                        {previewWords.map((w, idx) => (
                          <View key={idx} style={{ paddingVertical: 8, marginBottom: 16 }}>
                            <Text
                              style={{
                                color: effectiveTextColor,
                                fontSize: 24,
                                fontWeight: 'bold',
                                textAlign: 'center',
                                textShadowColor: 'rgba(0, 0, 0, 0.75)',
                                textShadowOffset: { width: 1, height: 1 },
                                textShadowRadius: 3,
                              }}
                            >
                              {w.word} : {w.meaning}
                            </Text>
                            {w.example ? (
                              <Text
                                style={{
                                  color: effectiveTextColor,
                                  fontSize: 14,
                                  fontStyle: 'italic',
                                  textAlign: 'center',
                                  textShadowColor: 'rgba(0, 0, 0, 0.75)',
                                  textShadowOffset: { width: 1, height: 1 },
                                  textShadowRadius: 3,
                                }}
                              >
                                {w.example}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    </View>
                  );

                  if (previewBackground) {
                    return (
                      <ImageBackground
                        source={{ uri: previewBackground }}
                        style={{ width: SCREEN.width, height: SCREEN.height }}
                        resizeMode="cover"
                      >
                        {wordsList}
                      </ImageBackground>
                    );
                  }
                  // No background yet — show a plain dark fallback so the
                  // words are always visible. No spinner: the preview never
                  // shows a loading state because it would look stuck.
                  return (
                    <View
                      style={{
                        width: SCREEN.width,
                        height: SCREEN.height,
                        backgroundColor: '#1a1a2e',
                      }}
                    >
                      {wordsList}
                    </View>
                  );
                })()}
              </ViewShot>
            </View>
          </View>
        </View>

        {/* Enable toggle */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{translations.wallpaper.auto.enable}</Text>
              <Text style={styles.cardSubtitle}>
                {settings.enabled
                  ? translations.wallpaper.auto.statusActive
                  : translations.wallpaper.auto.statusInactive}
              </Text>
            </View>
            {busy === 'save' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={settings.enabled}
                onValueChange={handleToggleEnabled}
                disabled={!isAndroid}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            )}
          </View>
        </View>

        {/* Time */}
        <TouchableOpacity style={styles.card} onPress={openTimePicker} activeOpacity={0.7}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{translations.wallpaper.auto.time}</Text>
              <Text style={styles.cardValue}>
                {settings.hour.toString().padStart(2, '0')}:
                {settings.minute.toString().padStart(2, '0')}
              </Text>
            </View>
            <MaterialIcons name="access-time" size={24} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Word count */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{translations.wallpaper.auto.wordCount}</Text>
          <View style={styles.pillRow}>
            {WORD_COUNT_OPTIONS.map((n) =>
              renderPill(n, snapshot.wordCount, String(n), () =>
                updateSnapshot({ wordCount: n })
              )
            )}
          </View>
        </View>

        {/* Level */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{translations.wallpaper.auto.level}</Text>
          <View style={styles.pillRow}>
            {LEVEL_OPTIONS.map((l) =>
              renderPill(l, snapshot.level, l, () => updateSnapshot({ level: l }))
            )}
          </View>
        </View>

        {/* Test now */}
        {isAndroid && (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleTestNow}
              disabled={!!busy}
            >
              {busy === 'test' ? (
                <ActivityIndicator color={colors.text.onPrimary} />
              ) : (
                <>
                  <MaterialIcons name="play-arrow" size={22} color={colors.text.onPrimary} />
                  <Text style={[styles.primaryButtonText, { color: colors.text.onPrimary }]}>
                    {translations.wallpaper.auto.testNow}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <Text style={styles.hint}>{translations.wallpaper.auto.testDescription}</Text>
          </>
        )}

        {/* MIUI warning */}
        {deviceInfo.isMiui && (
          <View style={[styles.card, styles.warningCard]}>
            <MaterialIcons name="warning" size={22} color={colors.warning} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.warningTitle}>{translations.wallpaper.miui.warningTitle}</Text>
              <Text style={styles.warningText}>
                {translations.wallpaper.miui.warningDescription}
              </Text>
              <TouchableOpacity style={styles.textButton} onPress={openMiuiOnboardingModal}>
                <Text style={[styles.textButtonLabel, { color: colors.primary }]}>
                  {translations.wallpaper.miui.reopen}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Time picker modal */}
      <Modal
        transparent
        visible={timePickerVisible}
        animationType="fade"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.modalTitle}>{translations.wallpaper.auto.pickTimeTitle}</Text>
            <Text style={styles.modalBody}>{translations.wallpaper.auto.pickTimeSubtitle}</Text>
            <View style={styles.timePickerRow}>
              <ScrollView style={styles.timeColumn} showsVerticalScrollIndicator={false}>
                {Array.from({ length: 24 }, (_, i) => i).map((h) => {
                  const sel = h === pendingHour;
                  return (
                    <TouchableOpacity
                      key={`h-${h}`}
                      style={[styles.timeItem, sel && { backgroundColor: colors.primary }]}
                      onPress={() => setPendingHour(h)}
                    >
                      <Text
                        style={[
                          styles.timeItemText,
                          { color: sel ? colors.text.onPrimary : colors.text.primary },
                        ]}
                      >
                        {h.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={[styles.timeColon, { color: colors.text.primary }]}>:</Text>
              <ScrollView style={styles.timeColumn} showsVerticalScrollIndicator={false}>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
                  const sel = m === pendingMinute;
                  return (
                    <TouchableOpacity
                      key={`m-${m}`}
                      style={[styles.timeItem, sel && { backgroundColor: colors.primary }]}
                      onPress={() => setPendingMinute(m)}
                    >
                      <Text
                        style={[
                          styles.timeItemText,
                          { color: sel ? colors.text.onPrimary : colors.text.primary },
                        ]}
                      >
                        {m.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setTimePickerVisible(false)}
              >
                <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>
                  {translations.wallpaper.auto.cancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
                onPress={handleConfirmNewTime}
              >
                <Text style={{ color: colors.text.onPrimary, fontWeight: '700' }}>
                  {translations.wallpaper.auto.confirm}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MIUI onboarding modal */}
      <Modal
        transparent
        visible={miuiOnboardingVisible}
        animationType="slide"
        onRequestClose={() => setMiuiOnboardingVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalStep, { color: colors.primary }]}>
              {translations.wallpaper.miui.step.replace('{0}', String(miuiStep))}
            </Text>
            <Text style={styles.modalTitle}>
              {miuiStep === 1
                ? translations.wallpaper.miui.step1Title
                : miuiStep === 2
                ? translations.wallpaper.miui.step2Title
                : translations.wallpaper.miui.step3Title}
            </Text>
            <Text style={styles.modalBody}>
              {miuiStep === 1
                ? translations.wallpaper.miui.step1Description
                : miuiStep === 2
                ? translations.wallpaper.miui.step2Description
                : translations.wallpaper.miui.step3Description}
            </Text>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.primary, marginTop: 14 }]}
              onPress={() => {
                if (miuiStep === 1) Wallpaper.openAutostartSettings();
                else if (miuiStep === 2) Wallpaper.openBatteryOptimizationSettings();
                else Wallpaper.openMiuiOtherPermissions();
              }}
            >
              <MaterialIcons name="settings" size={20} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                {miuiStep === 1
                  ? translations.wallpaper.miui.step1Action
                  : miuiStep === 2
                  ? translations.wallpaper.miui.step2Action
                  : translations.wallpaper.miui.step3Action}
              </Text>
            </TouchableOpacity>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.textButton} onPress={completeMiuiOnboarding}>
                <Text style={[styles.textButtonLabel, { color: colors.text.secondary }]}>
                  {translations.wallpaper.miui.skip}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: colors.primary, flex: 1, marginLeft: 10 },
                ]}
                onPress={async () => {
                  if (miuiStep < 3) {
                    setMiuiStep((miuiStep + 1) as 1 | 2 | 3);
                  } else {
                    await completeMiuiOnboarding();
                  }
                }}
              >
                <Text style={{ color: colors.text.onPrimary, fontWeight: '700' }}>
                  {miuiStep < 3
                    ? translations.wallpaper.miui.iDidThis
                    : translations.wallpaper.miui.finish}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ---- Styles ----

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 60,
    },
    header: {
      marginBottom: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text.primary,
    },
    subtitle: {
      fontSize: 14,
      color: colors.text.secondary,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.card.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.card.border,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 6,
    },
    cardSubtitle: {
      fontSize: 13,
      color: colors.text.secondary,
    },
    cardValue: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.primary,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4,
    },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.primary,
      marginRight: 8,
      marginBottom: 8,
    },
    pillText: {
      fontSize: 14,
      fontWeight: '600',
    },
    previewFrame: {
      alignSelf: 'center',
      marginTop: 8,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: '#000',
    },
    warningCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderColor: colors.warning,
      backgroundColor: colors.surfaceVariant,
    },
    warningTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 4,
    },
    warningText: {
      fontSize: 13,
      color: colors.text.secondary,
      marginLeft: 10,
      flex: 1,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 10,
      marginTop: 12,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      marginLeft: 8,
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 2,
      marginTop: 8,
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: '700',
      marginLeft: 8,
    },
    hint: {
      fontSize: 12,
      color: colors.text.secondary,
      marginTop: 6,
      textAlign: 'center',
    },
    textButton: {
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    textButtonLabel: {
      fontSize: 14,
      fontWeight: '600',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 16,
      padding: 20,
    },
    modalStep: {
      fontSize: 12,
      fontWeight: '700',
      marginBottom: 6,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text.primary,
      marginBottom: 10,
    },
    modalBody: {
      fontSize: 14,
      color: colors.text.secondary,
      lineHeight: 20,
    },
    modalButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 18,
    },
    timePickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    timeColumn: {
      maxHeight: 200,
      width: 70,
    },
    timeItem: {
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 6,
      marginVertical: 2,
    },
    timeItemText: {
      fontSize: 20,
      fontWeight: '600',
    },
    timeColon: {
      fontSize: 30,
      fontWeight: '700',
      marginHorizontal: 10,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    confirmBtn: {
      flex: 2,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
