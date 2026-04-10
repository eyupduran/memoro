import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  ImageSourcePropType,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ViewShot from 'react-native-view-shot';

import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../types/navigation';

import {
  autoWallpaperService,
  AutoWallpaperSettings,
  DEFAULT_AUTO_WALLPAPER_SETTINGS,
} from '../services/autoWallpaper';
import { dbService } from '../services/database';
import * as Wallpaper from 'expo-wallpaper';

import {
  WallpaperComposer,
  WallpaperComposerLayout,
  AUTO_WALLPAPER_LAYOUTS,
} from '../components/WallpaperComposer';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoWallpaperSettings'>;

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const WORD_COUNTS = [3, 4, 5, 6, 7, 8];
const MIUI_ONBOARDING_FLAG = 'auto_wallpaper_miui_onboarding_done';

export const AutoWallpaperSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();

  const [settings, setSettings] = useState<AutoWallpaperSettings>(DEFAULT_AUTO_WALLPAPER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<'save' | 'test' | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<Wallpaper.DeviceInfo>({
    isMiui: false,
    manufacturer: 'unknown',
    androidApiLevel: 0,
  });
  const [nativeState, setNativeState] = useState<Wallpaper.AutoWallpaperState | null>(null);

  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [miuiOnboardingVisible, setMiuiOnboardingVisible] = useState(false);
  const [miuiStep, setMiuiStep] = useState<1 | 2 | 3>(1);

  // Offscreen composer state — holds the words + bg to render before capture
  const [composerPayload, setComposerPayload] = useState<{
    words: any[];
    layout: WallpaperComposerLayout;
    background: ImageSourcePropType;
  } | null>(null);
  const composerRef = useRef<ViewShot>(null);
  const capturePromiseRef = useRef<{ resolve: (uri: string) => void; reject: (e: any) => void } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, ns, di] = await Promise.all([
        autoWallpaperService.getSettings(),
        Promise.resolve(Wallpaper.getAutoWallpaperState()),
        Promise.resolve(Wallpaper.getDeviceInfo()),
      ]);
      setSettings(s);
      setNativeState(ns);
      setDeviceInfo(di);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Pick a background image for the composer — uses the first DB-stored
  // background as a sensible default. Users don't pick it explicitly from
  // this screen; if they want fine control, they can use the full manual
  // flow from WordOverlayScreen.
  const resolveBackgroundImage = useCallback(async (): Promise<ImageSourcePropType> => {
    try {
      const images = await dbService.getBackgroundImages();
      if (images.length > 0) {
        const raw: any = images[Math.floor(Math.random() * images.length)];
        const url = raw?.url ?? raw?.uri ?? raw;
        if (typeof url === 'string') {
          return { uri: url };
        }
      }
    } catch {
      // fall through
    }
    // Hard fallback — a plain dark color via a data URI
    return { uri: 'https://via.placeholder.com/1080x1920/111111/ffffff?text=' };
  }, []);

  /**
   * Render the composer offscreen, capture the PNG, and hand it to the
   * native cache. Returns the captured file URI.
   */
  const captureWallpaper = useCallback(async (): Promise<string | null> => {
    const selection = await autoWallpaperService.prepareWordSelection(currentLanguagePair);
    if (!selection || selection.words.length === 0) {
      Alert.alert(
        translations.alerts.error,
        translations.wallpaper.auto.pickLevelFirst,
        [{ text: translations.alerts.okay }]
      );
      return null;
    }

    const background = await resolveBackgroundImage();

    // Mount the composer offscreen
    setComposerPayload({
      words: selection.words,
      layout: (selection.settings.layout as WallpaperComposerLayout) ?? 'standard',
      background,
    });

    // Wait for the capture to complete (triggered by the composer's useEffect below)
    const uri = await new Promise<string>((resolve, reject) => {
      capturePromiseRef.current = { resolve, reject };
    });

    // Unmount the composer
    setComposerPayload(null);

    // Register the captured PNG with the native cache
    await autoWallpaperService.registerPreparedWallpaper(uri);
    return uri;
  }, [currentLanguagePair, resolveBackgroundImage, translations]);

  // When the composer payload is set and mounted, run the capture.
  // A short tick ensures layout has settled before snapshot.
  useEffect(() => {
    if (!composerPayload) return;
    let cancelled = false;
    const doCapture = async () => {
      try {
        // Give the render tree a frame to settle
        await new Promise((r) => setTimeout(r, 80));
        if (cancelled) return;
        const ref = composerRef.current;
        if (!ref || typeof ref.capture !== 'function') {
          capturePromiseRef.current?.reject(new Error('Composer ref unavailable'));
          capturePromiseRef.current = null;
          return;
        }
        const uri = await ref.capture!();
        capturePromiseRef.current?.resolve(uri);
        capturePromiseRef.current = null;
      } catch (e) {
        if (!cancelled) {
          capturePromiseRef.current?.reject(e);
          capturePromiseRef.current = null;
        }
      }
    };
    doCapture();
    return () => {
      cancelled = true;
    };
  }, [composerPayload]);

  const checkMiuiOnboarding = useCallback(async () => {
    if (!deviceInfo.isMiui) return true;
    // Show the onboarding modal on first enable
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const done = await AsyncStorage.getItem(MIUI_ONBOARDING_FLAG);
    if (done !== 'true') {
      setMiuiStep(1);
      setMiuiOnboardingVisible(true);
      return false;
    }
    return true;
  }, [deviceInfo.isMiui]);

  const completeMiuiOnboarding = useCallback(async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(MIUI_ONBOARDING_FLAG, 'true');
    setMiuiOnboardingVisible(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(translations.alerts.error, translations.wallpaper.errors.unsupported);
      return;
    }

    // If enabling for the first time on MIUI, run the onboarding flow
    if (settings.enabled && deviceInfo.isMiui) {
      const ok = await checkMiuiOnboarding();
      if (!ok) return; // onboarding modal is now visible; save will be retried after "finish"
    }

    setSaving(true);
    setBusyAction('save');
    try {
      if (settings.enabled) {
        // Generate initial cache so the first alarm has something to apply
        await captureWallpaper();
        await autoWallpaperService.enable(settings);
      } else {
        await autoWallpaperService.disable();
      }
      const ns = Wallpaper.getAutoWallpaperState();
      setNativeState(ns);

      // Android 12+: warn if exact alarms are not permitted
      if (settings.enabled && !ns.canScheduleExactAlarms) {
        Alert.alert(
          translations.alerts.error,
          translations.wallpaper.errors.setFailed,
          [
            {
              text: translations.wallpaper.openSettings,
              onPress: () => Wallpaper.openExactAlarmSettings(),
            },
            { text: translations.alerts.okay },
          ]
        );
      } else {
        Alert.alert(translations.alerts.success, translations.wallpaper.auto.saved);
      }
    } catch (e) {
      console.error('[AutoWallpaperSettings] save failed:', e);
      Alert.alert(translations.alerts.error, translations.alerts.processingError);
    } finally {
      setSaving(false);
      setBusyAction(null);
    }
  }, [settings, deviceInfo, checkMiuiOnboarding, captureWallpaper, translations]);

  const handleTestNow = useCallback(async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(translations.alerts.error, translations.wallpaper.errors.unsupported);
      return;
    }
    setSaving(true);
    setBusyAction('test');
    try {
      const uri = await captureWallpaper();
      if (!uri) return;
      await Wallpaper.applyCachedWallpaperNow();
      Alert.alert(translations.wallpaper.success, translations.wallpaper.successDescription);
      const ns = Wallpaper.getAutoWallpaperState();
      setNativeState(ns);
    } catch (e: any) {
      const code = e?.code || 'UNKNOWN';
      const needsMiui =
        typeof e?.message === 'string' && e.message.includes('needsMiuiPermission=true');
      let message = translations.wallpaper.errors.setFailed;
      if (code === 'PERMISSION_DENIED') message = translations.wallpaper.errors.permissionDenied;
      else if (code === 'BITMAP_DECODE_FAILED') message = translations.wallpaper.errors.decodeFailed;

      const buttons: any[] = [{ text: translations.alerts.okay }];
      if (needsMiui || code === 'PERMISSION_DENIED') {
        buttons.unshift({
          text: translations.wallpaper.openSettings,
          onPress: () => Wallpaper.openMiuiOtherPermissions(),
        });
      }
      Alert.alert(translations.alerts.error, message, buttons);
    } finally {
      setSaving(false);
      setBusyAction(null);
    }
  }, [captureWallpaper, translations]);

  const formatTime = (h: number, m: number) =>
    `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

  const formatLastRun = (millis: number): string => {
    if (!millis) return translations.wallpaper.auto.never;
    try {
      const d = new Date(millis);
      return d.toLocaleString();
    } catch {
      return translations.wallpaper.auto.never;
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isAndroid = Platform.OS === 'android';

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

        {/* Enable toggle */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{translations.wallpaper.auto.enable}</Text>
              <Text style={styles.cardSubtitle}>
                {settings.enabled
                  ? translations.wallpaper.auto.enabled
                  : translations.wallpaper.auto.disabled}
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(v) => setSettings({ ...settings, enabled: v })}
              disabled={!isAndroid || saving}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Time */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => setTimePickerVisible(true)}
          disabled={!settings.enabled || saving}
          activeOpacity={0.7}
        >
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{translations.wallpaper.auto.time}</Text>
              <Text style={styles.cardValue}>{formatTime(settings.hour, settings.minute)}</Text>
            </View>
            <MaterialIcons name="access-time" size={24} color={colors.primary} />
          </View>
        </TouchableOpacity>

        {/* Word count */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{translations.wallpaper.auto.wordCount}</Text>
          <View style={styles.pillRow}>
            {WORD_COUNTS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[
                  styles.pill,
                  settings.wordCount === n && { backgroundColor: colors.primary },
                ]}
                onPress={() => setSettings({ ...settings, wordCount: n })}
                disabled={!settings.enabled || saving}
              >
                <Text
                  style={[
                    styles.pillText,
                    settings.wordCount === n && { color: colors.text.onPrimary },
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Level */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{translations.wallpaper.auto.level}</Text>
          <View style={styles.pillRow}>
            {LEVELS.map((l) => (
              <TouchableOpacity
                key={l}
                style={[
                  styles.pill,
                  settings.level === l && { backgroundColor: colors.primary },
                ]}
                onPress={() => setSettings({ ...settings, level: l })}
                disabled={!settings.enabled || saving}
              >
                <Text
                  style={[
                    styles.pillText,
                    settings.level === l && { color: colors.text.onPrimary },
                  ]}
                >
                  {l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Layout */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{translations.wallpaper.auto.layout}</Text>
          <View style={styles.pillRow}>
            {AUTO_WALLPAPER_LAYOUTS.map((l) => (
              <TouchableOpacity
                key={l}
                style={[
                  styles.pill,
                  settings.layout === l && { backgroundColor: colors.primary },
                ]}
                onPress={() => setSettings({ ...settings, layout: l })}
                disabled={!settings.enabled || saving}
              >
                <Text
                  style={[
                    styles.pillText,
                    settings.layout === l && { color: colors.text.onPrimary },
                  ]}
                >
                  {l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Last run */}
        {nativeState && nativeState.lastRunMillis > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardSubtitle}>
              {translations.wallpaper.auto.lastRun.replace('{0}', formatLastRun(nativeState.lastRunMillis))}
            </Text>
          </View>
        )}

        {/* MIUI warning */}
        {deviceInfo.isMiui && (
          <View style={[styles.card, styles.warningCard]}>
            <MaterialIcons name="warning" size={22} color={colors.warning} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.warningTitle}>
                {translations.wallpaper.miui.warningTitle}
              </Text>
              <Text style={styles.warningText}>
                {translations.wallpaper.miui.warningDescription}
              </Text>
              <TouchableOpacity
                style={styles.textButton}
                onPress={() => {
                  setMiuiStep(1);
                  setMiuiOnboardingVisible(true);
                }}
              >
                <Text style={[styles.textButtonLabel, { color: colors.primary }]}>
                  {translations.wallpaper.miui.reopen}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Test now */}
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: colors.primary }]}
          onPress={handleTestNow}
          disabled={!isAndroid || saving}
        >
          {busyAction === 'test' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <MaterialIcons name="play-arrow" size={22} color={colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>
                {translations.wallpaper.auto.testNow}
              </Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.hint}>{translations.wallpaper.auto.testDescription}</Text>

        {/* Save */}
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={!isAndroid || saving}
        >
          {busyAction === 'save' ? (
            <ActivityIndicator color={colors.text.onPrimary} />
          ) : (
            <Text style={[styles.primaryButtonText, { color: colors.text.onPrimary }]}>
              {translations.wallpaper.auto.save}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Offscreen composer (absolute, far off-screen) */}
      {composerPayload && (
        <View pointerEvents="none" style={styles.offscreen}>
          <WallpaperComposer
            ref={composerRef}
            words={composerPayload.words}
            layout={composerPayload.layout}
            backgroundImage={composerPayload.background}
          />
        </View>
      )}

      {/* Time picker modal */}
      <Modal
        transparent
        visible={timePickerVisible}
        animationType="fade"
        onRequestClose={() => setTimePickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.modalTitle}>{translations.wallpaper.auto.time}</Text>
            <View style={styles.timePickerRow}>
              <TimeColumn
                values={Array.from({ length: 24 }, (_, i) => i)}
                selected={settings.hour}
                onChange={(v) => setSettings({ ...settings, hour: v })}
                pad
                colors={colors}
              />
              <Text style={[styles.timeColon, { color: colors.text.primary }]}>:</Text>
              <TimeColumn
                values={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]}
                selected={settings.minute}
                onChange={(v) => setSettings({ ...settings, minute: v })}
                pad
                colors={colors}
              />
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
              onPress={() => setTimePickerVisible(false)}
            >
              <Text style={[styles.primaryButtonText, { color: colors.text.onPrimary }]}>
                {translations.alerts.okay}
              </Text>
            </TouchableOpacity>
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
            <Text style={styles.modalStep}>
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
              <TouchableOpacity
                style={[styles.textButton]}
                onPress={async () => {
                  await completeMiuiOnboarding();
                }}
              >
                <Text style={[styles.textButtonLabel, { color: colors.text.secondary }]}>
                  {translations.wallpaper.miui.skip}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary, flex: 1, marginLeft: 10 }]}
                onPress={async () => {
                  if (miuiStep < 3) {
                    setMiuiStep((miuiStep + 1) as 1 | 2 | 3);
                  } else {
                    await completeMiuiOnboarding();
                  }
                }}
              >
                <Text style={[styles.primaryButtonText, { color: colors.text.onPrimary }]}>
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

// ---- Time column (scrollable picker) ----

const TimeColumn: React.FC<{
  values: number[];
  selected: number;
  onChange: (v: number) => void;
  pad?: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}> = ({ values, selected, onChange, pad, colors }) => (
  <ScrollView style={timeColumnStyles.scroll} showsVerticalScrollIndicator={false}>
    {values.map((v) => {
      const isSelected = v === selected;
      return (
        <TouchableOpacity
          key={v}
          style={[
            timeColumnStyles.item,
            isSelected && { backgroundColor: colors.primary },
          ]}
          onPress={() => onChange(v)}
        >
          <Text
            style={[
              timeColumnStyles.itemText,
              { color: isSelected ? colors.text.onPrimary : colors.text.primary },
            ]}
          >
            {pad ? v.toString().padStart(2, '0') : v}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const timeColumnStyles = StyleSheet.create({
  scroll: {
    maxHeight: 200,
    width: 70,
  },
  item: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
    marginVertical: 2,
  },
  itemText: {
    fontSize: 20,
    fontWeight: '600',
  },
});

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
      paddingBottom: 40,
    },
    header: {
      marginBottom: 16,
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
    cardTitle: {
      fontSize: 16,
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
      color: colors.primary,
    },
    primaryButton: {
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 2,
      marginTop: 12,
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
    offscreen: {
      position: 'absolute',
      left: -10000,
      top: 0,
      opacity: 0,
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
      color: colors.primary,
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
    timeColon: {
      fontSize: 30,
      fontWeight: '700',
      marginHorizontal: 10,
    },
  });
