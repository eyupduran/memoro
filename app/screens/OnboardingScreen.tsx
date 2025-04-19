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

const { width, height } = Dimensions.get('window');

const onboardingData = [
  {
    title: 'Hoş Geldiniz',
    description: 'Memoro ile İngilizce kelime öğrenmeye hazır mısınız?',
    icon: 'school',
  },
  {
    title: 'Seviyenizi Seçin',
    description: 'A1\'den C2\'ye kadar istediğiniz seviyede kelimeler öğrenin.',
    icon: 'grade',
  },
  {
    title: 'Görselleştirin',
    description: 'Kelimeleri görsellerle birleştirerek daha kalıcı öğrenin.',
    icon: 'image',
  },
  {
    title: 'Sözlük',
    description: 'İstediğiniz kelimeleri seçip kendi öğrenme setinizi oluşturun.',
    icon: 'menu-book',
  },
  {
    title: 'İlerleyişinizi Takip Edin',
    description: 'Öğrendiğiniz kelimeleri kaydedin ve gelişiminizi görün.',
    icon: 'trending-up',
  },
];

type OnboardingScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export const OnboardingScreen = () => {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();
  const [activeIndex, setActiveIndex] = useState(0);
  const { colors } = useTheme();
  const carouselRef = useRef<ICarouselInstance>(null);

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
      await AsyncStorage.setItem('hasSeenOnboarding', 'true');
      navigation.replace('LevelSelection');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
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
        <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
          <MaterialIcons name={item.icon as any} size={100} color={colors.primary} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text.primary }]}>{item.title}</Text>
          <Text style={[styles.description, { color: colors.text.secondary }]}>{item.description}</Text>
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View 
        style={[styles.container]}
        {...panResponder.panHandlers}
      >
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
            {activeIndex !== onboardingData.length - 1 && (
              <TouchableOpacity
                style={[styles.skipButton, { borderColor: colors.primary }]}
                onPress={finishOnboarding}
              >
                <Text style={[styles.skipButtonText, { color: colors.primary }]}>
                  Atla
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleNext}
            >
              <Text style={[styles.buttonText, { color: colors.background }]}>
                {activeIndex === onboardingData.length - 1 ? 'Başla' : 'İleri'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  skipButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
}); 