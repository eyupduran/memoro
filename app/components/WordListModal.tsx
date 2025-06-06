import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/database';
import type { Word } from '../types/words';

interface WordListModalProps {
  visible: boolean;
  onClose: () => void;
  word: Word;
}

export const WordListModal: React.FC<WordListModalProps> = ({ visible, onClose, word }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [lists, setLists] = useState<{ id: number; name: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  useEffect(() => {
    if (visible) {
      loadLists();
    }
  }, [visible]);

  const loadLists = async () => {
    setLoading(true);
    const wordLists = await dbService.getWordLists(currentLanguagePair);
    setLists(wordLists);
    setLoading(false);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      Alert.alert(
        translations.wordListModal?.error || 'Hata',
        translations.wordListModal?.emptyListName || 'Liste adı boş olamaz'
      );
      return;
    }

    setCreatingList(true);
    const listId = await dbService.createWordList(newListName.trim(), currentLanguagePair);
    setCreatingList(false);

    if (listId !== null) {
      setNewListName('');
      loadLists();
    } else {
      Alert.alert(
        translations.wordListModal?.error || 'Hata',
        translations.wordListModal?.createError || 'Liste oluşturulurken bir hata oluştu'
      );
    }
  };

  const handleAddToList = async (listId: number) => {
    setLoading(true);
    const success = await dbService.addWordToList(listId, word);
    setLoading(false);

    if (success) {
      Alert.alert(
        translations.wordListModal?.success || 'Başarılı',
        translations.wordListModal?.addSuccess || 'Kelime listeye eklendi'
      );
      onClose();
    } else {
      Alert.alert(
        translations.wordListModal?.error || 'Hata',
        translations.wordListModal?.addError || 'Kelime eklenirken bir hata oluştu'
      );
    }
  };

  const renderItem = ({ item }: { item: { id: number; name: string; created_at: string } }) => (
    <TouchableOpacity
      style={[styles.listItem, { backgroundColor: colors.surface }]}
      onPress={() => handleAddToList(item.id)}
    >
      <Text style={[styles.listName, { color: colors.text.primary }]}>{item.name}</Text>
      <Text style={[styles.listDate, { color: colors.text.secondary }]}>
        {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {translations.wordListModal?.title || 'Kelime Listesi Seç'}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.closeButton, { color: colors.text.primary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.createListContainer}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text.primary,
              },
            ]}
            placeholder={translations.wordListModal?.newListPlaceholder || 'Yeni liste adı'}
            placeholderTextColor={colors.text.secondary}
            value={newListName}
            onChangeText={setNewListName}
          />
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={handleCreateList}
            disabled={creatingList}
          >
            {creatingList ? (
              <ActivityIndicator color={colors.text.onPrimary} size="small" />
            ) : (
              <Text style={[styles.createButtonText, { color: colors.text.onPrimary }]}>
                {translations.wordListModal?.create || 'Oluştur'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={lists}
            renderItem={renderItem}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={() => (
              <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
                {translations.wordListModal?.noLists || 'Henüz liste oluşturulmamış'}
              </Text>
            )}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 24,
    padding: 8,
  },
  createListContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  createButton: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    fontWeight: '600',
  },
  listContainer: {
    flexGrow: 1,
  },
  listItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  listName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  listDate: {
    fontSize: 12,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 16,
  },
}); 