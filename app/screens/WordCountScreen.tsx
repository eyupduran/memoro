import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'WordCount'>;

const WORD_COUNTS = [3, 4, 5, 6];
const { width } = Dimensions.get('window');
const CARD_MARGIN = 10;
const CARD_WIDTH = (width - 40 - CARD_MARGIN * 2) / 2;

export const WordCountScreen: React.FC<Props> = ({ route, navigation }) => {
  const { level } = route.params;
  const [selectedCount, setSelectedCount] = useState<number>(3);
  const { colors } = useTheme();

  const handleCountSelect = (count: number) => {
    setSelectedCount(count);
    navigation.navigate('WordList', {
      level,
      wordCount: count,
    });
  };

  const getLevelDescription = (count: number) => {
    switch (count) {
      case 3:
        return 'Başlangıç';
      case 4:
        return 'Orta';
      case 5:
        return 'İyi';
      case 6:
        return 'İleri';
      default:
        return '';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          Günlük Hedef
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Her gün kaç kelime öğrenmek istiyorsunuz?
        </Text>
      </View>

      <View style={styles.grid}>
        {WORD_COUNTS.map((count) => (
          <TouchableOpacity
            key={count}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: selectedCount === count ? colors.primary : colors.border,
                borderWidth: selectedCount === count ? 2 : 1,
              },
            ]}
            onPress={() => handleCountSelect(count)}
          >
            <View style={styles.cardContent}>
              <View style={[
                styles.iconContainer,
                {
                  backgroundColor: selectedCount === count 
                    ? colors.primary 
                    : colors.background
                }
              ]}>
                <MaterialIcons
                  name={count <= 4 ? "speed" : "rocket-launch"}
                  size={24}
                  color={selectedCount === count ? colors.text.onPrimary : colors.text.secondary}
                />
              </View>
              <Text style={[
                styles.countText,
                { 
                  color: colors.text.primary,
                  fontWeight: selectedCount === count ? '700' : '600'
                }
              ]}>
                {count} Kelime
              </Text>
              <Text style={[
                styles.descriptionText,
                { 
                  color: colors.text.secondary,
                  fontWeight: selectedCount === count ? '600' : '400'
                }
              ]}>
                {getLevelDescription(count)} Seviye
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -CARD_MARGIN,
  },
  card: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    marginBottom: CARD_MARGIN * 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardContent: {
    padding: 20,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  countText: {
    fontSize: 18,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
  },
  footer: {
    marginTop: 'auto',
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
}); 