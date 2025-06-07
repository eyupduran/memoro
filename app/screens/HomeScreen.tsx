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

  const menuItems = [
    {
      id: 'dictionary',
      title: translations.home.dictionary,
      icon: 'book',
      screen: 'Dictionary',
    },
    {
      id: 'grammar',
      title: translations.home.grammar,
      icon: 'school',
      screen: 'Grammar',
    },
    {
      id: 'exercise',
      title: translations.home.exercise,
      icon: 'fitness-center',
      screen: 'Exercise',
    },
    {
      id: 'wordLists',
      title: translations.home.wordLists,
      icon: 'format-list-bulleted',
      screen: 'WordLists',
    },
    {
      id: 'settings',
      title: translations.home.settings,
      icon: 'settings',
      screen: 'Settings',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{translations.home.title}</Text>
        <Text style={styles.subtitle}>{translations.home.subtitle}</Text>
      </View>
      
      <View style={styles.menu}>
        {menuItems.map((item) => (
          <TouchableOpacity 
            key={item.id}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            <MaterialIcons name={item.icon} size={40} color="#4A90E2" />
            <Text style={styles.menuText}>{item.title}</Text>
          </TouchableOpacity>
        ))}
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