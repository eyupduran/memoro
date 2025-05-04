import * as SQLite from 'expo-sqlite';
import type { Word, WordList, LearnedWord } from '../types/words';

class DatabaseService {
  private db!: SQLite.SQLiteDatabase;
  private initialized: boolean = false;
  private BATCH_SIZE = 500; // Toplu işlem için maksimum kelime sayısı

  constructor() {
    try {
      this.db = SQLite.openDatabaseSync('memoro.db');
      this.initDatabase();
    } catch (error) {
      console.error("Database initialization error:", error);
    }
  }

  private async initDatabase() {
    try {
      // İşlem hızını artırmak için pragma ayarları
      await this.db.execAsync(`
        PRAGMA synchronous = NORMAL;
        PRAGMA journal_mode = WAL;
        PRAGMA cache_size = 10000;
        PRAGMA temp_store = MEMORY;
      `);
      
      // Tabloları oluştur
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          meaning TEXT NOT NULL,
          example TEXT,
          level TEXT NOT NULL,
          language_pair TEXT NOT NULL,
          UNIQUE(word, level, language_pair)
        );

        CREATE TABLE IF NOT EXISTS learned_words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          meaning TEXT NOT NULL,
          example TEXT,
          level TEXT NOT NULL,
          learnedAt TEXT NOT NULL,
          UNIQUE(word)
        );

        CREATE TABLE IF NOT EXISTS db_info (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS background_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT NOT NULL,
          local_path TEXT,
          created_at TEXT NOT NULL,
          UNIQUE(url)
        );
      `);
      
      // İndeks oluştur
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_words_level_lang ON words(level, language_pair);
        CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
      `);
      
      this.initialized = true;
    } catch (error) {
      console.error("Database initialization error:", error);
    }
  }

  // Kelime datasını dil çiftine göre SQLite'a kaydet - toplu insert ile optimize edildi
  async saveWords(words: Word[], level: string, languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      // Boş kelime listesi durumunu kontrol et
      if (words.length === 0) {
        return true;
      }
      
      console.log(`Toplu kayıt başlatılıyor: ${words.length} kelime, seviye: ${level}, dil: ${languagePair}`);
      const startTime = Date.now();
      
      await this.db.withTransactionAsync(async () => {
        // Her BATCH_SIZE kelime için toplu sorgu oluştur ve çalıştır
        for (let i = 0; i < words.length; i += this.BATCH_SIZE) {
          const batch = words.slice(i, i + this.BATCH_SIZE);
          let placeholders = [];
          let values = [];
          
          // Tek bir toplu sorgu için değerleri hazırla
          for (const word of batch) {
            placeholders.push('(?, ?, ?, ?, ?)');
            values.push(
              word.word,
              word.meaning,
              word.example || '',
              level,
              languagePair
            );
          }
          
          // Toplu sorguyu çalıştır
          const query = `
            INSERT OR IGNORE INTO words (word, meaning, example, level, language_pair) 
            VALUES ${placeholders.join(',')}
          `;
          
          await this.db.runAsync(query, values);
        }
      });
      
      const endTime = Date.now();
      console.log(`Veri kaydı tamamlandı: ${words.length} kelime, ${endTime - startTime}ms`);
      
      return true;
    } catch (error) {
      console.error('Error saving words to SQLite:', error);
      return false;
    }
  }

  // Belirli bir seviye ve dil çifti için kelimeleri getir
  async getWords(level: string, languagePair: string): Promise<Word[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<Word>(
        'SELECT word, meaning, example, level FROM words WHERE level = ? AND language_pair = ?',
        [level, languagePair]
      );
      return result;
    } catch (error) {
      console.error('Error getting words from SQLite:', error);
      return [];
    }
  }

  // Belirli bir dil çifti için tüm seviyelerdeki kelimeleri getir - sayfalama destekli
  async getAllWords(languagePair: string, limit: number = 100, offset: number = 0): Promise<Word[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<Word>(
        'SELECT word, meaning, example, level FROM words WHERE language_pair = ? LIMIT ? OFFSET ?',
        [languagePair, limit, offset]
      );
      return result;
    } catch (error) {
      console.error('Error getting all words from SQLite:', error);
      return [];
    }
  }

  // Arama yapma - dil çiftine göre
  async searchWords(query: string, languagePair: string, limit: number = 100, offset: number = 0): Promise<Word[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<Word>(
        `SELECT word, meaning, example, level FROM words 
         WHERE language_pair = ? AND (word LIKE ? OR meaning LIKE ?) 
         LIMIT ? OFFSET ?`,
        [languagePair, `%${query}%`, `%${query}%`, limit, offset]
      );
      return result;
    } catch (error) {
      console.error('Error searching words in SQLite:', error);
      return [];
    }
  }

  // Belirli bir seviyeye göre arama yapma
  async searchWordsByLevel(level: string | null, languagePair: string, limit: number = 100, offset: number = 0): Promise<Word[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      let query: string;
      let params: any[];
      
      if (level) {
        query = `SELECT word, meaning, example, level FROM words 
                WHERE language_pair = ? AND level = ? 
                LIMIT ? OFFSET ?`;
        params = [languagePair, level, limit, offset];
      } else {
        query = `SELECT word, meaning, example, level FROM words 
                WHERE language_pair = ? 
                LIMIT ? OFFSET ?`;
        params = [languagePair, limit, offset];
      }
      
      const result = await this.db.getAllAsync<Word>(query, params);
      return result;
    } catch (error) {
      console.error('Error searching words by level in SQLite:', error);
      return [];
    }
  }

  // Arama yapma - kelime ve seviyeye göre
  async searchWordsByQueryAndLevel(query: string, level: string | null, languagePair: string, limit: number = 100, offset: number = 0): Promise<Word[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      let sqlQuery: string;
      let params: any[];
      
      if (level) {
        sqlQuery = `SELECT word, meaning, example, level FROM words 
                   WHERE language_pair = ? AND level = ? AND (word LIKE ? OR meaning LIKE ?) 
                   LIMIT ? OFFSET ?`;
        params = [languagePair, level, `%${query}%`, `%${query}%`, limit, offset];
      } else {
        sqlQuery = `SELECT word, meaning, example, level FROM words 
                   WHERE language_pair = ? AND (word LIKE ? OR meaning LIKE ?) 
                   LIMIT ? OFFSET ?`;
        params = [languagePair, `%${query}%`, `%${query}%`, limit, offset];
      }
      
      const result = await this.db.getAllAsync<Word>(sqlQuery, params);
      return result;
    } catch (error) {
      console.error('Error searching words by query and level in SQLite:', error);
      return [];
    }
  }

  // Öğrenilen kelimeleri SQLite'a kaydet
  async saveLearnedWords(words: LearnedWord[]): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      // Boş kelime listesi kontrolü
      if (words.length === 0) {
        return true;
      }
      
      await this.db.withTransactionAsync(async () => {
        // Her BATCH_SIZE kelime için toplu sorgu
        for (let i = 0; i < words.length; i += this.BATCH_SIZE) {
          const batch = words.slice(i, i + this.BATCH_SIZE);
          let placeholders = [];
          let values = [];
          
          for (const word of batch) {
            placeholders.push('(?, ?, ?, ?, ?)');
            values.push(
              word.word,
              word.meaning,
              word.example || '',
              word.level,
              word.learnedAt
            );
          }
          
          const query = `
            INSERT OR REPLACE INTO learned_words (word, meaning, example, level, learnedAt) 
            VALUES ${placeholders.join(',')}
          `;
          
          await this.db.runAsync(query, values);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error saving learned words to SQLite:', error);
      return false;
    }
  }

  // Öğrenilen kelimeleri getir
  async getLearnedWords(): Promise<LearnedWord[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<LearnedWord>(
        'SELECT word, meaning, example, level, learnedAt FROM learned_words'
      );
      return result;
    } catch (error) {
      console.error('Error getting learned words from SQLite:', error);
      return [];
    }
  }

  // Bir dil çifti için kelimelerin yüklenip yüklenmediğini kontrol et
  async isLanguageDataLoaded(languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getFirstAsync<{count: number}>(
        'SELECT COUNT(*) as count FROM words WHERE language_pair = ?',
        [languagePair]
      );
      return result?.count ? result.count > 0 : false;
    } catch (error) {
      console.error('Error checking language data:', error);
      return false;
    }
  }

  // Veritabanı bilgilerini kaydet (son güncelleme tarihi vb.)
  async setDbInfo(key: string, value: string): Promise<void> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      await this.db.runAsync(
        'INSERT OR REPLACE INTO db_info (key, value) VALUES (?, ?)',
        [key, value]
      );
    } catch (error) {
      console.error('Error setting db info:', error);
    }
  }

  // Veritabanı bilgisini getir
  async getDbInfo(key: string): Promise<string | null> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getFirstAsync<{value: string}>(
        'SELECT value FROM db_info WHERE key = ?',
        [key]
      );
      return result?.value || null;
    } catch (error) {
      console.error('Error getting db info:', error);
      return null;
    }
  }

  // Arkaplan resimlerini veritabanına kaydet
  async saveBackgroundImages(images: { url: string, localPath?: string }[]): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      if (images.length === 0) {
        return true;
      }
      
      const now = new Date().toISOString();
      
      await this.db.withTransactionAsync(async () => {
        for (let i = 0; i < images.length; i += this.BATCH_SIZE) {
          const batch = images.slice(i, i + this.BATCH_SIZE);
          let placeholders = [];
          let values = [];
          
          for (const image of batch) {
            placeholders.push('(?, ?, ?)');
            values.push(
              image.url,
              image.localPath || null,
              now
            );
          }
          
          const query = `
            INSERT OR REPLACE INTO background_images (url, local_path, created_at) 
            VALUES ${placeholders.join(',')}
          `;
          
          await this.db.runAsync(query, values);
        }
      });
      
      return true;
    } catch (error) {
      console.error('Arkaplan resimleri veritabanına kaydedilirken hata:', error);
      return false;
    }
  }

  // Arkaplan resim URL'lerini getir
  async getBackgroundImageUrls(): Promise<string[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<{url: string}>(
        'SELECT url FROM background_images'
      );
      
      return result.map(item => item.url);
    } catch (error) {
      console.error('Arkaplan resim URL\'leri alınırken hata:', error);
      return [];
    }
  }

  // Arkaplan resimlerini yerel yollarıyla birlikte getir
  async getBackgroundImages(): Promise<{url: string, localPath: string | null}[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<{url: string, local_path: string | null}>(
        'SELECT url, local_path FROM background_images'
      );
      
      return result.map(item => ({
        url: item.url,
        localPath: item.local_path
      }));
    } catch (error) {
      console.error('Arkaplan resimleri alınırken hata:', error);
      return [];
    }
  }

  // Arkaplan resimlerinin yerel yollarını güncelle
  async updateBackgroundImageLocalPath(url: string, localPath: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      await this.db.runAsync(
        'UPDATE background_images SET local_path = ? WHERE url = ?',
        [localPath, url]
      );
      
      return true;
    } catch (error) {
      console.error('Arkaplan resim yolu güncellenirken hata:', error);
      return false;
    }
  }

  // Arkaplan resim önbelleğini temizle (yerel yolları sil)
  async clearBackgroundImageCache(): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      await this.db.runAsync('UPDATE background_images SET local_path = NULL');
      return true;
    } catch (error) {
      console.error('Arkaplan resim önbelleği temizlenirken hata:', error);
      return false;
    }
  }

  // Arkaplan resimlerinin önbellekte olup olmadığını kontrol et
  async hasBackgroundImagesInDb(): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getFirstAsync<{count: number}>(
        'SELECT COUNT(*) as count FROM background_images'
      );
      
      return result?.count ? result.count > 0 : false;
    } catch (error) {
      console.error('Arkaplan resimlerinin varlığı kontrol edilirken hata:', error);
      return false;
    }
  }
}

export const dbService = new DatabaseService(); 