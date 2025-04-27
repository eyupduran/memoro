import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { DailyTriggerInput, CalendarTriggerInput } from 'expo-notifications';

const STORAGE_KEYS = {
  NOTIFICATION_ID: 'notification_id',
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const notificationService = {
  requestPermissions: async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  scheduleDailyReminder: async (hour: number = 10, minute: number = 0, translations: any) => {
    try {
      // Önce eski bildirimi temizle
      const oldNotificationId = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ID);
      if (oldNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(oldNotificationId);
      }

      const trigger: DailyTriggerInput | CalendarTriggerInput = Platform.OS === 'ios' 
        ? {
            type: 'calendar',
            hour,
            minute,
            repeats: true,
          } as CalendarTriggerInput
        : {
            type: 'daily',
            hour,
            minute,
          } as DailyTriggerInput;

      // Yeni günlük bildirimi planla
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: translations.notifications.dailyReminderTitle,
          body: translations.notifications.dailyReminderBody,
          sound: true,
        },
        trigger,
      });

      // Bildirim ID'sini kaydet
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATION_ID, notificationId);
      return true;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return false;
    }
  },

  cancelDailyReminder: async () => {
    try {
      const notificationId = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ID);
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        await AsyncStorage.removeItem(STORAGE_KEYS.NOTIFICATION_ID);
      }
      return true;
    } catch (error) {
      console.error('Error canceling notification:', error);
      return false;
    }
  },

  checkNotificationStatus: async () => {
    try {
      const notificationId = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATION_ID);
      return !!notificationId;
    } catch (error) {
      console.error('Error checking notification status:', error);
      return false;
    }
  },
};

export const scheduleNotification = async (translations: any) => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: translations.notifications.dailyWordReminder,
      body: translations.notifications.dailyWordReminderBody,
    },
    trigger: Platform.OS === 'ios' 
      ? {
          type: 'calendar',
          hour: 10,
          minute: 0,
          repeats: true,
        } as CalendarTriggerInput
      : {
          type: 'daily',
          hour: 10,
          minute: 0,
        } as DailyTriggerInput,
  });
}; 