import { storageService } from '../services/storage';
import { dbService } from '../services/database';
import type { Word, WordList, AsyncWordLists } from '../types/words';

const getLanguagePair = async () => {
  const nativeLanguage = await storageService.getItem('selectedLanguage') || 'tr';
  const learningLanguage = await storageService.getItem('learningLanguage') || 'en';
  return `${learningLanguage}-${nativeLanguage}`;
};

const getBaseUrl = async () => {
  const languagePair = await getLanguagePair();
  return `https://raw.githubusercontent.com/eyupduran/english-words-api/main/languages/${languagePair}`;
};

// Tüm kelime listelerini içeren dosyayı çeken fonksiyon
const fetchAllWordLists = async (): Promise<Record<string, Word[]>> => {
  try {
    const baseUrl = await getBaseUrl();
    console.log(`Fetching word lists from API: ${baseUrl}/all-words.json`);
    const response = await fetch(`${baseUrl}/all-words.json`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching all word lists:', error);
    return {};
  }
};

// Sadece SQLite'dan kelime listesini getiren fonksiyon
const fetchWordList = async (level: string): Promise<WordList> => {
  try {
    console.log(`Fetching word list for level: ${level}`);
    
    // SQLite'dan veriyi al
    const languagePair = await getLanguagePair();
    const words = await dbService.getWords(level, languagePair);
    
    console.log(`Retrieved ${words.length} words from SQLite for level ${level}`);
    
    // Son güncelleme tarihini al veya şimdiki zamanı kullan
    const lastUpdated = await dbService.getDbInfo(`lastUpdate_${languagePair}`) || new Date().toISOString();
    
    return { words, lastUpdated };
  } catch (error) {
    console.error(`Error fetching word list for ${level}:`, error);
    return { words: [], lastUpdated: new Date().toISOString() };
  }
};

// Verileri yüklemek için - bu sadece başlangıçta veya dil değiştiğinde çağrılmalı
// İlerleme takibi için callback ekledik
const loadWordsToDatabase = async (
  languagePair: string, 
  progressCallback?: (progress: number, levelName?: string) => void
): Promise<boolean> => {
  try {
    console.log(`Loading words to database for language pair: ${languagePair}`);
    
    // API'den verileri al
    progressCallback?.(10); // Başlangıç ilerleme bildirimi
    
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/all-words.json`);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    progressCallback?.(20); // Veri indirme tamamlandı bildirimi
    
    const allWordLists = await response.json();
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const totalLevels = levels.length;
    let totalWords = 0;
    
    // Toplam kelime sayısını hesapla
    levels.forEach(level => {
      const words = allWordLists[level] || [];
      totalWords += words.length;
    });
    
    console.log(`Toplam ${totalWords} kelime ${totalLevels} seviyede yüklenecek`);
    
    // Her seviye için SQLite'a kaydet
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const words = allWordLists[level] || [];
      
      if (words.length > 0) {
        const levelProgress = 20 + Math.floor((i / totalLevels) * 70); // 20% - 90% arası ilerleme
        progressCallback?.(levelProgress, level);
        
        await dbService.saveWords(words, level, languagePair);
        console.log(`${languagePair} için ${level} seviyesinde ${words.length} kelime kaydedildi`);
      }
    }
    
    // Kategorili kelime listesini çek ve kaydet
    await fetchAndStoreCategorizedWordLists(languagePair);

    progressCallback?.(100); // Tamamlandı bildirimi
    return true;
  } catch (error) {
    console.error('Error loading words to database:', error);
    return false;
  }
};

// Kelime listelerini getiren fonksiyon
export const getWordLists = async (): Promise<AsyncWordLists> => {
  return {
    A1: fetchWordList('A1'),
    A2: fetchWordList('A2'),
    B1: fetchWordList('B1'),
    B2: fetchWordList('B2'),
    C1: fetchWordList('C1'),
    C2: fetchWordList('C2'),
  };
};

// Sadece SQLite'a veri yüklemek için export ediyoruz
export const loadWordsForLanguagePair = loadWordsToDatabase;

// Zorunlu güncelleme durumları için - artık API'yi SQLite'a yükleyip sonra çekiyor
export const forceUpdateWordLists = {
  A1: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('A1');
  },
  A2: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('A2');
  },
  B1: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('B1');
  },
  B2: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('B2');
  },
  C1: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('C1');
  },
  C2: async () => {
    const languagePair = await getLanguagePair();
    await loadWordsToDatabase(languagePair);
    return fetchWordList('C2');
  },
};

// Detaylı kelime verisini (DictionaryResponse sözlük yapısı) API'den çekip SQLite'a kaydeden fonksiyon.
//
// Kaynak: https://github.com/eyupduran/english-words-api/blob/main/word-details.json
// Uzak dosya formatı: DictionaryResponseEntry[][]
//   — Dış dizi: her öğe bir kelimenin tüm sözlük girdilerini içerir
//   — İç dizi: aynı kelimenin farklı sözlük varyantları (farklı phonetic, meanings vb.)
//   — Her girdide `word` alanı bulunur; gruplama anahtarı olarak bunu kullanıyoruz
//
// Dosya repo kökünde olduğu için dil çiftinden bağımsız; aynı detay verisini
// kullanıcının şu anki dil çifti altına kaydediyoruz (Part 2'deki getWordDetail
// çağrı kontratını korumak için).
const DETAILED_WORDS_URL =
  'https://raw.githubusercontent.com/eyupduran/english-words-api/main/word-details/word-details.json';

export const loadDetailedWordsForLanguagePair = async (
  languagePair: string,
  progressCallback?: (progress: number) => void
): Promise<boolean> => {
  try {
    console.log(`Loading detailed word data for language pair: ${languagePair}`);
    progressCallback?.(10);

    const response = await fetch(DETAILED_WORDS_URL);

    if (!response.ok) {
      throw new Error(`Detailed words fetch failed: ${response.status} ${response.statusText}`);
    }

    progressCallback?.(40);
    const text = await response.text();
    let rawData;
    try {
      rawData = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse detailed words JSON');
    }

    if (!Array.isArray(rawData)) {
      console.log('Beklenmeyen detaylı kelime verisi formatı:', typeof rawData, 'isArray:', Array.isArray(rawData), 'value:', rawData);
      throw new Error('Detailed words response is not an array');
    }

    progressCallback?.(55);

    console.log('rawData type:', typeof rawData, 'isArray:', Array.isArray(rawData), 'length:', rawData?.length);

    // Dizi-dizi formatını kelime anahtarlı Record'a dönüştür.
    // Aynı kelime için birden fazla üst-seviye grup gelirse (olağan değil ama mümkün),
    // sonrakini öncekinin üzerine yazmak yerine birleştiriyoruz ki hiçbir sözlük girdisi kaybolmasın.
    const detailsByWord = new Map<string, any[]>();
    let skipped = 0;
    
    for (let i = 0; i < rawData.length; i++) {
      const group = rawData[i];
      if (!Array.isArray(group) || group.length === 0) {
        skipped++;
        continue;
      }
      const firstEntry = group[0];
      const word = firstEntry?.word;
      if (typeof word !== 'string' || word.length === 0) {
        skipped++;
        continue;
      }
      if (detailsByWord.has(word)) {
        const existing = detailsByWord.get(word)!;
        for (let j = 0; j < group.length; j++) {
          existing.push(group[j]);
        }
      } else {
        detailsByWord.set(word, group.slice());
      }
    }

    if (skipped > 0) {
      console.warn(`Detailed words: ${skipped} grup atlandı (geçersiz format veya eksik word alanı)`);
    }

    const wordCount = detailsByWord.size;
    if (wordCount === 0) {
      throw new Error('Detailed words response did not contain any usable entries');
    }

    console.log(`Detaylı kelime verisi: ${wordCount} benzersiz kelime hazırlandı`);
    progressCallback?.(70);

    const finalDetails = Object.fromEntries(detailsByWord.entries());
    const saved = await dbService.saveWordDetails(finalDetails, languagePair);
    if (!saved) {
      throw new Error('Failed to save detailed word data to SQLite');
    }

    await dbService.setDbInfo(
      `lastUpdate_details_${languagePair}`,
      new Date().toISOString()
    );

    progressCallback?.(100);
    return true;
  } catch (error) {
    console.error('Error loading detailed word data:', error);
    return false;
  }
};

// API'den kategorili kelime listesini çeken fonksiyon
const fetchCategorizedWordLists = async (languagePair: string): Promise<any | null> => {
  try {
    const url = `${await getBaseUrl()}/categorized_vocab_by_level.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Kelime listesi alınamadı');
    const data = await res.json();
    return data;
  } catch (e) {
    console.error('Kelime listesi alınamadı:', e);
    return null;
  }
};

// Kategorili kelime listesini API'den çekip veritabanına kaydeden fonksiyon
export const fetchAndStoreCategorizedWordLists = async (languagePair: string): Promise<any | null> => {
  try {
    const baseUrl = `https://raw.githubusercontent.com/eyupduran/english-words-api/main/languages/${languagePair}`;
    const categorizedResponse = await fetch(`${baseUrl}/categorized_vocab_by_level.json`);
    if (categorizedResponse.ok) {
      const categorizedData = await categorizedResponse.json();
      await dbService.setDbInfo(`categorizedWordLists_${languagePair}`, JSON.stringify(categorizedData));
      console.log(`${languagePair} için kategorili kelime listesi kaydedildi.`);
      return categorizedData;
    } else {
      console.warn(`Kategorili kelime listesi (${languagePair}) çekilemedi: ${categorizedResponse.statusText}`);
      return null;
    }
  } catch (catError) {
    console.error(`Kategorili kelime listesi (${languagePair}) çekilirken hata oluştu:`, catError);
    return null;
  }
}; 