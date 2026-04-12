import React, { useEffect, useState, useRef, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingScreen } from './app/screens/OnboardingScreen';
import { LevelSelectionScreen } from './app/screens/LevelSelectionScreen';
import { WordCountScreen } from './app/screens/WordCountScreen';
import { WordListScreen } from './app/screens/WordListScreen';
import { ImageSelectionScreen } from './app/screens/ImageSelectionScreen';
import { WordOverlayScreen } from './app/screens/WordOverlayScreen';
import { StatsScreen } from './app/screens/StatsScreen';
import { SettingsScreen } from './app/screens/SettingsScreen';
import { GrammarScreen } from './app/screens/GrammarScreen';
import { DetailedDictionaryScreen } from './app/screens/DetailedDictionaryScreen';
import { WordDetailScreen } from './app/screens/WordDetailScreen';
import DictionaryScreen from './app/screens/DictionaryScreen';
import ExerciseScreen from './app/screens/ExerciseScreen';
import ExerciseQuestionScreen from './app/screens/ExerciseQuestionScreen';
import ExerciseResultScreen from './app/screens/ExerciseResultScreen';
import { WordListDetailScreen } from './app/screens/WordListDetailScreen';
import { AuthScreen } from './app/screens/AuthScreen';
import { RootStackParamList } from './app/types/navigation';

import * as Notifications from 'expo-notifications';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { View, ActivityIndicator } from 'react-native';
import { ThemeProvider, useTheme } from './app/context/ThemeContext';
import { LanguageProvider, useLanguage } from './app/contexts/LanguageContext';
import { AuthProvider, useAuth } from './app/contexts/AuthContext';
import ExerciseDetailScreen from './app/screens/ExerciseDetailScreen';
import GamesScreen from './app/screens/GamesScreen';
import PredefinedWordListsScreen from './app/screens/PredefinedWordListsScreen';
import { AutoWallpaperSettingsScreen } from './app/screens/AutoWallpaperSettingsScreen';
import { dbService } from './app/services/database';
import { cloudSync } from './app/services/cloudSync';
import { onboardingState } from './app/services/onboardingState';
import { DetailedDownloadProvider } from './app/contexts/DetailedDownloadContext';
import { DetailedDataLoaderBanner } from './app/components/DetailedDataLoader';
import { SyncBanner } from './app/components/SyncBanner';

// Register the sync hook once, at module load. Every dbService write method
// calls markDirty(table) → onDirty(table) → cloudSync.markTableDirty(table),
// which debounces a push to Supabase for ONLY the dirty tables. This keeps
// every call site clean (no per-screen sync code).
dbService.setOnDirty((table) => cloudSync.markTableDirty(table));

// Configure expo-av audio mode once, at module load. Without this, the
// default Android interruption mode aggressively demands audio focus and
// fails with AudioFocusNotAcquiredException whenever the system is even
// slightly unhappy — even when our app is in the foreground. Setting a
// more cooperative mode makes the short success/fail/streak sound effects
// in the exercise flow play reliably.
Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  staysActiveInBackground: false,
  playsInSilentModeIOS: true,
  shouldDuckAndroid: true,
  interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
  playThroughEarpieceAndroid: false,
}).catch((err) => {
  // Non-fatal: sounds may still play, just with the default focus policy.
  console.warn('[audio] setAudioModeAsync failed:', err);
});

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const { colors, theme, reloadTheme } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const { session, initializing } = useAuth();

  // Whenever a session appears (fresh sign-in OR app relaunch with a
  // persisted session), let cloudSync decide what to do:
  //   - same user as last time → push any pending offline edits
  //   - brand new user + empty cloud → migrate local guest data up
  //   - brand new user + cloud has data → wipe local and pull
  // See cloudSync.onSignInBootstrap for the full decision tree.
  //
  // Keyed on user.id so token refreshes don't re-trigger the flow.
  useEffect(() => {
    if (initializing) return;
    if (!session) return;
    cloudSync.onSignInBootstrap(currentLanguagePair)
      .then((pulled) => {
        if (pulled) {
          // Cloud'dan veri çekildiyse theme gibi ayarlar değişmiş olabilir
          reloadTheme();
        }
      })
      .catch((err) => {
        console.warn('[cloudSync] sign-in bootstrap failed:', err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, initializing]);

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
    // Initial load: hydrate the onboarding flag from AsyncStorage, then
    // subscribe to it so the navigator re-renders the moment OnboardingScreen
    // calls onboardingState.markSeen() — no navigation.replace() needed.
    onboardingState
      .load()
      .then((value) => setHasSeenOnboarding(value))
      .catch((err) => {
        console.error('Error loading onboarding state:', err);
        setHasSeenOnboarding(false);
      });

    const unsubscribe = onboardingState.subscribe((value) => {
      setHasSeenOnboarding(value);
    });
    return unsubscribe;
  }, []);

  // Auth is optional. Only onboarding gates the main stack — users can
  // browse the entire app as a guest (no account required). Sign-in is
  // available as a regular screen reachable from Settings.
  //
  // NOTE: stackMode and mainInitialRoute must be computed BEFORE any
  // early return. React's rules-of-hooks require every hook to be
  // called on every render in the same order, and useMemo below is a
  // hook — putting it after a conditional return crashes with
  // "Rendered more hooks than during the previous render".
  const stackMode: 'onboarding' | 'main' =
    hasSeenOnboarding === true ? 'main' : 'onboarding';

  // Decide the initial route for the main stack exactly once per mount.
  // When onboarding just finished, we consume the one-shot auth prompt
  // flag here so the very next render (which unmounts the Onboarding
  // screen and mounts the main stack) lands on Auth as the last
  // onboarding step. We deliberately do this inside useMemo instead of
  // inline in JSX so the side effect (clearPendingAuthPrompt) only fires
  // once, even under React StrictMode double-rendering.
  const mainInitialRoute = useMemo<'LevelSelection' | 'Auth'>(() => {
    if (stackMode !== 'main') return 'LevelSelection';
    if (onboardingState.hasPendingAuthPrompt()) {
      onboardingState.clearPendingAuthPrompt();
      return 'Auth';
    }
    return 'LevelSelection';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackMode]);

  if (hasSeenOnboarding === null || initializing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack.Navigator
        // Force a full remount of Stack.Navigator whenever we transition
        // between stack modes OR between different initial routes inside
        // the main stack. React Navigation's <Stack.Navigator> only honors
        // `initialRouteName` on its *first* mount, so a naked prop change
        // here would be ignored — new routes would still fall back to the
        // first <Stack.Screen> in the list. Keying on (stackMode +
        // initial route) guarantees a fresh Navigator instance picks up
        // the new initialRouteName every time it matters.
        key={stackMode === 'main' ? `main:${mainInitialRoute}` : 'onboarding'}
        // Main stack normally lands on LevelSelection, but when onboarding
        // just finished we route to Auth first as the final onboarding
        // step (see mainInitialRoute above). The user can either sign in
        // or tap "Continue as guest" to proceed. The prompt is one-shot:
        // killing and reopening the app goes straight to LevelSelection.
        initialRouteName={stackMode === 'main' ? mainInitialRoute : 'Onboarding'}
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
        {stackMode === 'onboarding' && (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        )}
        {stackMode === 'main' && (
          <>
        <Stack.Screen
          name="LevelSelection"
          component={LevelSelectionScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
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
          name="Grammar"
          component={GrammarScreen}
          options={{
            headerShown: true,
            title: translations.home.grammar,
          }}
        />
        <Stack.Screen
          name="Games"
          component={GamesScreen}
          options={{
            headerShown: true,
            title: translations.home.games,
          }}
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
          options={{ 
            title: 'Soru' // Sabit başlık
          }}
        />
        <Stack.Screen
          name="ExerciseResult"
          component={ExerciseResultScreen}
          options={{ 
            title: translations.exercise.result.title 
          }}
        />
        <Stack.Screen
          name="ExerciseDetail"
          component={ExerciseDetailScreen}
          options={{ title: translations.exercise.detail.title }}
        />
        <Stack.Screen
          name="WordListDetail"
          component={WordListDetailScreen}
        />
        <Stack.Screen
          name="DetailedDictionary"
          component={DetailedDictionaryScreen}
          options={{ title: 'Cambridge Dictionary' }}
        />
        <Stack.Screen
          name="WordDetail"
          component={WordDetailScreen}
          options={{ title: translations.wordDetail.title }}
        />
        <Stack.Screen
          name="PredefinedWordLists"
          component={PredefinedWordListsScreen}
          options={{ title: translations.settings.predefinedWordListsTitle || 'Hazır Kelime Listeleri' }}
        />
        <Stack.Screen
          name="AutoWallpaperSettings"
          component={AutoWallpaperSettingsScreen}
          options={{ title: translations.wallpaper.auto.title }}
        />
          </>
        )}
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
        <DetailedDataLoaderBanner />
        <SyncBanner />
      </View>
    </SafeAreaProvider>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <DetailedDownloadProvider>
            <ThemedAppContainer />
          </DetailedDownloadProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
