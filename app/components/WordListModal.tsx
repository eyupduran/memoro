import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  TextInput,
  ActivityIndicator,
  Animated,
  Keyboard,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../contexts/AlertContext';
import { dbService } from '../services/database';
import type { Word } from '../types/words';

interface WordListModalProps {
  visible: boolean;
  onClose: () => void;
  // Tek kelime veya çoklu kelime desteği — `words` verilirse tüm liste eklenir,
  // aksi halde `word` (eski API) kullanılır. İkisi de boşsa ekleme yapılmaz.
  word?: Word;
  words?: Word[];
}

export const WordListModal: React.FC<WordListModalProps> = ({ visible, onClose, word, words }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const { showAlert } = useAlert();
  const [lists, setLists] = useState<{ id: number; name: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      loadLists();
      setShowCreateInput(false);
      setNewListName('');
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(SCREEN_HEIGHT);
    }
  }, [visible]);

  useEffect(() => {
    if (showCreateInput) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showCreateInput]);

  const handleClose = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  };

  const loadLists = async () => {
    setLoading(true);
    const wordLists = await dbService.getWordLists(currentLanguagePair);
    setLists(wordLists);
    setLoading(false);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      showAlert({
        title: translations.wordListModal?.error || 'Hata',
        message: translations.wordListModal?.emptyListName || 'Liste adı boş olamaz',
        variant: 'error',
      });
      return;
    }

    setCreatingList(true);
    const listId = await dbService.createWordList(newListName.trim(), currentLanguagePair);
    setCreatingList(false);

    if (listId !== null) {
      setNewListName('');
      setShowCreateInput(false);
      loadLists();
    } else {
      showAlert({
        title: translations.wordListModal?.error,
        message: translations.wordListModal?.createError,
        variant: 'error',
      });
    }
  };

  const handleAddToList = async (listId: number) => {
    // Eklenecek kelime listesini belirle — çoklu mod öncelikli.
    const wordsToAdd: Word[] = words && words.length > 0 ? words : word ? [word] : [];
    if (wordsToAdd.length === 0) {
      return;
    }

    setLoading(true);
    let anyFailed = false;
    for (const w of wordsToAdd) {
      // Her Word kendi variantKey'ini taşır (detay ekranından gelenlerde non-empty).
      // Boşsa eski davranışla aynı: aynı kelime listede varsa üzerine yazılır.
      const ok = await dbService.addWordToList(listId, w, w.variantKey || '');
      if (!ok) {
        anyFailed = true;
      }
    }
    setLoading(false);

    if (!anyFailed) {
      showAlert({
        title: translations.wordListModal?.success,
        message: translations.wordListModal?.addSuccess,
        variant: 'success',
      });
      // Animasyonlu kapanış (handleClose) yerine doğrudan onClose — alert zaten
      // başarı geri bildirimi veriyor, ek bir kapanış animasyonu çift-kapanış hissi
      // yaratıyordu.
      onClose();
    } else {
      showAlert({
        title: translations.wordListModal?.error,
        message: translations.wordListModal?.addError,
        variant: 'error',
      });
    }
  };

  const renderItem = ({ item }: { item: { id: number; name: string; created_at: string } }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => handleAddToList(item.id)}
    >
      <View style={[styles.listItemIcon, { backgroundColor: colors.primary + '15' }]}>
        <MaterialIcons name="folder-open" size={20} color={colors.primary} />
      </View>
      <View style={styles.listItemContent}>
        <Text style={[styles.listName, { color: colors.text.primary }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.listDate, { color: colors.text.light }]}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      <MaterialIcons name="add-circle-outline" size={22} color={colors.primary} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              {translations.wordListModal?.title || 'Kelime Listesi Seç'}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceVariant }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Yeni liste oluştur */}
          {showCreateInput ? (
            <View style={[styles.createCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.createInputRow}>
                <TextInput
                  ref={inputRef}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.primary + '40',
                      color: colors.text.primary,
                    },
                  ]}
                  placeholder={translations.wordListModal?.newListPlaceholder || 'Yeni liste adı'}
                  placeholderTextColor={colors.text.light}
                  value={newListName}
                  onChangeText={setNewListName}
                  onSubmitEditing={handleCreateList}
                  returnKeyType="done"
                  maxLength={50}
                />
              </View>
              <View style={styles.createActions}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: colors.border }]}
                  onPress={() => {
                    setShowCreateInput(false);
                    setNewListName('');
                    Keyboard.dismiss();
                  }}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.text.secondary }]}>
                    {translations.wordListModal?.deleteListCancel || 'İptal'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createButton, { backgroundColor: colors.primary }]}
                  onPress={handleCreateList}
                  disabled={creatingList}
                >
                  {creatingList ? (
                    <ActivityIndicator color={colors.text.onPrimary} size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="check" size={18} color={colors.text.onPrimary} />
                      <Text style={[styles.createButtonText, { color: colors.text.onPrimary }]}>
                        {translations.wordListModal?.create || 'Oluştur'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.newListButton, { borderColor: colors.primary + '30', backgroundColor: colors.primary + '08' }]}
              onPress={() => setShowCreateInput(true)}
            >
              <View style={[styles.newListIconCircle, { backgroundColor: colors.primary + '20' }]}>
                <MaterialIcons name="add" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.newListButtonText, { color: colors.primary }]}>
                {translations.wordListModal?.createNewList || 'Yeni Liste Oluştur'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Ayırıcı */}
          {lists.length > 0 && (
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.text.light }]}>
                {translations.wordListModal?.existingLists || 'Listelerim'}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
          )}

          {/* Liste */}
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={lists}
              renderItem={renderItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceVariant }]}>
                    <MaterialIcons name="playlist-add" size={36} color={colors.text.light} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text.secondary }]}>
                    {translations.wordListModal?.noLists || 'Henüz liste oluşturulmamış'}
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.text.light }]}>
                    {translations.wordListModal?.noListsHint || 'Yukarıdan yeni bir liste oluşturun'}
                  </Text>
                </View>
              )}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: 16,
    gap: 12,
  },
  newListIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newListButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  createCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  createInputRow: {
    marginBottom: 12,
  },
  input: {
    height: 46,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  createActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContainer: {
    flexGrow: 1,
    paddingBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  listItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemContent: {
    flex: 1,
  },
  listName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  listDate: {
    fontSize: 12,
  },
  loader: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
  },
}); 