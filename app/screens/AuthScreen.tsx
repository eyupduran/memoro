import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import type { RootStackParamList } from '../types/navigation';

type Mode = 'signIn' | 'signUp';

/**
 * Optional account screen reachable from Settings. Lets the user either
 * create an account or sign in to an existing one. If the user is already
 * browsing as a guest with local data, a successful sign-up triggers a
 * migration (handled in cloudSync.onSignInBootstrap) that pushes the
 * guest's local data to the cloud.
 *
 * On successful auth the screen pops itself off the stack — the user lands
 * back on Settings, which re-renders with the signed-in state.
 */
export const AuthScreen: React.FC = () => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const { signIn, signUp } = useAuth();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  /**
   * Dismiss the auth screen and return the user to the app. If the screen
   * was pushed from Settings (normal case), just goBack. If it happens to
   * be the top of the stack for any reason, reset to LevelSelection so we
   * never end up with the "GO_BACK not handled" error.
   */
  const dismiss = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'LevelSelection' }],
      });
    }
  };

  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const t = translations.auth;

  const validate = (): string | null => {
    if (!email.trim() || !password.trim()) return t.emptyFields;
    // Very basic email shape check — Supabase itself will do the real validation
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) return t.invalidEmail;
    if (password.length < 6) return t.passwordTooShort;
    return null;
  };

  const errorMessageFor = (code?: string): string => {
    switch (code) {
      case 'invalid_credentials':
        return t.errorInvalidCredentials;
      case 'email_not_confirmed':
        return t.errorEmailNotConfirmed;
      case 'user_already_registered':
        return t.errorUserAlreadyRegistered;
      case 'weak_password':
        return t.errorWeakPassword;
      case 'invalid_email':
        return t.errorInvalidEmail;
      case 'rate_limit':
        return t.errorRateLimit;
      case 'network':
        return t.errorNetwork;
      default:
        return t.errorUnknown;
    }
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      Alert.alert(translations.alerts.error, validationError);
      return;
    }
    setSubmitting(true);
    try {
      const result =
        mode === 'signIn'
          ? await signIn(email, password)
          : await signUp(email, password);

      if (!result.success) {
        Alert.alert(translations.alerts.error, errorMessageFor(result.errorCode));
        return;
      }

      // Success — dismiss back to wherever we came from. The AuthContext
      // state flip will cause CloudAccountSection to re-render in its
      // signed-in form. Sign-up gets a welcome alert first so the
      // migration-about-to-happen isn't silent.
      if (mode === 'signUp') {
        Alert.alert(t.signUpSuccessTitle, t.signUpSuccessMessage, [
          { text: 'OK', onPress: dismiss },
        ]);
      } else {
        dismiss();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="auto-stories" size={40} color={colors.text.onPrimary} />
          </View>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {t.welcomeTitle}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {t.welcomeSubtitle}
          </Text>
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              mode === 'signIn' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setMode('signIn')}
            disabled={submitting}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    mode === 'signIn' ? colors.text.onPrimary : colors.text.secondary,
                },
              ]}
            >
              {t.signInTab}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              mode === 'signUp' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setMode('signUp')}
            disabled={submitting}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    mode === 'signUp' ? colors.text.onPrimary : colors.text.secondary,
                },
              ]}
            >
              {t.signUpTab}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Mode-specific info banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + '12' }]}>
          <MaterialIcons
            name={mode === 'signIn' ? 'login' : 'person-add'}
            size={18}
            color={colors.primary}
            style={{ marginRight: 8, marginTop: 1 }}
          />
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            {mode === 'signIn' ? t.signInInfo : t.signUpInfo}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text.secondary }]}>
            {t.emailLabel}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.text.primary,
                borderColor: colors.border,
              },
            ]}
            placeholder={t.emailPlaceholder}
            placeholderTextColor={colors.text.light}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!submitting}
          />

          <Text style={[styles.label, { color: colors.text.secondary, marginTop: 16 }]}>
            {t.passwordLabel}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.text.primary,
                borderColor: colors.border,
              },
            ]}
            placeholder={t.passwordPlaceholder}
            placeholderTextColor={colors.text.light}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!submitting}
          />

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.text.onPrimary} />
            ) : (
              <Text style={[styles.submitText, { color: colors.text.onPrimary }]}>
                {mode === 'signIn' ? t.signInButton : t.signUpButton}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Escape hatch: user doesn't want to sign in at all. This is the
            primary way out of the Auth screen — the user should always feel
            like skipping is a first-class option, not a hidden corner X. */}
        <TouchableOpacity
          style={[styles.guestButton, { borderColor: colors.border }]}
          onPress={dismiss}
          disabled={submitting}
        >
          <Text style={[styles.guestButtonText, { color: colors.text.primary }]}>
            {t.continueAsGuest}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  guestButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  form: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
  },
  submitButton: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
