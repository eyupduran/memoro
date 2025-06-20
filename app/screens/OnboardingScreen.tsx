import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';
import { DataLoader } from '../components/DataLoader';
import { backupService } from '../services/backup';
import { translations as allTranslations, NativeLanguage } from '../contexts/LanguageContext';

const { width, height } = Dimensions.get('window');

type OnboardingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

type OnboardingItem = {
  title: string;
  description: string;
  icon: string;
  component?: React.ComponentType;
  navigateTo?: keyof RootStackParamList;
};

export const OnboardingScreen = () => {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const [activeIndex, setActiveIndex] = useState(0);
  const { colors, setTheme } = useTheme();
  const { translations, currentLanguagePair, setNativeLanguage } = useLanguage();
  const [showDataLoader, setShowDataLoader] = useState(false);
  const [showImportOption, setShowImportOption] = useState(false);
  const [isUpdatingDataForNewLanguage, setIsUpdatingDataForNewLanguage] = useState(false);
  const [newLanguagePair, setNewLanguagePair] = useState<string | null>(null);

  const onboardingData: OnboardingItem[] = [
    {
      title: translations.onboarding.welcome,
      description: translations.onboarding.welcomeDescription,
      icon: 'school',
    },
    {
      title: translations.onboarding.languageSelection,
      description: translations.onboarding.nativeLanguage,
      icon: 'language',
      component: LanguageSelector,
    },
    {
      title: translations.onboarding.selectLevel,
      description: translations.onboarding.selectLevelDescription,
      icon: 'grade',
    },
    {
      title: translations.onboarding.visualize,
      description: translations.onboarding.visualizeDescription,
      icon: 'image',
    },
    {
      title: translations.onboarding.dictionary,
      description: translations.onboarding.dictionaryDescription,
      icon: 'menu-book',
    },
    {
      title: translations.onboarding.trackProgress,
      description: translations.onboarding.trackProgressDescription,
      icon: 'trending-up',
    },
    {
      title: translations.onboarding.exerciseTitle,
      description: translations.onboarding.exerciseDescription,
      icon: 'fitness-center',
    },
    {
      title: translations.onboarding.predefinedLists,
      description: translations.onboarding.predefinedListsDescription,
      icon: 'library-books',
      navigateTo: 'PredefinedWordLists'
    },
  ];

  const handleBack = () => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleNext = () => {
    const currentItem = onboardingData[activeIndex];
    
    if (activeIndex === onboardingData.length - 1) {
      if (currentItem.navigateTo) {
        AsyncStorage.setItem('hasSeenOnboarding', 'true').then(() => {
          navigation.replace(currentItem.navigateTo!, { fromOnboarding: true });
        });
      } else {
        finishOnboarding();
      }
    } else {
      setActiveIndex(activeIndex + 1);
    }
  };

  const finishOnboarding = async () => {
    try {
      setShowDataLoader(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  const onDataLoadComplete = async () => {
    try {
      setShowDataLoader(false);
      setShowImportOption(true);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const reloadSettings = async () => {
    try {
      const themeSetting = await AsyncStorage.getItem('theme');
      if (themeSetting) {
        setTimeout(() => {
          setTheme(themeSetting as any);
        }, 100);
      }
      
      const languageSetting = await AsyncStorage.getItem('selectedLanguage');
      if (languageSetting && (languageSetting === 'tr' || languageSetting === 'pt')) {
        setTimeout(() => {
          setNativeLanguage(languageSetting as any);
        }, 200);
      }
    } catch (error) {
      console.error('Ayarlar yeniden yüklenirken hata:', error);
    }
  };

  const handleImportData = async () => {
    try {
      const result = await backupService.restoreData(reloadSettings);
      if (result.success && result.languagePair) {
        if (result.languagePair !== currentLanguagePair) {
          // Dil çifti farklı, güncelleme gerekiyor
          setNewLanguagePair(result.languagePair);
          const newNativeLang = result.languagePair.split('-')[1] as NativeLanguage;
          
          setNativeLanguage(newNativeLang);
          
          setShowImportOption(false);
          
          const newTranslations = allTranslations[newNativeLang];

          setTimeout(() => {
            Alert.alert(
              newTranslations.settings.backup.languageChangedTitle,
              newTranslations.settings.backup.languageChangedMessage,
              [
                {
                  text: newTranslations.alerts.okay,
                  onPress: () => {
                    setIsUpdatingDataForNewLanguage(true);
                  }
                }
              ]
            );
          }, 500);

        } else {
          // Dil çifti aynı, normal başarı mesajı
          setTimeout(() => {
            Alert.alert(
              translations.alerts.success,
              translations.settings.backup.importSuccess,
              [
                {
                  text: translations.alerts.okay,
                  onPress: completeOnboarding
                }
              ]
            );
          }, 500);
        }
      } else {
        // İçe aktarma başarısız oldu
        completeOnboarding();
      }
    } catch (error) {
      console.error('Veri içe aktarma hatası:', error);
      completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      
      setTimeout(() => {
        navigation.replace('LevelSelection');
      }, 300);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const onDataUpdateComplete = () => {
    setIsUpdatingDataForNewLanguage(false);
    completeOnboarding();
  }

  const currentItem = onboardingData[activeIndex];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {activeIndex > 0 && (
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBack}
        >
          <MaterialIcons 
            name="arrow-back-ios" 
            size={24} 
            color={colors.text.primary}
          />
          <Text style={[styles.backText, { color: colors.text.primary }]}>
            {translations.onboarding.back}
          </Text>
        </TouchableOpacity>
      )}
      <View style={styles.slide}>
        {currentItem.component ? (
          <currentItem.component />
        ) : (
          <>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <MaterialIcons name={currentItem.icon as any} size={100} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: colors.text.primary }]}>{currentItem.title}</Text>
              <Text style={[styles.description, { color: colors.text.secondary }]}>{currentItem.description}</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.pagination}>
          {onboardingData.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                { backgroundColor: colors.text.light },
                index === activeIndex && [styles.paginationDotActive, { backgroundColor: colors.primary }],
              ]}
            />
          ))}
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleNext}
          >
            <Text style={[styles.buttonText, { color: colors.background }]}>
              {activeIndex === onboardingData.length - 1 
                ? translations.onboarding.start 
                : activeIndex === 0 
                  ? "Next" 
                  : translations.onboarding.next}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {showDataLoader && (
        <DataLoader 
          visible={showDataLoader} 
          onComplete={onDataLoadComplete}
          languagePair={currentLanguagePair}
        />
      )}

      {isUpdatingDataForNewLanguage && newLanguagePair && (
        <DataLoader
          visible={isUpdatingDataForNewLanguage}
          onComplete={onDataUpdateComplete}
          languagePair={newLanguagePair}
          forceUpdate={true} // Kelime verilerini zorla güncelle
        />
      )}

      {showImportOption && (
        <View style={[styles.importOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
          <View style={[styles.importCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.importTitle, { color: colors.text.primary }]}>
              {translations.settings.backup.title}
            </Text>
            
            <Text style={[styles.importDescription, { color: colors.text.secondary }]}>
              {translations.settings.backup.importInfo}
            </Text>
            
            <View style={styles.importButtonsContainer}>
              <TouchableOpacity
                style={[styles.importButton, { backgroundColor: colors.surfaceVariant }]}
                onPress={completeOnboarding}
              >
                <Text style={[styles.importButtonText, { color: colors.text.primary }]}>
                  {translations.settings.backup.importCancel}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.importButton, { backgroundColor: colors.primary }]}
                onPress={handleImportData}
              >
                <Text style={[styles.importButtonText, { color: colors.text.onPrimary }]}>
                  {translations.settings.backup.import}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: height * 0.20,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: height * 0.05,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  paginationDotActive: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    position: 'absolute',
    top: height * 0.08,
    left: 20,
    zIndex: 1,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    marginLeft: 4,
    fontWeight: '500',
  },
  importOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  importCard: {
    width: width * 0.85,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  importTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  importDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  importButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  importButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 