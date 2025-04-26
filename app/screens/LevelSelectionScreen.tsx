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
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import * as Font from 'expo-font';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 56) / 2; // 56 = padding (20 * 2) + margin between cards (16)

type Props = NativeStackScreenProps<RootStackParamList, 'LevelSelection'>;

type LevelIconName = 'school' | 'auto-stories' | 'menu-book' | 'local-library' | 
  'psychology' | 'workspace-premium' | 'military-tech' | 'grade';

interface Level {
  id: string;
  name: string;
  icon: LevelIconName;
  description: string;
}

const LEVELS: Level[] = [
  { id: 'A1', name: 'A1', icon: 'school', description: 'Başlangıç' },
  { id: 'A2', name: 'A2', icon: 'auto-stories', description: 'Temel' },
  { id: 'B1', name: 'B1', icon: 'menu-book', description: 'Orta Öncesi' },
  { id: 'B2', name: 'B2', icon: 'psychology', description: 'Orta Üstü' },
  { id: 'C1', name: 'C1', icon: 'workspace-premium', description: 'İleri' },
  { id: 'C2', name: 'C2', icon: 'military-tech', description: 'Üst' },
  { id: 'YDS', name: 'YDS', icon: 'grade', description: 'Sınav' },
];

export const LevelSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          MaterialIcons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf'),
        });
        setFontsLoaded(true);
      } catch (error) {
        console.warn('Error loading MaterialIcons font:', error);
        setFontsLoaded(true); // Continue anyway to prevent white screen
      }
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Yükleniyor...
        </Text>
      </View>
    );
  }

  const handleLevelSelect = (level: string) => {
    navigation.navigate('WordCount', { level });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Seviye Seçin
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Öğrenmek istediğiniz seviyeyi seçin
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.levelGrid}
      >
        {LEVELS.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.levelCard,
              { 
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => handleLevelSelect(level.id)}
          >
            <MaterialIcons 
              name={level.icon}
              size={28} 
              color={colors.primary}
              style={styles.levelIcon}
            />
            <Text style={[styles.levelName, { color: colors.text.primary }]}>
              {level.name}
            </Text>
            <Text style={[styles.levelDescription, { color: colors.text.secondary }]}>
              {level.description}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.tabBar, { 
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
      }]}>
        <TouchableOpacity 
          style={[styles.tabButton, styles.tabButtonActive]}
          onPress={() => {}}
        >
          <MaterialIcons name="home" size={24} color={colors.primary} />
          <Text style={[styles.tabText, { color: colors.primary }]}>
            Ana Sayfa
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => navigation.navigate('Dictionary')}
        >
          <MaterialIcons name="book" size={24} color={colors.text.secondary} />
          <Text style={[styles.tabText, { color: colors.text.secondary }]}>
            Sözlük
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => navigation.navigate('Stats')}
        >
          <MaterialIcons name="analytics" size={24} color={colors.text.secondary} />
          <Text style={[styles.tabText, { color: colors.text.secondary }]}>
            İstatistik
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabButton} 
          onPress={() => navigation.navigate('Settings')}
        >
          <MaterialIcons name="settings" size={24} color={colors.text.secondary} />
          <Text style={[styles.tabText, { color: colors.text.secondary }]}>
            Ayarlar
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 100,
  },
  levelCard: {
    width: CARD_WIDTH,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  levelIcon: {
    marginBottom: 8,
  },
  levelName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  levelDescription: {
    fontSize: 13,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
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
    paddingVertical: 4,
    flex: 1,
  },
  tabButtonActive: {
    borderRadius: 8,
  },
  tabText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
}); 