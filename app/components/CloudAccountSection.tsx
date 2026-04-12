import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useAlert } from '../contexts/AlertContext';
import { cloudSync } from '../services/cloudSync';
import type { RootStackParamList } from '../types/navigation';

/**
 * Shown in the Settings screen. Has two modes:
 *
 *   - Guest (no session): Offers a "Sign in / create account" CTA to back
 *     the user's data up to the cloud. Until the user opts in, the app is
 *     entirely local and offline.
 *
 *   - Authenticated: Shows the signed-in email and a "Sign out" button.
 *     Sign-out preserves local data so the user can keep going as a guest.
 *
 * There is no manual "sync now" button — sync happens automatically in the
 * background after every write (debounced).
 */
export const CloudAccountSection: React.FC = () => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const { user, signOut } = useAuth();
  const { showAlert } = useAlert();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [signingOut, setSigningOut] = useState(false);

  const t = translations.settings.cloudAccount;
  const isSignedIn = !!user;

  const handleSignOut = () => {
    showAlert({
      title: t.signOutConfirmTitle,
      message: t.signOutConfirmMessage,
      variant: 'confirm',
      buttons: [
        { text: t.signOutCancel, style: 'cancel' },
        {
          text: t.signOutConfirm,
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

  const handleSignIn = () => {
    navigation.navigate('Auth');
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text.primary }]}>
        {t.title}
      </Text>
      <Text style={[styles.description, { color: colors.text.secondary }]}>
        {isSignedIn ? t.descriptionSignedIn : t.descriptionGuest}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card.background }]}>
        {isSignedIn ? (
          <>
            <View style={styles.row}>
              <MaterialIcons
                name="person"
                size={20}
                color={colors.text.secondary}
              />
              <Text
                style={[styles.rowText, { color: colors.text.primary }]}
                numberOfLines={1}
              >
                {t.signedInAs.replace('{0}', user?.email || '')}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <>
                  <MaterialIcons
                    name="logout"
                    size={20}
                    color={colors.text.primary}
                  />
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: colors.text.primary },
                    ]}
                  >
                    {t.signOut}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.row}>
              <MaterialIcons
                name="cloud-off"
                size={20}
                color={colors.text.secondary}
              />
              <Text style={[styles.rowText, { color: colors.text.secondary }]}>
                {t.guestStatus}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
              onPress={handleSignIn}
            >
              <MaterialIcons
                name="cloud-upload"
                size={20}
                color={colors.text.onPrimary}
              />
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: colors.text.onPrimary },
                ]}
              >
                {t.signInOrCreate}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowText: {
    fontSize: 14,
    flex: 1,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
