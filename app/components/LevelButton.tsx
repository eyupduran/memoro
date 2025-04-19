import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface LevelButtonProps {
  level: string;
  description: string;
  onPress: () => void;
  isSelected?: boolean;
}

export const LevelButton: React.FC<LevelButtonProps> = ({
  level,
  description,
  onPress,
  isSelected = false,
}) => {
  const { colors } = useTheme();
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: isSelected ? colors.primary : colors.surface,
          borderColor: colors.primary,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.level,
          {
            color: isSelected ? colors.text.onPrimary : colors.text.primary,
          },
        ]}
      >
        {level}
      </Text>
      <Text
        style={[
          styles.description,
          {
            color: isSelected ? colors.text.onPrimary : colors.text.secondary,
          },
        ]}
      >
        {description}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: Dimensions.get('window').width * 0.9,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
  },
  level: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
  },
});