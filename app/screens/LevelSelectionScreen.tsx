import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Platform,
  Image,
  StatusBar,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { MoreModal } from '../components/MoreModal';

const AUTO_WALLPAPER_PROMO_FLAG = 'auto_wallpaper_promo_seen_v1';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 56) / 2; // 56 = padding (20 * 2) + margin between cards (16)

type Props = NativeStackScreenProps<RootStackParamList, 'LevelSelection'>;

type LevelIconName = 'school' | 'auto-stories' | 'menu-book' | 'local-library' | 
  'psychology' | 'workspace-premium' | 'military-tech' | 'grade';

interface Level {
  id: string;
  name: string;
  icon: LevelIconName;
  descriptionKey: string;
  color?: string;
}

export const LevelSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { colors, theme } = useTheme();
  const { translations } = useLanguage();
  const [isMoreModalVisible, setIsMoreModalVisible] = useState(false);
  const [autoWallpaperPromoVisible, setAutoWallpaperPromoVisible] = useState(false);

  // First-time auto-wallpaper promo modal. Shown exactly once, on the
  // first LevelSelection mount after onboarding completes. By this point
  // the DB is seeded so navigating to AutoWallpaperSettings will render
  // a real preview with real words + backgrounds.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(AUTO_WALLPAPER_PROMO_FLAG);
        if (seen === 'true') return;
        // Small delay so the level screen finishes rendering first
        setTimeout(() => setAutoWallpaperPromoVisible(true), 600);
      } catch {
        // ignore
      }
    })();
  }, []);

  const dismissAutoWallpaperPromo = async () => {
    setAutoWallpaperPromoVisible(false);
    try {
      await AsyncStorage.setItem(AUTO_WALLPAPER_PROMO_FLAG, 'true');
    } catch {
      // ignore
    }
  };

  const openAutoWallpaperSettingsFromPromo = async () => {
    await dismissAutoWallpaperPromo();
    navigation.navigate('AutoWallpaperSettings');
  };

  const LEVELS: Level[] = [
    { id: 'A1', name: 'A1', icon: 'school', descriptionKey: 'A1', color: '#4CAF50' },
    { id: 'A2', name: 'A2', icon: 'auto-stories', descriptionKey: 'A2', color: '#8BC34A' },
    { id: 'B1', name: 'B1', icon: 'menu-book', descriptionKey: 'B1', color: '#03A9F4' },
    { id: 'B2', name: 'B2', icon: 'psychology', descriptionKey: 'B2', color: '#3F51B5' },
    { id: 'C1', name: 'C1', icon: 'workspace-premium', descriptionKey: 'C1', color: '#9C27B0' },
    { id: 'C2', name: 'C2', icon: 'military-tech', descriptionKey: 'C2', color: '#F44336' },
  ];

  useEffect(() => {
    // Arka planda fontları yükle ama kullanıcıya gösterme
    async function loadFonts() {
      try {
        await Font.loadAsync({
          MaterialIcons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
        });
      } catch (error) {
        console.warn('Error loading MaterialIcons font:', error);
      }
    }
    loadFonts();
  }, []);

  const handleLevelSelect = (level: string) => {
    navigation.navigate('WordCount', { level });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {translations.levelSelection.title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          {translations.levelSelection.subtitle}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.levelGrid}
      >
        {LEVELS.map((level) => {
          const isDarkTheme = theme === 'dark';
          const cardBgColor = isDarkTheme ? colors.surfaceVariant : colors.surface;
          
          return (
            <TouchableOpacity
              key={level.id}
              style={[
                styles.levelCard,
                { 
                  backgroundColor: cardBgColor,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => handleLevelSelect(level.id)}
            >
              <View style={[styles.iconWrapper, {backgroundColor: level.color + (isDarkTheme ? '30' : '15')}]}>
                <MaterialIcons 
                  name={level.icon}
                  size={32} 
                  color={level.color}
                />
              </View>
              <Text style={[styles.levelName, { color: colors.text.primary }]}>
                {level.name}
              </Text>
              <Text style={[styles.levelDescription, { color: colors.text.secondary }]}>
                {translations.levelSelection.levels[level.descriptionKey as keyof typeof translations.levelSelection.levels]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.tabBar, { 
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
      }]}>
        <TouchableOpacity 
          style={styles.tabButton}
          onPress={() => {}}
        >
          <View style={[styles.tabButtonContent, styles.tabButtonActive]}>
            <MaterialIcons name="home" size={22} color={colors.primary} />
            <Text style={[styles.tabText, { color: colors.primary }]}>
              {translations.levelSelection.tabs.home}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => navigation.navigate('Dictionary')}
        >
          <View style={styles.tabButtonContent}>
            <MaterialIcons name="book" size={22} color={colors.text.secondary} />
            <Text style={[styles.tabText, { color: colors.text.secondary }]}>
              {translations.levelSelection.tabs.dictionary}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => navigation.navigate('Stats')}
        >
          <View style={styles.tabButtonContent}>
            <MaterialIcons name="analytics" size={22} color={colors.text.secondary} />
            <Text style={[styles.tabText, { color: colors.text.secondary }]}>
              {translations.levelSelection.tabs.stats}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton}
          onPress={() => navigation.navigate('Exercise')}
        >
          <View style={styles.tabButtonContent}>
            <MaterialIcons name="fitness-center" size={22} color={colors.text.secondary} />
            <Text style={[styles.tabText, { color: colors.text.secondary }]}>
              {translations.exercise.tabs.exercise}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => setIsMoreModalVisible(true)}
        >
          <View style={styles.tabButtonContent}>
            <MaterialIcons name="more-horiz" size={22} color={colors.text.secondary} />
            <Text style={[styles.tabText, { color: colors.text.secondary }]}>
              {translations.more?.title || 'Daha Fazla'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <MoreModal
        visible={isMoreModalVisible}
        onClose={() => setIsMoreModalVisible(false)}
        navigation={navigation}
      />

      {/* First-time auto-wallpaper promo */}
      <Modal
        transparent
        visible={autoWallpaperPromoVisible}
        animationType="fade"
        onRequestClose={dismissAutoWallpaperPromo}
      >
        <View style={promoStyles.backdrop}>
          <View style={[promoStyles.card, { backgroundColor: colors.surface }]}>
            <View
              style={[
                promoStyles.iconCircle,
                { backgroundColor: `${colors.primary}18` },
              ]}
            >
              <MaterialIcons name="lock" size={54} color={colors.primary} />
            </View>
            <Text style={[promoStyles.title, { color: colors.text.primary }]}>
              {translations.wallpaper.auto.onboardingTitle}
            </Text>
            <Text style={[promoStyles.body, { color: colors.text.secondary }]}>
              {translations.wallpaper.auto.onboardingDescription}
            </Text>
            <TouchableOpacity
              style={[promoStyles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={openAutoWallpaperSettingsFromPromo}
            >
              <MaterialIcons
                name="settings"
                size={20}
                color={colors.text.onPrimary}
              />
              <Text
                style={[
                  promoStyles.primaryBtnText,
                  { color: colors.text.onPrimary },
                ]}
              >
                {translations.wallpaper.auto.onboardingEnable}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={promoStyles.skipBtn}
              onPress={dismissAutoWallpaperPromo}
            >
              <Text style={[promoStyles.skipBtnText, { color: colors.text.secondary }]}>
                {translations.wallpaper.auto.onboardingSkip}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const promoStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 22,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  skipBtn: {
    marginTop: 12,
    padding: 8,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    marginTop: 60,
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 100,
  },
  levelCard: {
    width: CARD_WIDTH,
    padding: 14,
    borderRadius: 15,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  iconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  levelName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 3,
  },
  levelDescription: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 2,
  },
  tabButtonContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 16,
    width: '100%',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  tabText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
    flexWrap: 'nowrap',
    width: '100%',
  },
}); 