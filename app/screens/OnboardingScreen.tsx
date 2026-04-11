import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { LanguageSelector } from '../components/LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';
import { DataLoader } from '../components/DataLoader';
import { onboardingState } from '../services/onboardingState';
import { OnboardingPredefinedWordListsScreen } from './OnboardingPredefinedWordListsScreen';

const { height } = Dimensions.get('window');

type OnboardingItem = {
  title: string;
  description: string;
  icon: string;
  component?: React.ComponentType;
};

export const OnboardingScreen = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [showDataLoader, setShowDataLoader] = useState(false);
  const [showWordListScreen, setShowWordListScreen] = useState(false);

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
    },
  ];

  const handleBack = () => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (activeIndex === onboardingData.length - 1) {
      setShowWordListScreen(true);
    } else {
      setActiveIndex(activeIndex + 1);
    }
  };

  const finishOnboarding = async () => {
    setShowDataLoader(true);
  };

  const onDataLoadComplete = async () => {
    // Data seeded. Mark onboarding as seen — the navigator subscribes to this
    // and will swap to the Auth stack automatically (no manual navigate).
    setShowDataLoader(false);
    try {
      await onboardingState.markSeen();
    } catch (error) {
      console.error('Error marking onboarding as seen:', error);
    }
  };

  const handleWordListComplete = () => {
    setShowWordListScreen(false);
    setShowDataLoader(true);
  };

  const currentItem = onboardingData[activeIndex];

  // Kelime listesi ekranını göster
  if (showWordListScreen) {
    return (
      <OnboardingPredefinedWordListsScreen 
        onComplete={handleWordListComplete} 
        onSkip={finishOnboarding}
      />
    );
  }

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
}); 