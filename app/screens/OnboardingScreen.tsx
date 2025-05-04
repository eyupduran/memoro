import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Extrapolate } from 'react-native-reanimated';
import { LanguageSelector } from '../components/LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';
import { DataLoader } from '../components/DataLoader';

const { width, height } = Dimensions.get('window');

type OnboardingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export const OnboardingScreen = () => {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const [activeIndex, setActiveIndex] = useState(0);
  const { colors } = useTheme();
  const { translations, currentLanguagePair, checkAndLoadLanguageData } = useLanguage();
  const carouselRef = useRef<ICarouselInstance>(null);
  const [showDataLoader, setShowDataLoader] = useState(false);

  const onboardingData = [
    {
      title: translations.onboarding.welcome,
      description: translations.onboarding.welcomeDescription,
      icon: 'school',
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
      title: translations.onboarding.languageSelection,
      description: translations.onboarding.nativeLanguage,
      icon: 'language',
      component: LanguageSelector,
    },
  ];

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (evt, gestureState) => {
      if (Math.abs(gestureState.dx) > 50) {
        if (gestureState.dx > 0 && activeIndex > 0) {
          carouselRef.current?.prev();
        } else if (gestureState.dx < 0 && activeIndex < onboardingData.length - 1) {
          carouselRef.current?.next();
        }
      }
    },
  });

  const finishOnboarding = async () => {
    try {
      setShowDataLoader(true);
      // Veri indirme işlemi tamamlandıktan sonra ana sayfaya yönlendir
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  const onDataLoadComplete = async () => {
    try {
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      setShowDataLoader(false);
      navigation.replace('LevelSelection');
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const handleNext = () => {
    if (activeIndex === onboardingData.length - 1) {
      finishOnboarding();
    } else {
      carouselRef.current?.next();
    }
  };

  const renderItem = ({ item, index }: { item: typeof onboardingData[0]; index: number }) => {
    return (
      <View style={[styles.slide, { backgroundColor: colors.background }]}>
        {item.component ? (
          <item.component />
        ) : (
          <>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <MaterialIcons name={item.icon as any} size={100} color={colors.primary} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: colors.text.primary }]}>{item.title}</Text>
              <Text style={[styles.description, { color: colors.text.secondary }]}>{item.description}</Text>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container]}>
        <Carousel
          ref={carouselRef}
          width={width}
          height={height * 0.6}
          data={onboardingData}
          renderItem={renderItem}
          onSnapToItem={(index) => {
            setActiveIndex(index);
          }}
          mode="parallax"
          modeConfig={{
            parallaxScrollingScale: 0.9,
            parallaxScrollingOffset: 40,
          }}
          loop={false}
          enabled={true}
          autoPlay={false}
          scrollAnimationDuration={300}
          snapEnabled={true}
          windowSize={3}
          defaultIndex={0}
          pagingEnabled={true}
          vertical={false}
        />
        <View style={styles.footer}>
          <View style={styles.pagination}>
            {onboardingData.map((_, index) => (
              <Animated.View
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
                {activeIndex === onboardingData.length - 1 ? translations.onboarding.start : translations.onboarding.next}
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
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
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
    paddingBottom: 40,
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
}); 