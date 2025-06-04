import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type NativeLanguage = 'tr'| 'pt';
type LearningLanguage = 'en';

export const LanguageSelector = () => {
  const { nativeLanguage, learningLanguage, setNativeLanguage, setLearningLanguage, translations } = useLanguage();
  const { colors } = useTheme();
  const [showNativeDropdown, setShowNativeDropdown] = useState(false);

  const nativeLanguages: { code: NativeLanguage; name: string }[] = [
    { code: 'tr', name: translations.languages.tr },
    { code: 'pt', name: translations.languages.pt },
  ];

  const learningLanguages: { code: LearningLanguage; name: string }[] = [
    { code: 'en', name: translations.languages.en },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.dropdownContainer}>
        <Text style={[styles.label, { color: colors.text.primary }]}>
          {translations.languageSelector.nativeLanguage}
        </Text>
        <TouchableOpacity 
          style={[styles.dropdown, { 
            backgroundColor: colors.background,
            borderColor: colors.border 
          }]}
          onPress={() => setShowNativeDropdown(!showNativeDropdown)}
        >
          <Text style={[styles.selectedText, { color: colors.text.primary }]}>
            {nativeLanguages.find(lang => lang.code === nativeLanguage)?.name || translations.languages.tr}
          </Text>
          <MaterialIcons 
            name={showNativeDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
            size={24} 
            color={colors.text.primary} 
          />
        </TouchableOpacity>

        {showNativeDropdown && (
          <View style={[styles.dropdownList, { 
            backgroundColor: colors.background,
            borderColor: colors.border 
          }]}>
            {nativeLanguages.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[
                  styles.dropdownItem,
                  { borderBottomColor: colors.border },
                  nativeLanguage === lang.code && { backgroundColor: colors.primary }
                ]}
                onPress={() => {
                  setNativeLanguage(lang.code);
                  setShowNativeDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  { color: colors.text.primary },
                  nativeLanguage === lang.code && styles.selectedItemText
                ]}>
                  {lang.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.learningLanguageContainer}>
        <Text style={[styles.label, { color: colors.text.primary }]}>
          {translations.languageSelector.learningLanguage}
        </Text>
        <View style={[styles.dropdown, { 
          backgroundColor: colors.background,
          borderColor: colors.border 
        }]}>
          <Text style={[styles.selectedText, { color: colors.text.primary }]}>
            {learningLanguages.find(lang => lang.code === learningLanguage)?.name || translations.languages.en}
          </Text>
        </View>
        <Text style={[styles.note, { color: colors.text.secondary }]}>
          {translations.languageSelector.note}
        </Text>
      </View>

      <Text style={[styles.infoText, { color: colors.text.secondary }]}>
        {translations.languageSelector.info}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  dropdownContainer: {
    marginBottom: 24,
    zIndex: 1,
  },
  learningLanguageContainer: {
    marginBottom: 24,
    zIndex: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectedText: {
    fontSize: 16,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    zIndex: 2,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
  },
  selectedItemText: {
    color: '#FFFFFF',
  },
  note: {
    fontSize: 14,
    marginTop: 8,
    fontStyle: 'italic',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 24,
  },
}); 