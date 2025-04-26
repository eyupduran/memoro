import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type NativeLanguage = 'tr'| 'pt';
type LearningLanguage = 'en';

const nativeLanguages: { code: NativeLanguage; name: string }[] = [
  { code: 'tr', name: 'Türkçe' },
  { code: 'pt', name: 'Portekizce' },
];

const learningLanguages: { code: LearningLanguage; name: string }[] = [
  { code: 'en', name: 'İngilizce' },
];

export const LanguageSelector = () => {
  const { nativeLanguage, learningLanguage, setNativeLanguage, setLearningLanguage } = useLanguage();
  const [showNativeDropdown, setShowNativeDropdown] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mainContainer}>
        <Text style={styles.title}>Dil Seçimi</Text>
        
        <Text style={styles.description}>
          Öğrenme deneyiminizi kişiselleştirmek için ana dilinizi seçin. 
          Kelimelerin anlamları ve açıklamaları seçtiğiniz dilde gösterilecektir.
        </Text>

        <View style={styles.dropdownContainer}>
          <Text style={styles.label}>Ana Diliniz</Text>
          <TouchableOpacity 
            style={styles.dropdown}
            onPress={() => setShowNativeDropdown(!showNativeDropdown)}
          >
            <Text style={styles.selectedText}>
              {nativeLanguages.find(lang => lang.code === nativeLanguage)?.name || 'Türkçe'}
            </Text>
            <MaterialIcons 
              name={showNativeDropdown ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
              size={24} 
              color={colors.text.primary} 
            />
          </TouchableOpacity>

          {showNativeDropdown && (
            <View style={styles.dropdownList}>
              {nativeLanguages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[
                    styles.dropdownItem,
                    nativeLanguage === lang.code && styles.selectedItem
                  ]}
                  onPress={() => {
                    setNativeLanguage(lang.code);
                    setShowNativeDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
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
          <Text style={styles.label}>Öğreneceğiniz Dil</Text>
          <View style={styles.dropdown}>
            <Text style={styles.selectedText}>
              {learningLanguages.find(lang => lang.code === learningLanguage)?.name || 'İngilizce'}
            </Text>
          </View>
          <Text style={styles.note}>
            Şu an için sadece İngilizce öğrenme seçeneği mevcuttur. 
            Yakında yeni diller eklenecektir.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.infoText}>
            Dil seçiminizi istediğiniz zaman değiştirebilirsiniz. 
            Değişiklik yaptığınızda, kelime listeleri yeni seçtiğiniz dile göre güncellenecektir.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-start',
    marginTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  dropdownContainer: {
    marginBottom: 24,
  },
  learningLanguageContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  selectedText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedItem: {
    backgroundColor: colors.primary,
  },
  dropdownItemText: {
    fontSize: 16,
    color: colors.text.primary,
  },
  selectedItemText: {
    color: '#FFFFFF',
  },
  note: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: 16,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
}); 