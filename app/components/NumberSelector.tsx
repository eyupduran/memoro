import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface NumberSelectorProps {
  value: number;
  onSelect: (value: number) => void;
  min: number;
  max: number;
  selectedValue: number;
}

const { width } = Dimensions.get('window');

export const NumberSelector: React.FC<NumberSelectorProps> = ({
  value,
  onSelect,
  min,
  max,
  selectedValue,
}) => {
  const { colors } = useTheme();
  const isSelected = value === selectedValue;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: isSelected ? colors.primary : colors.surface,
          borderColor: colors.primary,
          shadowColor: colors.text.primary,
          borderWidth: isSelected ? 2 : 1,
        },
      ]}
      onPress={() => onSelect(value)}
    >
      <Text
        style={[
          styles.number,
          {
            color: isSelected ? colors.text.onPrimary : colors.text.primary,
          },
        ]}
      >
        {value}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: width * 0.25,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    margin: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  number: {
    fontSize: 32,
    fontWeight: '700',
  },
}); 