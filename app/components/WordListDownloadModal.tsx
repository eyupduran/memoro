import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { dbService } from '../services/database';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchAndStoreCategorizedWordLists } from '../data/wordLists';

interface WordListDownloadModalProps {
  visible: boolean;
  onClose: () => void;
}

const WordListDownloadModal: React.FC<WordListDownloadModalProps> = ({ visible, onClose }) => {
  const { currentLanguagePair } = useLanguage();
  const [selected, setSelected] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [wordData, setWordData] = useState<any>(null);

  // Modal açıldığında API'den veya veritabanından verileri çek
  useEffect(() => {
    if (!visible) return;
    setFetching(true);
    setWordData(null);
    const fetchData = async () => {
      try {
        // Önce veritabanından çekmeyi dene
        const cachedData = await dbService.getDbInfo(`categorizedWordLists_${currentLanguagePair}`);
        if (cachedData) {
          setWordData(JSON.parse(cachedData));
          console.log("Kategorili kelime listeleri veritabanından yüklendi.");
        } else {
          // Veritabanında yoksa, API'den çek ve kaydet
          const data = await fetchAndStoreCategorizedWordLists(currentLanguagePair);
          if (data) {
            setWordData(data);
            console.log("Kategorili kelime listeleri API'den çekilip veritabanına kaydedildi.");
          } else {
            Alert.alert('Hata', 'Kelime listesi alınamadı.');
          }
        }
      } catch (e) {
        Alert.alert('Hata', 'Kelime listesi alınamadı.');
        console.error("Error fetching categorized word lists:", e);
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, [visible, currentLanguagePair]);

  // Seçim toggle
  const toggleSelect = (level: string, category: string) => {
    const key = `${level}-${category}`;
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Tümünü seç fonksiyonu
  const selectAllInLevel = (level: string) => {
    if (!wordData) return;
    const cats = wordData[level];
    const updates: { [key: string]: boolean } = {};
    cats.forEach((cat: any) => {
      updates[`${level}-${cat.name}`] = true;
    });
    setSelected((prev) => ({ ...prev, ...updates }));
  };

  // Tümünü seç (tüm seviyeler)
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

  // İndir ve ekle
  const handleDownload = async () => {
    setLoading(true);
    try {
      if (!wordData) return;
      const selectedKeys = Object.keys(selected).filter((k) => selected[k]);
      if (selectedKeys.length === 0) {
        Alert.alert('Uyarı', 'Lütfen en az bir kelime listesi seçin.');
        setLoading(false);
        return;
      }
      for (const key of selectedKeys) {
        const [level, category] = key.split('-');
        const levelData = wordData[level];
        const catObj = levelData.find((c: any) => c.name === category);
        if (!catObj) continue;
        const listName = `${level.toLowerCase()}-${category}`;
        // Listeyi oluştur
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
      Alert.alert('Başarılı', 'Seçilen kelime listeleri eklendi!');
      setSelected({});
      onClose();
    } catch (e) {
      Alert.alert('Hata', 'Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Tümünü indir (tüm seviyeler)
  const handleDownloadAll = async () => {
    selectAll();
    setTimeout(() => handleDownload(), 100);
  };

  // Seviye için tümünü indir
  const handleDownloadLevel = (level: string) => {
    selectAllInLevel(level);
    setTimeout(() => handleDownload(), 100);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.title}>Kelime Listesi İndir</Text>
          {fetching && (
            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              <ActivityIndicator size="large" color="#2196f3" />
              <Text>Kelime listeleri yükleniyor...</Text>
            </View>
          )}
          {!fetching && wordData && (
            <>
              <TouchableOpacity style={styles.allButton} onPress={handleDownloadAll} disabled={loading}>
                <Text style={styles.allButtonText}>Tümünü İndir</Text>
              </TouchableOpacity>
              <ScrollView>
                {Object.entries(wordData).map(([level, cats]: [string, any]) => (
                  <View key={level} style={styles.levelBlock}>
                    <View style={styles.levelHeader}>
                      <Text style={styles.levelTitle}>{level}</Text>
                      <TouchableOpacity style={styles.levelAllButton} onPress={() => handleDownloadLevel(level)} disabled={loading}>
                        <Text style={styles.levelAllButtonText}>{level} Tümünü İndir</Text>
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
                          <View style={[styles.checkbox, selected[key] && styles.checkboxSelected]} />
                          <Text style={styles.categoryText}>{cat.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </>
          )}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelButtonText}>Kapat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload} disabled={loading || fetching}>
              <Text style={styles.downloadButtonText}>{loading ? 'Ekleniyor...' : 'İndir & Ekle'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
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
    borderWidth: 1,
    borderColor: '#888',
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
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#eee',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  downloadButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#4caf50',
  },
  downloadButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default WordListDownloadModal; 