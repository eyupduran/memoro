import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { ThemeType } from '../theme/themes';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import * as Notifications from 'expo-notifications';
import { LanguageSelectorSettings } from '../components/LanguageSelectorSettings';
import { DataLoader } from '../components/DataLoader';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<Props> = () => {
  const { theme, setTheme, colors } = useTheme();
  const { translations, currentLanguagePair, showDataLoader, setShowDataLoader } = useLanguage();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    checkNotificationSettings();
  }, []);

  const checkNotificationSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem('notificationsEnabled');
      setNotificationsEnabled(enabled === 'true');
    } catch (error) {
      console.error('Error checking notification settings:', error);
    }
  };

  // Android için bildirim kanalını ayarlar
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

  // Günlük bildirimi zamanlar
  async function scheduleDailyNotification() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync(); // Önceki zamanlamaları iptal et
      await setupNotificationChannelAndroid(); // Android kanalını kontrol et/oluştur

      const notificationContent = {
        title: "☀️ Günaydın!",
        body: 'Bugün yeni kelimeler öğrenme zamanı! Hadi başlayalım 💪',
      };

      await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: 10,
          minute: 0,
        },
      });
      console.log('Günlük bildirim saat 10:00 için ayarlandı.');
      return true; // Başarılı
    } catch (error) {
        console.error("Error scheduling notification:", error);
        Alert.alert(translations.alerts.error, translations.alerts.notificationSchedulingError);
        return false; // Başarısız
    }
  }

  // Tüm bildirimleri iptal eder
  async function cancelAllNotifications() {
    try{
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('Tüm zamanlanmış bildirimler iptal edildi.');
    } catch (error) {
        console.error("Error cancelling notifications:", error);
        Alert.alert(translations.alerts.error, translations.alerts.notificationCancellationError);
    }
  }

  // Bildirim ayarını değiştirme işlevi
  const handleNotificationToggle = async () => {
    const previousState = notificationsEnabled;
    const newState = !previousState;
    // Önce UI'ı iyimser bir şekilde güncelle
    setNotificationsEnabled(newState);

    try {
      if (newState) {
        // Bildirimler açıldı, izin iste
        const { status } = await Notifications.requestPermissionsAsync();

        if (status === 'granted') {
          // İzin verildi, bildirimi zamanla
          const scheduled = await scheduleDailyNotification();
          if (scheduled) {
             await AsyncStorage.setItem('notificationsEnabled', 'true');
          } else {
              // Zamanlama başarısız oldu, durumu geri al
              setNotificationsEnabled(false);
              await AsyncStorage.setItem('notificationsEnabled', 'false');
          }
        } else {
          // İzin reddedildi
          Alert.alert(translations.alerts.permissionRequired, translations.notifications.dailyWordReminderBody);
          setNotificationsEnabled(false); // UI'ı geri al
          await AsyncStorage.setItem('notificationsEnabled', 'false');
        }
      } else {
        // Bildirimler kapatıldı, zamanlanmış olanları iptal et
        await cancelAllNotifications();
        await AsyncStorage.setItem('notificationsEnabled', 'false');
      }
    } catch (error) {
      console.error("Error handling notification toggle:", error);
      Alert.alert(translations.alerts.error, translations.alerts.processingError);
      // Hata durumunda UI durumunu önceki haline geri al
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

  // Veri indirme işlemi tamamlandığında
  const onDataLoadComplete = () => {
    setShowDataLoader(false);
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
    {
      type: 'pastel',
      label: translations.settings.themes.pastel.label,
      icon: 'palette',
      description: translations.settings.themes.pastel.description,
    },
  ];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {translations.settings.themeSelection}
        </Text>
        <Text style={[styles.sectionDescription, { color: colors.text.secondary }]}>
          {translations.settings.themeDescription}
        </Text>
        <View style={styles.themeContainer}>
          {themes.map((item) => (
            <TouchableOpacity
              key={item.type}
              style={[
                styles.themeCard,
                { backgroundColor: colors.card.background },
                theme === item.type && {
                  borderColor: colors.primary,
                  borderWidth: 2,
                },
              ]}
              onPress={() => handleThemeChange(item.type)}
            >
              <View style={[
                styles.iconContainer,
                { backgroundColor: colors.surfaceVariant }
              ]}>
                <MaterialIcons
                  name={item.icon}
                  size={28}
                  color={theme === item.type ? colors.primary : colors.icon.secondary}
                />
              </View>
              <View style={styles.themeInfo}>
                <Text style={[
                  styles.themeLabel,
                  { color: colors.text.primary }
                ]}>
                  {item.label}
                </Text>
                <Text style={[
                  styles.themeDescription,
                  { color: colors.text.secondary }
                ]}>
                  {item.description}
                </Text>
              </View>
              {theme === item.type && (
                <MaterialIcons
                  name="check-circle"
                  size={24}
                  color={colors.primary}
                  style={styles.checkIcon}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {translations.languageSelector.title}
        </Text>
        <LanguageSelectorSettings />
      </View>

      <View style={styles.section}>
        <View style={styles.notificationHeader}>
          <View style={styles.notificationTextContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {translations.settings.notifications}
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: colors.text.light, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>
        {notificationsEnabled && (
          <Text style={[styles.notificationTimeInfo, { color: colors.text.secondary }]}>
            {translations.settings.notificationTime}
          </Text>
        )}
      </View>
      
      <DataLoader 
        visible={showDataLoader} 
        onComplete={onDataLoadComplete}
        languagePair={currentLanguagePair}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 20,
  },
  themeContainer: {
    gap: 16,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 80,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  themeInfo: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 36,
  },
  themeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  themeDescription: {
    fontSize: 14,
    flexWrap: 'wrap',
    lineHeight: 18,
  },
  checkIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
  },
  notificationSection: {
    marginBottom: 0,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notificationTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  notificationTimeInfo: {
    fontSize: 12,
    marginTop: 4,
  }
}); 