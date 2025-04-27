import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '../contexts/LanguageContext';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { translations } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.home.title}</Text>
        <Text style={styles.subtitle}>{translations.home.subtitle}</Text>
      </View>
      
      <View style={styles.menu}>
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => navigation.navigate('LevelSelection')}
        >
          <MaterialIcons name="school" size={40} color="#4A90E2" />
          <Text style={styles.menuText}>{translations.home.learnWords}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => navigation.navigate('Stats')}
        >
          <MaterialIcons name="trending-up" size={40} color="#4A90E2" />
          <Text style={styles.menuText}>{translations.home.statistics}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => navigation.navigate('Settings')}
        >
          <MaterialIcons name="settings" size={40} color="#4A90E2" />
          <Text style={styles.menuText}>{translations.home.settings}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  menu: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
  },
  menuText: {
    fontSize: 18,
    marginLeft: 15,
    color: '#333',
  },
}); 