import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface WordCardProps {
  word: string;
  meaning: string;
  example: string;
  isSelected: boolean;
  onToggle: () => void;
}

export const WordCard: React.FC<WordCardProps> = ({
  word,
  meaning,
  example,
  isSelected,
  onToggle,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? colors.primary : colors.surface,
          borderColor: colors.primary,
        },
      ]}
      onPress={onToggle}
    >
      <Text
        style={[
          styles.word,
          {
            color: isSelected ? colors.text.onPrimary : colors.text.primary,
          },
        ]}
      >
        {word}
      </Text>
      <Text
        style={[
          styles.meaning,
          {
            color: isSelected ? colors.text.onPrimary : colors.text.secondary,
          },
        ]}
      >
        {meaning}
      </Text>
      <Text
        style={[
          styles.example,
          {
            color: isSelected ? colors.text.onPrimary : colors.text.secondary,
            fontStyle: 'italic',
          },
        ]}
      >
        {example}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: Dimensions.get('window').width * 0.9,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 2,
  },
  word: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  meaning: {
    fontSize: 16,
    marginBottom: 8,
  },
  example: {
    fontSize: 14,
  },
}); 