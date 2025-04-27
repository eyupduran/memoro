import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  ScrollView,
  ImageSourcePropType,
  Alert,
  Dimensions,
  PixelRatio,
  Image,
  Modal,
  Platform,
  PanResponder,
  Animated,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import ViewShot from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as ScreenCapture from 'expo-screen-capture';
import { MaterialIcons } from '@expo/vector-icons';
import type { Word } from '../types/words';
import { storageService } from '../services/storage';
import Slider from '@react-native-community/slider';

type Props = NativeStackScreenProps<RootStackParamList, 'WordOverlay'>;

type WordFormat = 'standard' | 'inline' | 'compact' | 'flashcard' | 'dictionary' | 'quiz' | 'poetic' | 'bubble' | 'memo' | 'modern';

interface LearnedWord extends Word {
  level: string;
  learnedAt: string;
}

export const WordOverlayScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const viewShotRef = useRef<ViewShot>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const { selectedImage, selectedWords, level } = route.params;

  // Özelleştirme State'leri
  const [fontSizeScale, setFontSizeScale] = useState(1);
  const [textColor, setTextColor] = useState(colors.text.onPrimary);
  const [layoutStyle, setLayoutStyle] = useState<'plain' | 'box' | 'gradient' | 'shadow' | 'outline' | 'minimal' | 'card3d' | 'neon' | 'vintage' | 'watercolor' | 'boxShadow'>('plain');
  const [wordFormat, setWordFormat] = useState<WordFormat>('inline');
  const [isCustomizeVisible, setIsCustomizeVisible] = useState(false);
  const [fontFamily, setFontFamily] = useState<string | undefined>(undefined);
  const [positionOffsetX, setPositionOffsetX] = useState(0);
  const [positionOffsetY, setPositionOffsetY] = useState(0);

  // Geçici görüntüleme state'leri
  const [tempFontSize, setTempFontSize] = useState(1);
  const [tempOffsetX, setTempOffsetX] = useState(0);
  const [tempOffsetY, setTempOffsetY] = useState(0);

  // Renk paletini tanımla ve tekrarları kaldır
  const initialColors = [
    colors.text.onPrimary, // Default (White/Black based on theme)
    '#FFFFFF', // Beyaz
    '#000000', // Siyah
    '#FFFF00', // Sarı
    '#00FFFF', // Cyan
    '#FF00FF', // Magenta
    '#FF0000', // Kırmızı
    '#00FF00', // Yeşil
    '#0000FF', // Mavi
    '#FFA500', // Turuncu
    '#800080', // Mor
    '#FFC0CB', // Pembe
    '#FFD700', // Altın
    '#40E0D0', // Turkuaz
    '#98FB98', // Açık Yeşil
  ];
  const PREDEFINED_COLORS = [...new Set(initialColors)];

  // Genişletilmiş Font Listesi
  const AVAILABLE_FONTS = [
    undefined, // Platform Varsayılanı
    Platform.OS === 'ios' ? 'Helvetica' : 'sans-serif',
    Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    Platform.OS === 'ios' ? 'Arial' : 'sans-serif-medium',
    Platform.OS === 'ios' ? 'Georgia' : 'serif-monospace',
    Platform.OS === 'ios' ? 'Verdana' : 'sans-serif-condensed',
    Platform.OS === 'ios' ? 'Trebuchet MS' : 'sans-serif-light',
    Platform.OS === 'ios' ? 'Palatino' : 'serif-medium',
    Platform.OS === 'ios' ? 'Gill Sans' : 'sans-serif-thin',
    Platform.OS === 'ios' ? 'Impact' : 'sans-serif-black',
  ];

  const [activeSection, setActiveSection] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const dotWidths = useRef(Array(7).fill(0).map(() => new Animated.Value(6))).current;
  const windowWidth = Dimensions.get('window').width;

  const scrollToSection = (index: number) => {
    setActiveSection(index);
    const sectionWidth = windowWidth - 32; // Margin'leri çıkar
    scrollViewRef.current?.scrollTo({
      x: index * sectionWidth,
      animated: true
    });
  };

  useEffect(() => {
    dotWidths.forEach((width, index) => {
      Animated.timing(width, {
        toValue: index === activeSection ? 16 : 6,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
  }, [activeSection]);

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const sectionWidth = 220;
    const newSection = Math.round(contentOffset / sectionWidth);
    setActiveSection(newSection);
  };

  const getLayoutStyle = () => {
    switch (layoutStyle) {
      case 'gradient':
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
        };
      case 'shadow':
        return {
          padding: 16,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 8,
        };
      case 'outline':
        return {
          padding: 16,
          marginBottom: 16,
          borderWidth: 2,
          borderColor: textColor,
          borderRadius: 12,
        };
      case 'minimal':
        return {
          padding: 8,
          marginBottom: 12,
        };
      case 'card3d':
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: 16,
          marginBottom: 16,
          borderRadius: 12,
          shadowColor: '#000',
          shadowOffset: { width: 5, height: 5 },
          shadowOpacity: 0.5,
          shadowRadius: 5,
          elevation: 10,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.3)',
          transform: [{ perspective: 1000 }, { rotateX: '5deg' }]
        };
      case 'neon':
        return {
          padding: 16,
          marginBottom: 16,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: textColor,
          shadowColor: textColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 10,
          elevation: 6,
        };
      case 'vintage':
        return {
          backgroundColor: 'rgba(210, 180, 140, 0.3)', // Tan color with opacity
          padding: 16, 
          marginBottom: 16,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: 'rgba(139, 69, 19, 0.6)', // Brown border
        };
      case 'watercolor':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          padding: 16,
          marginBottom: 16,
          borderRadius: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        };
      case 'boxShadow':
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: 16,
          borderRadius: 12,
          marginBottom: 16,
          shadowColor: textColor,
          shadowOffset: { width: 3, height: 3 },
          shadowOpacity: 0.6,
          shadowRadius: 5,
          elevation: 8,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.2)',
        };
      case 'box':
        return {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: 16,
          borderRadius: 12,
          marginBottom: 16,
        };
      default: // 'plain'
        return {
          paddingVertical: 8,
          marginBottom: 16,
        };
    }
  };

  const saveLearnedWords = async () => {
    try {
      const wordsToSave: LearnedWord[] = selectedWords.map(word => ({
        word: word.word,
        meaning: word.meaning,
        example: word.example || '',
        level: level || 'custom',
        learnedAt: new Date().toISOString()
      }));

      const saved = await storageService.saveLearnedWords(wordsToSave);
      if (!saved) {
        throw new Error('Kelimeler kaydedilemedi');
      }
    } catch (error) {
      console.error('Error saving learned words:', error);
      throw error;
    }
  };

  const requestPermission = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    setHasPermission(status === 'granted');
    return status === 'granted';
  };

  const handleSave = async () => {
    try {
      const hasPerms = await requestPermission();
      if (!hasPerms) {
        Alert.alert(translations.alerts.permissionRequired, translations.alerts.galleryPermission);
        return;
      }

      const window = Dimensions.get('window');
      const screen = Dimensions.get('screen');
  

      await ScreenCapture.preventScreenCaptureAsync();
      
      const captureRef = viewShotRef.current;
      if (captureRef && typeof captureRef.capture === 'function') {
        // @ts-ignore - Linter, kütüphane belgelerine rağmen hata veriyor
        const uri = await captureRef.capture({
          format: "png",
          quality: 1,
        });

        Image.getSize(uri, (width, height) => {
        }, (error) => {
          console.error(`Couldn't get size for image ${uri}: ${error}`);
        });

        await MediaLibrary.saveToLibraryAsync(uri);
        
        if (!route.params.isReinforcement) {
          await saveLearnedWords();
        }

        Alert.alert(
          translations.alerts.success,
          route.params.isReinforcement 
            ? translations.alerts.imageSavedWithTip
            : translations.alerts.imageAndWordsSaved,
          [
            {
              text: translations.alerts.okay,
              onPress: () => navigation.navigate('Stats'),
              style: 'default'
            }
          ],
          { cancelable: false }
        );
      }
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert(
        translations.alerts.error,
        translations.alerts.processingError,
        [{ text: translations.alerts.okay, style: 'default' }],
        { cancelable: false }
      );
    } finally {
      await ScreenCapture.allowScreenCaptureAsync();
    }
  };

  // useEffect ile başlangıç değerlerini ayarla
  useEffect(() => {
    setTempFontSize(fontSizeScale);
    setTempOffsetX(positionOffsetX);
    setTempOffsetY(positionOffsetY);
  }, [fontSizeScale, positionOffsetX, positionOffsetY]);

  // Slider değerlerini kontrol eden fonksiyonlar
  const handleFontSizeChange = (value: number) => {
    const roundedValue = Math.round(value * 10) / 10;
    const limitedValue = Math.min(Math.max(roundedValue, 0.8), 1.8);
    setTempFontSize(limitedValue);
  };

  const handlePositionXChange = (value: number) => {
    const roundedValue = Math.round(value / 10) * 10;
    const limitedValue = Math.min(Math.max(roundedValue, -100), 100);
    setTempOffsetX(limitedValue);
  };

  const handlePositionYChange = (value: number) => {
    const roundedValue = Math.round(value / 10) * 10;
    const limitedValue = Math.min(Math.max(roundedValue, -100), 100);
    setTempOffsetY(limitedValue);
  };

  // Slider tamamlama fonksiyonları
  const handleFontSizeComplete = (value: number) => {
    const roundedValue = Math.round(value * 10) / 10;
    const limitedValue = Math.min(Math.max(roundedValue, 0.8), 1.8);
    setFontSizeScale(limitedValue);
  };

  const handlePositionXComplete = (value: number) => {
    const roundedValue = Math.round(value / 10) * 10;
    const limitedValue = Math.min(Math.max(roundedValue, -100), 100);
    setPositionOffsetX(limitedValue);
  };

  const handlePositionYComplete = (value: number) => {
    const roundedValue = Math.round(value / 10) * 10;
    const limitedValue = Math.min(Math.max(roundedValue, -100), 100);
    setPositionOffsetY(limitedValue);
  };

  // Modal açıldığında scroll pozisyonunu aktif seksiyona göre ayarla
  useEffect(() => {
    if (isCustomizeVisible && scrollViewRef.current) {
      const sectionWidth = windowWidth - 32;
      scrollViewRef.current.scrollTo({
        x: activeSection * sectionWidth,
        animated: false
      });
    }
  }, [isCustomizeVisible]);

  const renderSection = (index: number, content: React.ReactNode) => (
    <View style={[styles.customizeSection, { width: windowWidth - 32 }]}>
      {content}
    </View>
  );

  const renderWordContent = (word: Word) => {
    const baseStyle = {
      color: textColor,
      fontFamily: fontFamily,
    };

    switch (wordFormat) {
      case 'flashcard':
        return (
          <View style={styles.flashcardContainer}>
            <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale }]}>
              {word.word}
            </Text>
            <View style={styles.flashcardDivider} />
            <View>
              <Text style={[styles.meaningText, baseStyle, { fontSize: styles.meaningText.fontSize * fontSizeScale, fontStyle: 'italic' }]}>
                {word.meaning}
              </Text>
              {word.example && (
                <Text style={[styles.exampleText, baseStyle, { fontSize: styles.exampleText.fontSize * fontSizeScale, marginTop: 8 }]}>
                  "{word.example}"
                </Text>
              )}
            </View>
          </View>
        );

      case 'dictionary':
        return (
          <View style={styles.dictionaryContainer}>
            <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale, fontWeight: 'bold' }]}>
              {word.word}
            </Text>
            <Text style={[styles.meaningText, baseStyle, { fontSize: styles.meaningText.fontSize * 0.7 * fontSizeScale, marginBottom: 4 }]}>
              /{translations.wordOverlay.pronunciation}/
            </Text>
            <Text style={[styles.meaningText, baseStyle, { fontSize: styles.meaningText.fontSize * fontSizeScale }]}>
              {`isim. ${word.meaning}`}
            </Text>
            {word.example && (
              <Text style={[styles.exampleText, baseStyle, { fontSize: styles.exampleText.fontSize * fontSizeScale, marginTop: 8, fontStyle: 'italic' }]}>
                Örn: {word.example}
              </Text>
            )}
          </View>
        );

      case 'quiz':
        return (
          <View style={styles.quizContainer}>
            <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale }]}>
              {`❓ ${word.word} nedir?`}
            </Text>
            <Text style={[styles.meaningText, baseStyle, { fontSize: styles.meaningText.fontSize * fontSizeScale, marginTop: 8 }]}>
              {`✓ ${word.meaning}`}
            </Text>
            {word.example && (
              <Text style={[styles.exampleText, baseStyle, { fontSize: styles.exampleText.fontSize * fontSizeScale, marginTop: 8 }]}>
                {`💡 ${word.example}`}
              </Text>
            )}
          </View>
        );

      case 'poetic':
        return (
          <View style={styles.dictionaryContainer}>
            <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale, fontStyle: 'italic', textAlign: 'center' }]}>
              ✨ {word.word} ✨
            </Text>
            <Text style={[styles.meaningText, baseStyle, { fontSize: styles.meaningText.fontSize * fontSizeScale, fontStyle: 'italic', textAlign: 'center', marginVertical: 8 }]}>
              {word.meaning}
            </Text>
            {word.example && (
              <Text style={[styles.exampleText, baseStyle, { fontSize: styles.exampleText.fontSize * fontSizeScale, fontStyle: 'italic', textAlign: 'center', marginTop: 8 }]}>
                ~ {word.example} ~
              </Text>
            )}
          </View>
        );

      case 'bubble':
        return (
          <View style={{ alignItems: 'center' }}>
            <View style={[styles.bubbleContainer, { borderColor: textColor }]}>
              <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale, fontWeight: 'bold' }]}>
                {word.word}
              </Text>
            </View>
            <View style={styles.bubbleArrow} />
            <Text style={[styles.meaningText, baseStyle, { fontSize: styles.meaningText.fontSize * fontSizeScale, marginTop: 8 }]}>
              {word.meaning}
            </Text>
            {word.example && (
              <Text style={[styles.exampleText, baseStyle, { fontSize: styles.exampleText.fontSize * fontSizeScale, marginTop: 8, fontStyle: 'italic' }]}>
                "{word.example}"
              </Text>
            )}
          </View>
        );

      case 'memo':
        return (
          <View style={styles.memoContainer}>
            <View style={styles.memoHeader}>
              <Text style={[styles.memoTitle, baseStyle, { fontSize: styles.wordText.fontSize * 0.8 * fontSizeScale }]}>
                {translations.wordOverlay.wordTitle}
              </Text>
            </View>
            <View style={styles.memoContent}>
              <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale, fontWeight: 'bold' }]}>
                {word.word}
              </Text>
              <Text style={[styles.meaningText, baseStyle, { fontSize: styles.meaningText.fontSize * fontSizeScale, marginTop: 8 }]}>
                {word.meaning}
              </Text>
              {word.example && (
                <Text style={[styles.exampleText, baseStyle, { fontSize: styles.exampleText.fontSize * fontSizeScale, marginTop: 8, fontStyle: 'italic' }]}>
                  {word.example}
                </Text>
              )}
            </View>
          </View>
        );

      case 'modern':
        return (
          <View style={styles.modernContainer}>
            <View style={styles.modernWord}>
              <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale, fontWeight: 'bold' }]}>
                {word.word.toUpperCase()}
              </Text>
            </View>
            <View style={styles.modernDivider} />
            <Text style={[styles.meaningText, baseStyle, { fontSize: styles.meaningText.fontSize * fontSizeScale }]}>
              {word.meaning}
            </Text>
            {word.example && (
              <Text style={[styles.exampleText, baseStyle, { fontSize: styles.exampleText.fontSize * fontSizeScale, marginTop: 8 }]}>
                {word.example}
              </Text>
            )}
          </View>
        );

      case 'inline':
        return (
          <>
            <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale }]}>
              {word.word} : {word.meaning}
            </Text>
            {word.example && (
              <Text style={[styles.exampleText, baseStyle, { fontSize: styles.exampleText.fontSize * fontSizeScale }]}>
                {word.example}
              </Text>
            )}
          </>
        );
      case 'compact':
        return (
          <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale }]}>
            {word.word} - {word.meaning}
            {word.example ? `\n${word.example}` : ''}
          </Text>
        );
      default: // 'standard'
        return (
          <>
            <Text style={[styles.wordText, baseStyle, { fontSize: styles.wordText.fontSize * fontSizeScale }]}>
              {word.word}
            </Text>
            <Text style={[styles.meaningText, baseStyle, { fontSize: styles.meaningText.fontSize * fontSizeScale }]}>
              {word.meaning}
            </Text>
            {word.example && (
              <Text style={[styles.exampleText, baseStyle, { fontSize: styles.exampleText.fontSize * fontSizeScale }]}>
                {word.example}
              </Text>
            )}
          </>
        );
    }
  };

  return (
    <View style={styles.container}>
      <ViewShot 
        ref={viewShotRef} 
        style={styles.previewContainer} 
      >
        <ImageBackground 
          source={{ uri: selectedImage }} 
          style={styles.backgroundImage}
          resizeMode="cover"
        >
          <ScrollView 
            style={[
              styles.overlay,
              { backgroundColor: 'rgba(0, 0, 0, 0.2)' }
            ]} 
            contentContainerStyle={[
              styles.contentContainer, 
              { 
                flexGrow: 1, 
                justifyContent: 'flex-start', 
                paddingTop: Dimensions.get('window').height * 0.4 
              }
            ]}
          >
            <View style={[styles.wordContainer, { transform: [{ translateX: positionOffsetX }, { translateY: positionOffsetY }] }]}>
              {selectedWords.map((word, index) => (
                <View key={index} style={[
                  getLayoutStyle(),
                ]}>
                  {renderWordContent(word)}
                </View>
              ))}
            </View>
          </ScrollView>
        </ImageBackground>
      </ViewShot>

      {isCustomizeVisible && (
        <View style={styles.customizeContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setIsCustomizeVisible(false)}
          >
            <MaterialIcons name="close" size={24} color="rgba(0, 0, 0, 0.7)" />
          </TouchableOpacity>

          {/* Kaydırma Göstergesi */}
          <View style={styles.scrollIndicatorContainer}>
            {[0, 1, 2, 3, 4, 5, 6].map((index) => (
              <TouchableOpacity
                key={index}
                onPress={() => scrollToSection(index)}
                style={styles.dotButton}
              >
                <Animated.View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: activeSection === index ? colors.primary : colors.border,
                      width: dotWidths[index],
                    }
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView 
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.customizeScroll}
            contentContainerStyle={styles.customizeContent}
            scrollEnabled={false}
            snapToInterval={windowWidth - 32}
            decelerationRate="fast"
            snapToAlignment="center"
          >
            {/* Format Seçimi */}
            {renderSection(0, (
              <>
                <Text style={[styles.customizeLabel, { color: 'rgba(0, 0, 0, 0.8)' }]}>{translations.wordOverlay.wordFormat}</Text>
                <View style={styles.formatSelector}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'inline' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('inline')}
                    >
                      <Text style={[{ color: wordFormat === 'inline' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.inline}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'standard' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('standard')}
                    >
                      <Text style={[{ color: wordFormat === 'standard' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.standard}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'compact' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('compact')}
                    >
                      <Text style={[{ color: wordFormat === 'compact' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.compact}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'flashcard' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('flashcard')}
                    >
                      <Text style={[{ color: wordFormat === 'flashcard' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.flashcard}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'dictionary' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('dictionary')}
                    >
                      <Text style={[{ color: wordFormat === 'dictionary' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.dictionary}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'quiz' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('quiz')}
                    >
                      <Text style={[{ color: wordFormat === 'quiz' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.quiz}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'poetic' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('poetic')}
                    >
                      <Text style={[{ color: wordFormat === 'poetic' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.poetic}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'bubble' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('bubble')}
                    >
                      <Text style={[{ color: wordFormat === 'bubble' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.bubble}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'memo' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('memo')}
                    >
                      <Text style={[{ color: wordFormat === 'memo' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.memo}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.formatButton,
                        { backgroundColor: wordFormat === 'modern' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setWordFormat('modern')}
                    >
                      <Text style={[{ color: wordFormat === 'modern' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.formatTypes.modern}
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </>
            ))}

            {/* Renk Seçimi */}
            {renderSection(1, (
              <>
                <Text style={[styles.customizeLabel, { color: 'rgba(0, 0, 0, 0.8)' }]}>{translations.wordOverlay.color}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.colorPalette}>
                    {PREDEFINED_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorButton,
                          { backgroundColor: color },
                          textColor === color && { borderColor: colors.primary, borderWidth: 3 },
                        ]}
                        onPress={() => setTextColor(color)}
                      />
                    ))}
                  </View>
                </ScrollView>
              </>
            ))}

            {/* Font Seçimi */}
            {renderSection(2, (
              <>
                <Text style={[styles.customizeLabel, { color: 'rgba(0, 0, 0, 0.8)' }]}>{translations.wordOverlay.font}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.fontSelector}>
                    {AVAILABLE_FONTS.map((font, index) => {
                      const isSelected = fontFamily === font;
                      const fontDisplayName = font || translations.wordOverlay.defaultFont;
                      return (
                        <TouchableOpacity
                          key={fontDisplayName + index}
                          style={[
                            styles.fontButton,
                            { 
                              backgroundColor: isSelected ? colors.primary : 'rgba(0, 0, 0, 0.05)',
                              borderColor: 'rgba(0, 0, 0, 0.1)',
                            }
                          ]}
                          onPress={() => setFontFamily(font)}
                        >
                          <Text style={[
                            styles.fontButtonText,
                            { 
                              fontFamily: font,
                              color: isSelected ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)'
                            }
                          ]}>
                            {fontDisplayName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            ))}

            {/* Düzen Stili */}
            {renderSection(3, (
              <>
                <Text style={[styles.customizeLabel, { color: 'rgba(0, 0, 0, 0.8)' }]}>{translations.wordOverlay.layout}</Text>
                <View style={styles.layoutSelector}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'plain' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('plain')}
                    >
                      <Text style={[{ color: layoutStyle === 'plain' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.plain}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'box' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('box')}
                    >
                      <Text style={[{ color: layoutStyle === 'box' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.box}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'gradient' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('gradient')}
                    >
                      <Text style={[{ color: layoutStyle === 'gradient' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.gradient}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'shadow' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('shadow')}
                    >
                      <Text style={[{ color: layoutStyle === 'shadow' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.shadow}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'outline' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('outline')}
                    >
                      <Text style={[{ color: layoutStyle === 'outline' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.outline}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'minimal' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('minimal')}
                    >
                      <Text style={[{ color: layoutStyle === 'minimal' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.minimal}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'card3d' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('card3d')}
                    >
                      <Text style={[{ color: layoutStyle === 'card3d' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.card3d}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'neon' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('neon')}
                    >
                      <Text style={[{ color: layoutStyle === 'neon' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.neon}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'vintage' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('vintage')}
                    >
                      <Text style={[{ color: layoutStyle === 'vintage' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.vintage}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'watercolor' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('watercolor')}
                    >
                      <Text style={[{ color: layoutStyle === 'watercolor' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.watercolor}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.layoutButton,
                        { backgroundColor: layoutStyle === 'boxShadow' ? colors.primary : 'rgba(0, 0, 0, 0.05)' },
                      ]}
                      onPress={() => setLayoutStyle('boxShadow')}
                    >
                      <Text style={[{ color: layoutStyle === 'boxShadow' ? colors.text.onPrimary : 'rgba(0, 0, 0, 0.8)' }]}>
                        {translations.wordOverlay.layoutTypes.boxShadow}
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </>
            ))}

            {/* Font Boyutu */}
            {renderSection(4, (
              <>
                <Text style={[styles.customizeLabel, { color: 'rgba(0, 0, 0, 0.8)' }]}>
                  {translations.wordOverlay.fontSize}: {tempFontSize.toFixed(1)}x
                </Text>
                <Slider
                  style={styles.customizeSlider}
                  minimumValue={0.8}
                  maximumValue={1.8}
                  step={0.1}
                  value={fontSizeScale}
                  onValueChange={handleFontSizeChange}
                  onSlidingComplete={handleFontSizeComplete}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="rgba(0, 0, 0, 0.1)"
                  thumbTintColor={colors.primary}
                />
              </>
            ))}

            {/* Yatay Konum */}
            {renderSection(5, (
              <>
                <Text style={[styles.customizeLabel, { color: 'rgba(0, 0, 0, 0.8)' }]}>
                  {translations.wordOverlay.horizontal}: {tempOffsetX.toFixed(0)}
                </Text>
                <Slider
                  style={styles.customizeSlider}
                  minimumValue={-100}
                  maximumValue={100}
                  step={10}
                  value={positionOffsetX}
                  onValueChange={handlePositionXChange}
                  onSlidingComplete={handlePositionXComplete}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="rgba(0, 0, 0, 0.1)"
                  thumbTintColor={colors.primary}
                />
              </>
            ))}

            {/* Dikey Konum */}
            {renderSection(6, (
              <>
                <Text style={[styles.customizeLabel, { color: 'rgba(0, 0, 0, 0.8)' }]}>
                  {translations.wordOverlay.vertical}: {tempOffsetY.toFixed(0)}
                </Text>
                <Slider
                  style={styles.customizeSlider}
                  minimumValue={-100}
                  maximumValue={100}
                  step={10}
                  value={positionOffsetY}
                  onValueChange={handlePositionYChange}
                  onSlidingComplete={handlePositionYComplete}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="rgba(0, 0, 0, 0.1)"
                  thumbTintColor={colors.primary}
                />
              </>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
          >
            <MaterialIcons name="save" size={24} color={colors.text.onPrimary} />
            <Text style={[styles.buttonText, { color: colors.text.onPrimary }]}>
              {translations.wordOverlay.saveButton}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => setIsCustomizeVisible(true)}
          >
            <MaterialIcons name="tune" size={24} color={colors.text.onPrimary} />
            <Text style={[styles.buttonText, { color: colors.text.onPrimary }]}>
              {translations.wordOverlay.customizeButton}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('LevelSelection')}
          >
            <MaterialIcons name="home" size={24} color={colors.text.onPrimary} />
            <Text style={[styles.buttonText, { color: colors.text.onPrimary }]}>
              {translations.wordOverlay.homeButton}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    width: '100%',
    height: '100%',
  },
  previewContainer: {
    width: Dimensions.get('screen').width,
    height: Dimensions.get('screen').height,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
    minHeight: Dimensions.get('window').height - 100,
    display: 'flex',
  },
  wordContainer: {
    justifyContent: 'center',
  },
  wordBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  wordText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  meaningText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  exampleText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    minHeight: 80,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginHorizontal: 6,
    flex: 1,
    justifyContent: 'center',
    maxWidth: 120,
  },
  buttonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  customizeContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 0,
    padding: 12,
    height: 140,
    paddingTop: 16,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  scrollIndicatorContainer: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 16,
    gap: 8,
  },
  dotButton: {
    padding: 8,
    marginHorizontal: -4,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    opacity: 0.9,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    padding: 4,
  },
  customizeScroll: {
    flexGrow: 0,
    marginTop: 4,
  },
  customizeContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  customizeSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  customizeLabel: {
    fontSize: 15,
    marginBottom: 12,
    fontWeight: '600',
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  separator: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    marginHorizontal: 10,
  },
  customizeSlider: {
    width: '80%',
    height: 40,
  },
  colorPalette: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    width: '100%',
    paddingHorizontal: 8,
    gap: 8,
  },
  colorButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    marginHorizontal: 2,
  },
  layoutSelector: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    width: '100%',
    paddingHorizontal: 8,
  },
  layoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  fontSelector: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fontButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
  fontButtonText: {
    fontSize: 12,
  },
  wordBoxPlain: {
    paddingVertical: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  formatSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  formatButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  flashcardContainer: {
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  flashcardDivider: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 8,
  },
  dictionaryContainer: {
    padding: 16,
  },
  quizContainer: {
    padding: 16,
  },
  bubbleContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    padding: 16, 
    borderRadius: 50, 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: 120, 
    height: 120,
  },
  bubbleArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(0, 0, 0, 0.5)',
    transform: [{ rotate: '180deg' }],
    marginVertical: 8,
  },
  memoContainer: {
    backgroundColor: 'rgba(255, 255, 204, 0.3)',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 0, 0.3)',
  },
  memoHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 0, 0.3)',
    paddingBottom: 8,
    marginBottom: 12,
  },
  memoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  memoContent: {
    alignItems: 'center',
  },
  modernContainer: {
    padding: 16,
  },
  modernWord: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modernDivider: {
    width: '30%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    marginVertical: 12,
    alignSelf: 'center',
  },
});

export default WordOverlayScreen; 