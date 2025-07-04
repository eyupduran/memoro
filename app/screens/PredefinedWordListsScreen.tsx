import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/database';
import { fetchAndStoreCategorizedWordLists } from '../data/wordLists';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { MaterialIcons } from '@expo/vector-icons';
import { colors as appColors } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Ekran propsları
type Props = NativeStackScreenProps<RootStackParamList, 'PredefinedWordLists'>;

const PredefinedWordListsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [selected, setSelected] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [wordData, setWordData] = useState<any>(null);
  const isFromOnboarding = route.params?.fromOnboarding;

  useEffect(() => {
    setFetching(true);
    setWordData(null);
    const fetchData = async () => {
      try {
        const cachedData = await dbService.getDbInfo(`categorizedWordLists_${currentLanguagePair}`);
        if (cachedData) {
          setWordData(JSON.parse(cachedData));
        } else {
          const data = await fetchAndStoreCategorizedWordLists(currentLanguagePair);
          if (data) {
            setWordData(data);
          } else {
            Alert.alert(translations.alerts.error, 'Kelime listesi alınamadı.');
          }
        }
      } catch (e) {
        Alert.alert(translations.alerts.error, 'Kelime listesi alınamadı.');
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [currentLanguagePair]);

  const toggleSelect = (level: string, category: string) => {
    const key = `${level}-${category}`;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllInLevel = (level: string) => {
    if (!wordData) return;
    const cats = wordData[level];
    const updates: { [key: string]: boolean } = {};
    cats.forEach((cat: any) => {
      updates[`${level}-${cat.name}`] = true;
    });
    setSelected((prev) => ({ ...prev, ...updates }));
  };

  const selectAll = () => {
    if (!wordData) return;
    let updates: { [key: string]: boolean } = {};
    Object.entries(wordData).forEach(([level, cats]: [string, any]) => {
      cats.forEach((cat: any) => {
        updates[`${level}-${cat.name}`] = true;
      });
    });
    setSelected((prev) => ({ ...prev, ...updates }));
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      if (!wordData) return;
      const selectedKeys = Object.keys(selected).filter((k) => selected[k]);
      if (selectedKeys.length === 0) {
        Alert.alert(translations.alerts.error, 'Lütfen en az bir kelime listesi seçin.');
        setLoading(false);
        return;
      }

      // Seçilen kategorileri level'a göre sırala (A1, A2, B1, B2, C1, C2 sırası)
      const levelOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      const sortedKeys = selectedKeys.sort((a, b) => {
        const [levelA] = a.split('-');
        const [levelB] = b.split('-');
        return levelOrder.indexOf(levelA) - levelOrder.indexOf(levelB);
      });

      for (const key of sortedKeys) {
        const [level, category] = key.split('-');
        const levelData = wordData[level];
        const catObj = levelData.find((c: any) => c.name === category);
        if (!catObj) continue;

        // Daha anlamlı isim oluştur (timestamp olmadan)
        const listName = `${level} - ${category}`;
        
        try {
          // Önce aynı isimde liste var mı kontrol et
          const existingLists = await dbService.getWordLists(currentLanguagePair);
          const existingList = existingLists.find(list => list.name === listName);
          
          let listId;
          if (existingList) {
            // Eğer liste zaten varsa, mevcut listeyi kullan
            listId = existingList.id;
            console.log(`Liste zaten mevcut: ${listName}`);
          } else {
            // Liste yoksa yeni oluştur
            listId = await dbService.createWordList(listName, currentLanguagePair);
          }
          
          if (listId) {
            // Kelimeleri ekle (duplicateları otomatik olarak önlenir)
            for (const word of catObj.words) {
              try {
                await dbService.addWordToList(listId, {
                  id: word.word,
                  word: word.word,
                  meaning: word.meaning,
                  example: word.example,
                  level,
                });
              } catch (wordError) {
                // Kelime zaten listedeyse hata verebilir, bu normaldir
                console.log(`Kelime zaten listede: ${word.word}`);
              }
            }
          }
        } catch (error) {
          console.error('Error creating/updating word list:', error);
          continue;
        }
      }

      setSelected({});
      
      // Onboarding'den geldiysek direkt yönlendir, değilse başarılı mesajı göster
      if (isFromOnboarding) {
        navigation.replace('LevelSelection');
      } else {
        Alert.alert(
          translations.alerts.success, 
          'Seçilen kelime listeleri eklendi! Mevcut listeler güncellendi.',
          [
            {
              text: translations.alerts.okay,
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (e) {
      Alert.alert(translations.alerts.error, 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    selectAll();
  };

  const handleSelectLevel = (level: string) => {
    selectAllInLevel(level);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleSkip = async () => {
    navigation.replace('LevelSelection');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView 
        contentContainerStyle={{ paddingBottom: 80 }} 
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[]}
      >
        <View style={[styles.card, { backgroundColor: colors.card?.background || colors.surface }]}> 
          <MaterialIcons name="library-books" size={32} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 4 }} />
          <Text style={[styles.title, { color: colors.text.primary }]}>
            {translations.settings?.predefinedWordListsTitle}
          </Text>
          <Text style={[styles.description, { color: colors.text.secondary }]}>
            {translations.settings?.predefinedWordListsDescription}
          </Text>
        </View>

        {fetching ? (
          <View style={{ alignItems: 'center', marginVertical: 20 }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.text.secondary }}>
              {translations.dataLoader.loading}
            </Text>
          </View>
        ) : wordData ? (
          <>
            <View style={styles.topActions}>
              <TouchableOpacity 
                style={[styles.allButton, { backgroundColor: colors.primary }]} 
                onPress={handleSelectAll} 
                disabled={loading}
              >
                <MaterialIcons name="done-all" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.allButtonText}>
                  {translations.settings?.selectWordsLists}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.selectedCount, { color: colors.text.secondary }]}>
                {selectedCount > 0 ? `${selectedCount} kategori seçili` : ''}
              </Text>
            </View>
            {Object.entries(wordData).map(([level, cats]: [string, any]) => (
              <View key={level} style={[styles.levelBlock, { backgroundColor: colors.card?.background || colors.surface, borderColor: colors.border }]}> 
                <View style={styles.levelHeader}>
                  <Text style={[styles.levelTitle, { color: colors.primary }]}>{level}</Text>
                  <TouchableOpacity 
                    style={[styles.levelAllButton, { backgroundColor: colors.primary }]} 
                    onPress={() => handleSelectLevel(level)} 
                    disabled={loading}
                  >
                    <MaterialIcons name="done" size={16} color="#fff" style={{ marginRight: 2 }} />
                    <Text style={styles.levelAllButtonText}>{level}'i Seç</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.categoriesColumn}>
                  {cats.map((cat: any) => {
                    const key = `${level}-${cat.name}`;
                    const isSelected = !!selected[key];
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.categoryCard,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.card?.background || colors.surface,
                            borderColor: isSelected ? colors.primary : colors.border
                          }
                        ]}
                        onPress={() => toggleSelect(level, cat.name)}
                        activeOpacity={0.85}
                      >
                        <View style={[
                          styles.checkbox, 
                          { 
                            backgroundColor: colors.card?.background || colors.surface,
                            borderColor: isSelected ? colors.primary : colors.border 
                          }
                        ]}>
                          {isSelected && <MaterialIcons name="check" size={16} color={colors.primary} />}
                        </View>
                        <Text style={[
                          styles.categoryText, 
                          { 
                            color: isSelected ? '#fff' : colors.text.primary,
                            fontWeight: isSelected ? '600' : '500'
                          }
                        ]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
      
      {/* Bottom fixed container */}
      <View style={[styles.bottomContainer, { backgroundColor: colors.card?.background || colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.buttonGroup}>
          {isFromOnboarding && (
            <TouchableOpacity
              style={[styles.skipButton, { backgroundColor: colors.card?.background || colors.surface, borderColor: colors.border }]}
              onPress={handleSkip}
            >
              <Text style={[styles.skipButtonText, { color: colors.text.primary }]}>
                {translations.onboarding.skip}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.downloadButton,
              { backgroundColor: colors.primary },
              loading && { opacity: 0.7 },
              isFromOnboarding && { flex: 2 }
            ]}
            onPress={handleDownload}
            disabled={loading || selectedCount === 0}
          >
            {loading ? (
              <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
            ) : (
              <MaterialIcons name="file-download" size={24} color="#fff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.downloadButtonText}>
              {loading ? translations.dataLoader.loading : translations.settings?.addSelected}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    marginBottom: 0,
    textAlign: 'center',
    lineHeight: 20,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  allButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  allButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  selectedCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  levelBlock: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  levelTitle: {
    fontWeight: 'bold',
    fontSize: 17,
    letterSpacing: 1,
  },
  levelAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  levelAllButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  categoriesColumn: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: {
    fontSize: 15,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default PredefinedWordListsScreen; 