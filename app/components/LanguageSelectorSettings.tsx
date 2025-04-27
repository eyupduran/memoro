import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

type NativeLanguage = 'tr' | 'pt';
type LearningLanguage = 'en';

export const LanguageSelectorSettings: React.FC = () => {
  const { nativeLanguage, learningLanguage, setNativeLanguage, setLearningLanguage, translations } = useLanguage();
  const { colors } = useTheme();
  const [showNativeDropdown, setShowNativeDropdown] = useState(false);
  const [previousLanguage, setPreviousLanguage] = useState<NativeLanguage>(nativeLanguage);
  
  useEffect(() => {
    // Dil değiştikten sonra bildirim göster
    if (previousLanguage !== nativeLanguage && previousLanguage) {
      // Bildirim göster
      Alert.alert(
        translations.languageSelector.title,
        translations.languageSelector.info,
        [{ text: 'OK', style: 'default' }]
      );
    }
    
    setPreviousLanguage(nativeLanguage);
  }, [nativeLanguage]);
  
  const nativeLanguages: { code: NativeLanguage; name: string }[] = [
    { code: 'tr', name: translations.languages.tr },
    { code: 'pt', name: translations.languages.pt },
  ];

  const learningLanguages: { code: LearningLanguage; name: string }[] = [
    { code: 'en', name: translations.languages.en },
  ];

  const handleLanguageChange = (lang: NativeLanguage) => {
    if (lang !== nativeLanguage) {
      setNativeLanguage(lang);
    }
    setShowNativeDropdown(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
          {translations.languageSelector.title}
        </Text>
        <Text style={[styles.sectionDescription, { color: colors.text.secondary }]}>
          {translations.languageSelector.description}
        </Text>
      </View>

      <View style={styles.languageCards}>
        {/* Ana Dil Seçimi */}
        <View style={[styles.languageCard, { backgroundColor: colors.card.background }]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="translate" size={24} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
              {translations.languageSelector.nativeLanguage}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.dropdown, { borderColor: colors.border }]}
            onPress={() => setShowNativeDropdown(!showNativeDropdown)}
          >
            <Text style={[styles.selectedText, { color: colors.text.primary }]}>
              {nativeLanguages.find(lang => lang.code === nativeLanguage)?.name || translations.languages.tr}
            </Text>
            <MaterialIcons 
              name={showNativeDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
              size={24} 
              color={colors.icon.secondary} 
            />
          </TouchableOpacity>

          {showNativeDropdown && (
            <View style={[styles.dropdownList, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {nativeLanguages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: colors.border },
                    nativeLanguage === lang.code && [styles.selectedItem, { backgroundColor: colors.primary }]
                  ]}
                  onPress={() => handleLanguageChange(lang.code)}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    { color: colors.text.primary },
                    nativeLanguage === lang.code && { color: colors.text.onPrimary }
                  ]}>
                    {lang.name}
                  </Text>
                  {nativeLanguage === lang.code && (
                    <MaterialIcons name="check" size={20} color={colors.text.onPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Öğrenme Dili Seçimi */}
        <View style={[styles.languageCard, { backgroundColor: colors.card.background }]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="school" size={24} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text.primary }]}>
              {translations.languageSelector.learningLanguage}
            </Text>
          </View>
          
          <View style={[styles.dropdown, { borderColor: colors.border }]}>
            <Text style={[styles.selectedText, { color: colors.text.primary }]}>
              {learningLanguages.find(lang => lang.code === learningLanguage)?.name || translations.languages.en}
            </Text>
            <MaterialIcons name="info-outline" size={20} color={colors.icon.secondary} />
          </View>
          
          <Text style={[styles.note, { color: colors.text.secondary }]}>
            {translations.languageSelector.note}
          </Text>
        </View>
      </View>

      <View style={styles.infoContainer}>
        <MaterialIcons name="info" size={20} color={colors.icon.secondary} style={styles.infoIcon} />
        <Text style={[styles.infoText, { color: colors.text.secondary }]}>
          {translations.languageSelector.info}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  header: {
    marginBottom: 16,
  },
  languageCards: {
    gap: 20,
  },
  languageCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectedText: {
    fontSize: 16,
  },
  dropdownList: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
  },
  selectedItem: {},
  dropdownItemText: {
    fontSize: 16,
  },
  note: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
    paddingHorizontal: 4,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 20,
    paddingHorizontal: 4,
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
}); 