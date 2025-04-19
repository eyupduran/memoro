import React from 'react';
import { TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ImageCardProps {
  source: any;
  onSelect: () => void;
  isSelected?: boolean;
}

export const ImageCard: React.FC<ImageCardProps> = ({
  source,
  onSelect,
  isSelected = false,
}) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          borderColor: isSelected ? colors.primary : colors.border,
          backgroundColor: colors.surface,
        },
      ]}
      onPress={onSelect}
    >
      <Image source={source} style={styles.image} resizeMode="cover" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: Dimensions.get('window').width * 0.44,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 2,
    margin: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
}); 