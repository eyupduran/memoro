import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingScreen } from './app/screens/OnboardingScreen';
import { LevelSelectionScreen } from './app/screens/LevelSelectionScreen';
import { WordCountScreen } from './app/screens/WordCountScreen';
import { WordListScreen } from './app/screens/WordListScreen';
import { ImageSelectionScreen } from './app/screens/ImageSelectionScreen';
import { WordOverlayScreen } from './app/screens/WordOverlayScreen';
import { StatsScreen } from './app/screens/StatsScreen';
import { SettingsScreen } from './app/screens/SettingsScreen';
import DictionaryScreen from './app/screens/DictionaryScreen';
import ExerciseScreen from './app/screens/ExerciseScreen';
import ExerciseQuestionScreen from './app/screens/ExerciseQuestionScreen';
import ExerciseResultScreen from './app/screens/ExerciseResultScreen';
import { WordListDetailScreen } from './app/screens/WordListDetailScreen';
import { RootStackParamList } from './app/types/navigation';

import * as Notifications from 'expo-notifications';
import { View } from 'react-native';
import { ThemeProvider, useTheme } from './app/context/ThemeContext';
import { LanguageProvider, useLanguage } from './app/contexts/LanguageContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const { colors, theme } = useTheme();
  const { translations } = useLanguage();

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      // console.log('Notification received:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      // console.log('Notification response received:', response);
      // Handle interaction, e.g., navigate to a specific screen
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  const [navigationTheme, setNavigationTheme] = useState<Theme>({
    dark: theme === 'dark',
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text.primary,
      border: colors.border,
      notification: colors.accent,
    }
  });

  useEffect(() => {
    setNavigationTheme(prevTheme => ({
      ...prevTheme,
      dark: theme === 'dark',
      colors: {
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text.primary,
        border: colors.border,
        notification: colors.accent,
      }
    }));
  }, [colors, theme]);

  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const value = await AsyncStorage.getItem('hasSeenOnboarding');
      setHasSeenOnboarding(value === 'true');
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasSeenOnboarding(false);
    }
  };

  if (hasSeenOnboarding === null) {
    return null;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName={hasSeenOnboarding ? 'LevelSelection' : 'Onboarding'}
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerShadowVisible: false,
          headerTintColor: colors.text.primary,
          headerTitleStyle: {
            fontWeight: '700',
            color: colors.text.primary,
          },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="LevelSelection"
          component={LevelSelectionScreen}
          options={{ title: translations.levelSelection.title }}
        />
        <Stack.Screen
          name="WordCount"
          component={WordCountScreen}
          options={{ title: translations.wordCount.title }}
        />
        <Stack.Screen
          name="WordList"
          component={WordListScreen}
          options={{ title: translations.wordList.title.replace('{0}', '') }}
        />
        <Stack.Screen
          name="ImageSelection"
          component={ImageSelectionScreen}
          options={{ title: translations.imageSelection.title }}
        />
        <Stack.Screen
          name="WordOverlay"
          component={WordOverlayScreen}
          options={{ title: translations.wordOverlay.preview || 'Önizleme' }}
        />
        <Stack.Screen
          name="Stats"
          component={StatsScreen}
          options={{ title: translations.stats.title }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: translations.settings.title || 'Ayarlar' }}
        />
        <Stack.Screen
          name="Dictionary"
          component={DictionaryScreen}
          options={{ title: translations.dictionaryScreen.title || 'Sözlük' }}
        />
        <Stack.Screen
          name="Exercise"
          component={ExerciseScreen}
          options={{ title: translations.exercise.title }}
        />
        <Stack.Screen
          name="ExerciseQuestion"
          component={ExerciseQuestionScreen}
          options={{ title: translations.exercise.question.title.replace('{0}', '').replace('{1}', '') }}
        />
        <Stack.Screen
          name="ExerciseResult"
          component={ExerciseResultScreen}
          options={{ title: translations.exercise.result.title }}
        />
        <Stack.Screen
          name="WordListDetail"
          component={WordListDetailScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const ThemedAppContainer = () => {
  const { colors } = useTheme();
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppNavigator />
      </View>
    </SafeAreaProvider>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ThemedAppContainer />
      </LanguageProvider>
    </ThemeProvider>
  );
}
