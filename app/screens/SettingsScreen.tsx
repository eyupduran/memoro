import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';
import type { ThemeType } from '../theme/themes';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import * as Notifications from 'expo-notifications';
import { LanguageSelectorSettings } from '../components/LanguageSelectorSettings';
import { DataLoader } from '../components/DataLoader';
import { useDetailedDownload } from '../contexts/DetailedDownloadContext';
import { checkWordDataExists } from '../utils/database';
import { useAuth } from '../contexts/AuthContext';
import { cloudSync } from '../services/cloudSync';
import WordListDownloadModal from '../components/WordListDownloadModal';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = (props) => {
  const { theme, setTheme, colors } = useTheme();
  const { translations, currentLanguagePair, showDataLoader: globalShowDataLoader, setShowDataLoader: setGlobalShowDataLoader } = useLanguage();
  const { showAlert } = useAlert();
  const { user, signOut } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [hasDownloadedData, setHasDownloadedData] = useState(false);
  const [showDataLoader, setShowDataLoader] = useState(false);
  const { startDownload: startDetailedDownload } = useDetailedDownload();
  const isInitialMount = useRef(true);
  const [showWordListModal, setShowWordListModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const t = translations.settings.cloudAccount;
  const isSignedIn = !!user;

  useEffect(() => {
    const unsubscribe = props.navigation.addListener('focus', () => {
      checkDownloadedData();
      checkNotificationSettings();
      if (globalShowDataLoader) {
        setGlobalShowDataLoader(false);
      }
    });
    return unsubscribe;
  }, [props.navigation, globalShowDataLoader]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setShowDataLoader(true);
  }, [currentLanguagePair]);

  const checkNotificationSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('notificationsEnabled');
      setNotificationsEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error checking notification settings:', error);
    }
  };

  const checkDownloadedData = async () => {
    try {
      const hasData = await checkWordDataExists(currentLanguagePair);
      setHasDownloadedData(hasData);
    } catch (error) {
      console.error('Error checking downloaded data:', error);
      setHasDownloadedData(false);
    }
  };

  async function setupNotificationChannelAndroid() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  async function scheduleDailyNotification() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await setupNotificationChannelAndroid();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "☀️ Günaydın!",
          body: 'Bugün yeni kelimeler öğrenme zamanı! Hadi başlayalım 💪',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 10,
          minute: 0,
        },
      });
      return true;
    } catch (error) {
      console.error("Error scheduling notification:", error);
      showAlert({ title: translations.alerts.error, message: translations.alerts.notificationSchedulingError, variant: 'error' });
      return false;
    }
  }

  async function cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error("Error cancelling notifications:", error);
      showAlert({ title: translations.alerts.error, message: translations.alerts.notificationCancellationError, variant: 'error' });
    }
  }

  const handleNotificationToggle = async () => {
    const previousState = notificationsEnabled;
    const newState = !previousState;
    setNotificationsEnabled(newState);

    try {
      if (newState) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          const scheduled = await scheduleDailyNotification();
          if (scheduled) {
            await AsyncStorage.setItem('notificationsEnabled', 'true');
          } else {
            setNotificationsEnabled(false);
            await AsyncStorage.setItem('notificationsEnabled', 'false');
          }
        } else {
          showAlert({ title: translations.alerts.permissionRequired, message: translations.notifications.dailyWordReminderBody, variant: 'warning' });
          setNotificationsEnabled(false);
          await AsyncStorage.setItem('notificationsEnabled', 'false');
        }
      } else {
        await cancelAllNotifications();
        await AsyncStorage.setItem('notificationsEnabled', 'false');
      }
    } catch (error) {
      console.error("Error handling notification toggle:", error);
      showAlert({ title: translations.alerts.error, message: translations.alerts.processingError, variant: 'error' });
      setNotificationsEnabled(previousState);
    }
  };

  const handleThemeChange = async (newTheme: ThemeType) => {
    try {
      await AsyncStorage.setItem('theme', newTheme);
      setTheme(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const handleSignOut = () => {
    showAlert({
      title: t.signOutConfirmTitle,
      message: t.signOutConfirmMessage,
      variant: 'confirm',
      buttons: [
        { text: t.signOutCancel, style: 'cancel' },
        {
          text: t.signOutConfirm,
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await cloudSync.onSignOutCleanup(currentLanguagePair);
              await signOut();
            } finally {
              setSigningOut(false);
            }
          },
        },
      ],
    });
  };

  const onDataLoadComplete = async () => {
    setShowDataLoader(false);
    await checkDownloadedData();
  };

  const themes: { type: ThemeType; label: string; icon: keyof typeof MaterialIcons.glyphMap; description: string }[] = [
    {
      type: 'light',
      label: translations.settings.themes.light.label,
      icon: 'wb-sunny',
      description: translations.settings.themes.light.description,
    },
    {
      type: 'dark',
      label: translations.settings.themes.dark.label,
      icon: 'nights-stay',
      description: translations.settings.themes.dark.description,
    },
  ];

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hesabım ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {t.title}
          </Text>

          <View style={[styles.card, { backgroundColor: colors.card.background }]}>
            {isSignedIn ? (
              <>
                <View style={styles.accountRow}>
                  <View style={[styles.avatarCircle, { backgroundColor: colors.primary + '18' }]}>
                    <MaterialIcons name="person" size={24} color={colors.primary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountEmail, { color: colors.text.primary }]} numberOfLines={1}>
                      {user?.email}
                    </Text>
                    <View style={styles.syncBadge}>
                      <MaterialIcons name="cloud-done" size={13} color="#4CAF50" />
                      <Text style={[styles.syncBadgeText, { color: '#4CAF50' }]}>
                        {t.descriptionSignedIn}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.outlineButton, { borderColor: colors.border }]}
                  onPress={handleSignOut}
                  disabled={signingOut}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="logout" size={18} color={colors.text.secondary} />
                  <Text style={[styles.outlineButtonText, { color: colors.text.secondary }]}>
                    {t.signOut}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.accountRow}>
                  <View style={[styles.avatarCircle, { backgroundColor: colors.text.secondary + '15' }]}>
                    <MaterialIcons name="cloud-off" size={22} color={colors.text.secondary} />
                  </View>
                  <View style={styles.accountInfo}>
                    <Text style={[styles.accountLabel, { color: colors.text.primary }]}>
                      {t.guestStatus}
                    </Text>
                    <Text style={[styles.accountDesc, { color: colors.text.secondary }]}>
                      {t.descriptionGuest}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={() => props.navigation.navigate('Auth')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="cloud-upload" size={18} color={colors.text.onPrimary} />
                  <Text style={[styles.primaryButtonText, { color: colors.text.onPrimary }]}>
                    {t.signInOrCreate}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── Bildirimler ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {translations.settings.notifications}
          </Text>

          <View style={[styles.card, { backgroundColor: colors.card.background }]}>
            <View style={styles.notifRow}>
              <View style={[styles.notifIconCircle, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="notifications-active" size={22} color={colors.primary} />
              </View>
              <View style={styles.notifInfo}>
                <Text style={[styles.notifLabel, { color: colors.text.primary }]}>
                  {translations.notifications.dailyWordReminder}
                </Text>
                {notificationsEnabled && (
                  <Text style={[styles.notifTime, { color: colors.text.secondary }]}>
                    {translations.settings.notificationTime}
                  </Text>
                )}
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: colors.text.light, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>
        </View>

        {/* ── Tema ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {translations.settings.themeSelection}
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.text.secondary }]}>
            {translations.settings.themeDescription}
          </Text>

          <View style={styles.themeRow}>
            {themes.map((item) => {
              const isActive = theme === item.type;
              return (
                <TouchableOpacity
                  key={item.type}
                  activeOpacity={0.7}
                  style={[
                    styles.themeChip,
                    {
                      backgroundColor: isActive ? colors.primary + '12' : colors.card.background,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleThemeChange(item.type)}
                >
                  <View style={[styles.themeIconWrap, { backgroundColor: isActive ? colors.primary + '20' : colors.surfaceVariant }]}>
                    <MaterialIcons name={item.icon} size={20} color={isActive ? colors.primary : colors.icon.secondary} />
                  </View>
                  <Text style={[styles.themeChipLabel, { color: isActive ? colors.primary : colors.text.primary }]}>
                    {item.label}
                  </Text>
                  {isActive && (
                    <MaterialIcons name="check-circle" size={18} color={colors.primary} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Dil ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {translations.languageSelector.title}
          </Text>
          <LanguageSelectorSettings />
        </View>

        {/* ── Veri Yönetimi ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {translations.settings.downloadedData.title}
          </Text>

          <View style={[styles.card, { backgroundColor: colors.card.background }]}>
            <View style={styles.dataRow}>
              <View style={[styles.dataIconCircle, { backgroundColor: colors.primary + '15' }]}>
                <MaterialIcons name="storage" size={20} color={colors.primary} />
              </View>
              <View style={styles.dataInfo}>
                <Text style={[styles.dataLabel, { color: colors.text.primary }]}>
                  {translations.settings.downloadedData.learningLanguage}
                </Text>
                <Text style={[styles.dataValue, { color: colors.text.secondary }]}>
                  {hasDownloadedData ? translations.languages[currentLanguagePair.split('-')[1] as keyof typeof translations.languages] : translations.settings.downloadedData.noData}
                </Text>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: colors.border }]} />

            <View style={styles.descBox}>
              <MaterialIcons name="info-outline" size={16} color={colors.text.secondary} style={{ marginTop: 1 }} />
              <Text style={[styles.descText, { color: colors.text.secondary }]}>
                {translations.settings.downloadedData.description}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (globalShowDataLoader) setGlobalShowDataLoader(false);
                setShowDataLoader(true);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="refresh" size={18} color={colors.text.onPrimary} />
              <Text style={[styles.actionButtonText, { color: colors.text.onPrimary }]}>
                {translations.settings.downloadedData.update}
              </Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: colors.border }]} />

            <View style={styles.descBox}>
              <MaterialIcons name="info-outline" size={16} color={colors.text.secondary} style={{ marginTop: 1 }} />
              <Text style={[styles.descText, { color: colors.text.secondary }]}>
                {translations.settings.downloadedData.detailedDescription}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (globalShowDataLoader) setGlobalShowDataLoader(false);
                startDetailedDownload(currentLanguagePair);
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="download" size={18} color={colors.text.onPrimary} />
              <Text style={[styles.actionButtonText, { color: colors.text.onPrimary }]}>
                {translations.settings.downloadedData.updateDetailed}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hazır Kelime Listeleri ── */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {translations.settings.predefinedWordListsTitle || 'Hazır Kelime Listeleri'}
          </Text>
          <Text style={[styles.sectionDesc, { color: colors.text.secondary }]}>
            Kategorilere ayrılmış hazır kelime listeleriyle öğrenmeye hızlı başlayın.
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => props.navigation.navigate('PredefinedWordLists', {})}
            activeOpacity={0.7}
          >
            <MaterialIcons name="library-add" size={18} color={colors.text.onPrimary} />
            <Text style={[styles.actionButtonText, { color: colors.text.onPrimary }]}>
              {translations.settings.predefinedWordListsTitle || 'Hazır Kelime Listesi Ekle'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showDataLoader && (
        <View style={styles.loaderOverlay}>
          <DataLoader
            visible={showDataLoader}
            onComplete={onDataLoadComplete}
            languagePair={currentLanguagePair}
            forceUpdate={true}
          />
        </View>
      )}

      <WordListDownloadModal
        visible={showWordListModal}
        onClose={() => setShowWordListModal(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // ── Section ──
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },

  // ── Card ──
  card: {
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  // ── Account ──
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountEmail: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  accountLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  accountDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  syncBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Buttons ──
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Notifications ──
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifInfo: {
    flex: 1,
  },
  notifLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  notifTime: {
    fontSize: 11,
    marginTop: 2,
  },

  // ── Themes ──
  themeRow: {
    gap: 10,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  themeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeChipLabel: {
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Data ──
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  dataIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dataInfo: {
    flex: 1,
  },
  dataLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  dataValue: {
    fontSize: 13,
    marginTop: 1,
  },
  separator: {
    height: 1,
    marginVertical: 14,
    opacity: 0.5,
  },
  descBox: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  descText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },

  // ── Loader ──
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
