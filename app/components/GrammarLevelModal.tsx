import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelectLevel: (level: string) => void;
};

const { width } = Dimensions.get('window');

export const GrammarLevelModal: React.FC<Props> = ({ visible, onClose, onSelectLevel }) => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const slideAnim = React.useRef(new Animated.Value(width)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: width,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [visible]);

  const levels = [
    { id: 'a1', title: 'A1 Elementary', url: 'https://test-english.com/grammar-points/a1/' },
    { id: 'a2', title: 'A2 Pre-intermediate', url: 'https://test-english.com/grammar-points/a2/' },
    { id: 'b1', title: 'B1 Intermediate', url: 'https://test-english.com/grammar-points/b1/' },
    { id: 'b1plus', title: 'B1+ Upper-intermediate', url: 'https://test-english.com/grammar-points/b1-b2/' },
    { id: 'b2', title: 'B2 Upper-intermediate', url: 'https://test-english.com/grammar-points/b2/' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.surface,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              {translations.grammar?.selectLevel || 'Seviye Seçin'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.menuContainer}>
            {levels.map((level, index) => (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.menuItem,
                  { borderBottomColor: colors.border },
                  index === levels.length - 1 && styles.lastMenuItem,
                ]}
                onPress={() => {
                  onSelectLevel(level.url);
                }}
              >
                <View style={styles.menuItemContent}>
                  <MaterialIcons
                    name="school"
                    size={24}
                    color={colors.text.primary}
                    style={styles.menuIcon}
                  />
                  <Text style={[styles.menuText, { color: colors.text.primary }]}>
                    {level.title}
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={colors.text.secondary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    height: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  menuContainer: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 16,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
}); 