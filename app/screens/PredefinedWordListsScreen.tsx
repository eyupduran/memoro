import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/database';
import { fetchAndStoreCategorizedWordLists } from '../data/wordLists';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

// Ekran propsları
type Props = NativeStackScreenProps<RootStackParamList, 'PredefinedWordLists'>;

const PredefinedWordListsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const [selected, setSelected] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [wordData, setWordData] = useState<any>(null);

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
      for (const key of selectedKeys) {
        const [level, category] = key.split('-');
        const levelData = wordData[level];
        const catObj = levelData.find((c: any) => c.name === category);
        if (!catObj) continue;
        const listName = `${level.toLowerCase()}-${category}`;
        const listId = await dbService.createWordList(listName, currentLanguagePair);
        if (listId) {
          for (const word of catObj.words) {
            await dbService.addWordToList(listId, {
              id: word.word,
              word: word.word,
              meaning: word.meaning,
              example: word.example,
              level,
            });
          }
        }
      }
      Alert.alert(translations.alerts.success, 'Seçilen kelime listeleri eklendi!');
      setSelected({});
      navigation.goBack();
    } catch (e) {
      Alert.alert(translations.alerts.error, 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAll = async () => {
    selectAll();
    setTimeout(() => handleDownload(), 100);
  };

  const handleDownloadLevel = (level: string) => {
    selectAllInLevel(level);
    setTimeout(() => handleDownload(), 100);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.title, { color: colors.text.primary }]}>{translations.settings?.predefinedWordListsTitle || 'Hazır Kelime Listeleri'}</Text>
      <Text style={[styles.description, { color: colors.text.secondary }]}>
        {translations.settings?.predefinedWordListsDescription || 'Burada uygulamada hazır bulunan kelime listelerini kendi özel listelerinize ekleyebilirsiniz. Seviye ve kategoriye göre seçim yapabilir veya tüm listeleri indirebilirsiniz.'}
      </Text>
      {fetching ? (
        <View style={{ alignItems: 'center', marginVertical: 20 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.text.secondary }}>Kelime listeleri yükleniyor...</Text>
        </View>
      ) : wordData ? (
        <>
          <TouchableOpacity style={styles.allButton} onPress={handleDownloadAll} disabled={loading}>
            <Text style={styles.allButtonText}>{translations.settings?.downloadAll || 'Tümünü Ekle'}</Text>
          </TouchableOpacity>
          <ScrollView>
            {Object.entries(wordData).map(([level, cats]: [string, any]) => (
              <View key={level} style={styles.levelBlock}>
                <View style={styles.levelHeader}>
                  <Text style={[styles.levelTitle, { color: colors.text.primary }]}>{level}</Text>
                  <TouchableOpacity style={styles.levelAllButton} onPress={() => handleDownloadLevel(level)} disabled={loading}>
                    <Text style={styles.levelAllButtonText}>{level} {translations.settings?.downloadAll || 'Tümünü Ekle'}</Text>
                  </TouchableOpacity>
                </View>
                {cats.map((cat: any) => {
                  const key = `${level}-${cat.name}`;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={styles.checkboxRow}
                      onPress={() => toggleSelect(level, cat.name)}
                    >
                      <View style={[styles.checkbox, selected[key] && styles.checkboxSelected, { borderColor: colors.primary }]} />
                      <Text style={[styles.categoryText, { color: colors.text.primary }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.downloadButton, { backgroundColor: colors.primary }]} onPress={handleDownload} disabled={loading || fetching}>
          <Text style={styles.downloadButtonText}>{loading ? 'Ekleniyor...' : (translations.settings?.addSelected || 'Seçilenleri Ekle')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    marginBottom: 16,
    textAlign: 'center',
  },
  allButton: {
    alignSelf: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ff9800',
  },
  allButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  levelBlock: {
    marginBottom: 12,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  levelTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  levelAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#2196f3',
  },
  levelAllButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#4caf50',
    borderColor: '#388e3c',
  },
  categoryText: {
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  downloadButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  downloadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default PredefinedWordListsScreen; 