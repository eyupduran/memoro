import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { dbService } from '../services/database';
import type { Word } from '../types/words';
import { MaterialIcons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'WordListDetail'>;

export const WordListDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { translations } = useLanguage();
  const { listId, listName } = route.params;
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWords();
    navigation.setOptions({
      title: listName,
    });
  }, [listId, listName]);

  const loadWords = async () => {
    try {
      setLoading(true);
      const listWords = await dbService.getWordsFromList(Number(listId));
      setWords(listWords);
    } catch (error) {
      console.error('Error loading word list items:', error);
      setWords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveWord = async (word: string) => {
    try {
      await dbService.removeWordFromList(Number(listId), word);
      // Refresh the list
      loadWords();
    } catch (error) {
      console.error('Error removing word from list:', error);
    }
  };

  const renderWordItem = ({ item }: { item: Word }) => (
    <View
      style={[
        styles.wordCard,
        { 
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.wordHeader}>
        <View style={styles.wordMainContent}>
          <Text style={[styles.wordText, { color: colors.text.primary }]}>
            {item.word}
          </Text>
          <Text style={[styles.meaningText, { color: colors.text.secondary }]}>
            {item.meaning}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleRemoveWord(item.word)}
          style={styles.removeButton}
        >
          <MaterialIcons 
            name="remove-circle-outline" 
            size={24} 
            color={colors.error || colors.text.secondary}
          />
        </TouchableOpacity>
      </View>
      {item.example && (
        <Text style={[styles.exampleText, { 
          color: colors.text.secondary,
          borderTopColor: colors.border,
        }]}>
          {item.example}
        </Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {words.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons 
            name="list-alt" 
            size={64} 
            color={colors.text.secondary}
            style={styles.emptyIcon}
          />
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            {translations.wordListModal?.noLists || 'Bu listede henüz kelime yok'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={words}
          renderItem={renderWordItem}
          keyExtractor={(item) => item.word}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 20,
  },
  wordCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  wordMainContent: {
    flex: 1,
    marginRight: 12,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  meaningText: {
    fontSize: 14,
  },
  exampleText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  removeButton: {
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
}); 