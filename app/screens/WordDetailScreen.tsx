import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dbService } from '../services/database';
import { WordListModal } from '../components/WordListModal';
import { DetailedDataLoader } from '../components/DetailedDataLoader';
import type { RootStackParamList } from '../types/navigation';
import type { Word } from '../types/words';

type Props = NativeStackScreenProps<RootStackParamList, 'WordDetail'>;

// Uzak datadaki tek bir sözlük girdisi (DictionaryResponseEntry)
type DictEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: {
      definition?: string;
      synonyms?: string[];
      antonyms?: string[];
      example?: string;
    }[];
    synonyms?: string[];
    antonyms?: string[];
  }[];
};

// Kutucuk modeli — UI'da render edeceğimiz her kart bir DictionaryBox.
// `primaryExample` görünen örnek; `extraExamples` aynı tanımın ek örnekleri (şimdilik nadir).
type DictionaryBox = {
  id: string;
  partOfSpeech: string;
  definition: string;
  primaryExample: string;
  extraExamples: string[];
  synonyms: string[];
  antonyms: string[];
  // Bu kutu ilk sözlük girdisinden mi (ana anlam) yoksa diğer anlamlardan mı?
  isPrimaryMeaning: boolean;
};

export const WordDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { translations, currentLanguagePair } = useLanguage();
  const { word, meaning, level } = route.params;

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DictEntry[] | null>(null);
  // Detay veri seti bu dil çifti için DB'de mevcut mu? Bunu bilmek önemli çünkü
  // "veri hiç indirilmemiş" ile "veri var ama bu kelime setin dışında" çok farklı
  // iki durum — mesajları ve indir butonu da buna göre ayrılıyor.
  const [detailsLoaded, setDetailsLoaded] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showListModal, setShowListModal] = useState(false);
  const [showDetailedLoader, setShowDetailedLoader] = useState(false);

  // Navigator header title olarak kelimenin kendisini göster — "Kelime Detayı"
  // sabit başlığı yerine, böylece context her zaman ekranın tepesinde görünür.
  useEffect(() => {
    navigation.setOptions({ title: word });
  }, [navigation, word]);

  // Detayı SQLite'tan yükle. useCallback ile sarılı çünkü hem mount'ta hem de
  // kullanıcı ekran içinden veri indirdikten sonra yeniden çağırılabilmesi gerekiyor.
  const loadDetail = useCallback(async () => {
    setLoading(true);
    // Önce bu dil çifti için detay verisinin DB'de genel olarak yüklü olup olmadığını öğren.
    const loadedForPair = await dbService.isWordDetailsLoaded(currentLanguagePair);
    setDetailsLoaded(loadedForPair);

    const data = await dbService.getWordDetail(word, currentLanguagePair);
    if (Array.isArray(data)) {
      setEntries(data as DictEntry[]);
    } else {
      setEntries(null);
    }
    setLoading(false);
  }, [word, currentLanguagePair]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Header için phonetic: ilk non-empty değeri kullan.
  const phonetic = useMemo(() => {
    if (!entries) return '';
    for (const e of entries) {
      if (e.phonetic && e.phonetic.trim().length > 0) return e.phonetic;
      if (e.phonetics) {
        for (const p of e.phonetics) {
          if (p.text && p.text.trim().length > 0) return p.text;
        }
      }
    }
    return '';
  }, [entries]);

  // Tüm entries'ten kutucukları düzleştir.
  // İlk entry = "ana anlam(lar)" bloğu; sonraki entry'ler = "diğer anlamlar" bloğu.
  // Aynı definition + partOfSpeech tekrar ederse, farklı example varsa onu extraExamples'a ekliyoruz.
  const { primaryBoxes, otherBoxes } = useMemo(() => {
    const primary: DictionaryBox[] = [];
    const other: DictionaryBox[] = [];
    if (!entries || entries.length === 0) {
      return { primaryBoxes: primary, otherBoxes: other };
    }

    // Anahtar: `${partOfSpeech}::${definition}` — aynı tanım tekrarlanıyorsa
    // sadece example'ı farklıysa `extraExamples`'a ekliyoruz.
    const keyOf = (pos: string, def: string) => `${pos}::${def}`;

    entries.forEach((entry, entryIdx) => {
      const bucket = entryIdx === 0 ? primary : other;
      const meanings = entry.meanings || [];
      const existingIndexInBucket = new Map<string, number>();
      bucket.forEach((b, i) => existingIndexInBucket.set(keyOf(b.partOfSpeech, b.definition), i));

      meanings.forEach((m, mIdx) => {
        const partOfSpeech = (m.partOfSpeech || '').trim();
        const defs = m.definitions || [];
        defs.forEach((d, dIdx) => {
          const definitionText = (d.definition || '').trim();
          if (!definitionText) return;
          const example = (d.example || '').trim();
          const key = keyOf(partOfSpeech, definitionText);
          const existingIdx = existingIndexInBucket.get(key);

          if (existingIdx !== undefined) {
            const existing = bucket[existingIdx];
            if (example && example !== existing.primaryExample && !existing.extraExamples.includes(example)) {
              existing.extraExamples.push(example);
            }
            return;
          }

          const box: DictionaryBox = {
            id: `e${entryIdx}-m${mIdx}-d${dIdx}`,
            partOfSpeech: partOfSpeech || '—',
            definition: definitionText,
            primaryExample: example,
            extraExamples: [],
            synonyms: [...(d.synonyms || []), ...(m.synonyms || [])],
            antonyms: [...(d.antonyms || []), ...(m.antonyms || [])],
            isPrimaryMeaning: entryIdx === 0,
          };
          bucket.push(box);
          existingIndexInBucket.set(key, bucket.length - 1);
        });
      });
    });

    return { primaryBoxes: primary, otherBoxes: other };
  }, [entries]);

  const allBoxes = useMemo(
    () => [...primaryBoxes, ...otherBoxes],
    [primaryBoxes, otherBoxes]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Seçilen kutuları uygulamanın geri kalanının anladığı `Word` şekline dönüştür.
  //
  // - `meaning`: seçilen kutunun partOfSpeech + İngilizce tanımı. Kullanıcı listede
  //   hangi anlamı seçtiğini görmek istiyor. Örnek: "(noun) Direction." Detay sayfası
  //   header'ında route param'dan gelen ana Türkçe anlam zaten görünüyor; burada
  //   listede her satır için ayrıştırıcı bilgi gerekiyor.
  // - `example`: seçilen kutunun kendi örnek cümlesi (yoksa boş).
  // - `variantKey`: her kutu için benzersiz bir anahtar. Aynı kelimenin birden
  //   fazla varyantı (ör. noun "Direction" + verb "To aim") listeye eklenince
  //   custom_word_list_items tablosunda her varyant ayrı satır olarak saklanır.
  const buildWordsFromSelection = (): Word[] => {
    const selected = allBoxes.filter((b) => selectedIds.has(b.id));
    return selected.map((b) => {
      const posLabel = b.partOfSpeech && b.partOfSpeech !== '—' ? `(${b.partOfSpeech}) ` : '';
      return {
        id: `${word}-${b.id}`,
        word,
        meaning: `${posLabel}${b.definition}`,
        example: b.primaryExample || '',
        level: level || '',
        variantKey: b.id,
      };
    });
  };

  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, {
      language: currentLanguagePair.split('-')[0],
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const handleAddToList = () => {
    if (selectedIds.size === 0) {
      Alert.alert(translations.wordDetail.noSelectionError);
      return;
    }
    setShowListModal(true);
  };

  const renderBox = (box: DictionaryBox) => {
    const isSelected = selectedIds.has(box.id);
    return (
      <TouchableOpacity
        key={box.id}
        activeOpacity={0.8}
        onPress={() => toggleSelect(box.id)}
        style={[
          styles.box,
          {
            backgroundColor: colors.surface,
            borderColor: isSelected ? colors.primary : colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
      >
        <View style={styles.boxHeader}>
          <View style={[styles.posPill, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.posPillText, { color: colors.primary }]}>
              {box.partOfSpeech}
            </Text>
          </View>
          <MaterialIcons
            name={isSelected ? 'check-circle' : 'radio-button-unchecked'}
            size={22}
            color={isSelected ? colors.primary : colors.text.secondary}
          />
        </View>

        <Text style={[styles.definitionText, { color: colors.text.primary }]}>
          {box.definition}
        </Text>

        {box.primaryExample ? (
          <Text style={[styles.exampleText, { color: colors.text.secondary }]}>
            <Text style={styles.examplePrefix}>
              {translations.dictionaryScreen.examplePrefix}{' '}
            </Text>
            {box.primaryExample}
          </Text>
        ) : null}

        {box.extraExamples.length > 0 && (
          <View style={[styles.extraExamplesBox, { borderLeftColor: colors.primary }]}>
            <Text style={[styles.extraExamplesTitle, { color: colors.text.secondary }]}>
              {translations.wordDetail.otherExamples}
            </Text>
            {box.extraExamples.map((ex, i) => (
              <Text
                key={i}
                style={[styles.exampleText, { color: colors.text.secondary, marginTop: 4 }]}
              >
                {ex}
              </Text>
            ))}
          </View>
        )}

        {box.synonyms.length > 0 && (
          <Text
            style={[styles.synonymsText, { color: colors.text.secondary }]}
            numberOfLines={2}
          >
            ≈ {box.synonyms.slice(0, 6).join(', ')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text.secondary }]}>
          {translations.wordDetail.loading}
        </Text>
      </View>
    );
  }

  if (!entries || entries.length === 0 || allBoxes.length === 0) {
    // İki farklı no-data durumu:
    //   (a) Detay veri seti hiç indirilmemiş → kullanıcıya indir butonu göster
    //   (b) Veri seti yüklü ama bu kelime sözlük kaynağında yok → sadece bilgilendirme,
    //       indir butonu gösterme (baskıya basması anlamsız, aynı veri gelir)
    const showDownloadPrompt = !detailsLoaded;
    const messageKey = detailsLoaded
      ? translations.wordDetail.wordNotFound
      : translations.wordDetail.noData;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.wordTitle, { color: colors.text.primary }]}>{word}</Text>
          <Text style={[styles.meaningSubtitle, { color: colors.text.secondary }]}>{meaning}</Text>
        </View>
        <View style={styles.noDataContainer}>
          <MaterialIcons
            name={detailsLoaded ? 'search-off' : 'info-outline'}
            size={48}
            color={colors.text.secondary}
          />
          <Text style={[styles.noDataText, { color: colors.text.secondary }]}>
            {messageKey}
          </Text>
          {showDownloadPrompt && (
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowDetailedLoader(true)}
            >
              <MaterialIcons name="cloud-download" size={20} color={colors.text.onPrimary} />
              <Text style={[styles.downloadButtonText, { color: colors.text.onPrimary }]}>
                {translations.wordDetail.downloadNow}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {showDetailedLoader && (
          <DetailedDataLoader
            visible={showDetailedLoader}
            languagePair={currentLanguagePair}
            onComplete={() => {
              setShowDetailedLoader(false);
              // İndirme bittikten sonra detayı tekrar yüklemeyi dene —
              // bu kelime detay setinde varsa artık kutular görünecek.
              loadDetail();
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: selectedIds.size > 0 ? 160 : 32 },
        ]}
      >
        {/* Header: kelime + phonetic + speak (ortalanmış kart) */}
        <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.wordTitle, { color: colors.text.primary }]}>{word}</Text>
          <Text style={[styles.meaningSubtitle, { color: colors.text.secondary }]}>{meaning}</Text>
          <View style={styles.phoneticRow}>
            {phonetic ? (
              <Text style={[styles.phoneticText, { color: colors.text.secondary }]}>
                {phonetic}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[styles.speakButton, { backgroundColor: colors.primary + '15' }]}
              onPress={() => speak(word)}
            >
              <MaterialIcons name="volume-up" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Ana anlam bloğu */}
        {primaryBoxes.map(renderBox)}

        {/* Diğer anlamlar bloğu */}
        {otherBoxes.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
              {translations.wordDetail.otherMeanings}
            </Text>
            {otherBoxes.map(renderBox)}
          </>
        )}
      </ScrollView>

      {/* Floating action bar */}
      {selectedIds.size > 0 && (
        <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.selectedCountText, { color: colors.text.primary }]}>
            {translations.wordDetail.selectedCount.replace('{0}', String(selectedIds.size))}
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonFull, { backgroundColor: colors.primary + '15' }]}
            onPress={handleAddToList}
          >
            <MaterialIcons name="playlist-add" size={18} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>
              {translations.wordDetail.addToList}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <WordListModal
        visible={showListModal}
        onClose={() => {
          setShowListModal(false);
        }}
        words={buildWordsFromSelection()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  wordTitle: {
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  meaningSubtitle: {
    fontSize: 16,
    marginTop: 6,
    textAlign: 'center',
  },
  phoneticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 10,
  },
  phoneticText: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  speakButton: {
    padding: 8,
    borderRadius: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  box: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  boxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  posPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  posPillText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  definitionText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  examplePrefix: {
    fontWeight: '600',
    fontStyle: 'normal',
  },
  extraExamplesBox: {
    marginTop: 10,
    paddingLeft: 10,
    borderLeftWidth: 3,
  },
  extraExamplesTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  synonymsText: {
    marginTop: 8,
    fontSize: 13,
  },
  noDataContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  noDataText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    borderTopWidth: 1,
  },
  selectedCountText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonFull: {
    alignSelf: 'stretch',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
