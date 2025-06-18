import * as SQLite from 'expo-sqlite';
import type { Word, WordList, LearnedWord } from '../types/words';
import type { UnfinishedExercise } from '../screens/ExerciseQuestionScreen';

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

  // Veritabanı nesnesine erişim için getter
  public getDatabase(): SQLite.SQLiteDatabase {
    return this.db;
  }

  // Veritabanı transaction işlemi için yardımcı metot
  public async withTransaction(callback: () => Promise<void>): Promise<void> {
    if (!this.initialized) await this.initDatabase();
    await this.db.withTransactionAsync(callback);
  }

  // Tek bir sonuç satırı getiren yardımcı metod
  async getFirstAsync<T>(query: string, params: any[] = []): Promise<T | null> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync(query, params);
      return result.length > 0 ? result[0] as unknown as T : null;
    } catch (error) {
      console.error('Error in getFirstAsync:', error);
      return null;
    }
  }
  
  // Tüm sonuçları getiren yardımcı metod
  async getAllAsync<T>(query: string, params: any[] = []): Promise<T[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync(query, params);
      return result as unknown as T[];
    } catch (error) {
      console.error('Error in getAllAsync:', error);
      return [];
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
          streak INTEGER DEFAULT 0,
          UNIQUE(word, level, language_pair)
        );

        CREATE TABLE IF NOT EXISTS learned_words (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          meaning TEXT NOT NULL,
          example TEXT,
          level TEXT NOT NULL,
          learnedAt TEXT NOT NULL,
          language_pair TEXT NOT NULL,
          UNIQUE(word, language_pair)
        );
        
        CREATE TABLE IF NOT EXISTS exercise_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exercise_type TEXT NOT NULL,
          score INTEGER NOT NULL,
          total_questions INTEGER NOT NULL,
          date TEXT NOT NULL,
          language_pair TEXT NOT NULL,
          word_source TEXT
        );

        CREATE TABLE IF NOT EXISTS exercise_details (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exercise_id INTEGER NOT NULL,
          details TEXT NOT NULL,
          language_pair TEXT NOT NULL,
          FOREIGN KEY (exercise_id) REFERENCES exercise_results (id) ON DELETE CASCADE
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

        CREATE TABLE IF NOT EXISTS custom_word_lists (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          language_pair TEXT NOT NULL,
          UNIQUE(name, language_pair)
        );

        CREATE TABLE IF NOT EXISTS custom_word_list_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          list_id INTEGER NOT NULL,
          word TEXT NOT NULL,
          meaning TEXT NOT NULL,
          example TEXT,
          level TEXT NOT NULL,
          added_at TEXT NOT NULL,
          FOREIGN KEY(list_id) REFERENCES custom_word_lists(id) ON DELETE CASCADE,
          UNIQUE(list_id, word)
        );

        CREATE TABLE IF NOT EXISTS unfinished_exercises (
          timestamp REAL PRIMARY KEY,
          language_pair TEXT NOT NULL,
          exercise_type TEXT NOT NULL,
          question_index INTEGER NOT NULL,
          total_questions INTEGER NOT NULL,
          score INTEGER NOT NULL,
          asked_words TEXT NOT NULL,
          question_details TEXT NOT NULL,
          word_source TEXT,
          level TEXT,
          word_list_id INTEGER,
          word_list_name TEXT,
          previous_type TEXT
        );
      `);

      // Mevcut learned_words tablosunu kontrol et ve güncelle
      const tableInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(learned_words)"
      );
      
      const hasLanguagePair = tableInfo.some(column => column.name === 'language_pair');
      
      if (!hasLanguagePair) {
        // Geçici tablo oluştur ve verileri kopyala
        await this.db.execAsync(`
          BEGIN TRANSACTION;
          
          CREATE TABLE learned_words_temp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            word TEXT NOT NULL,
            meaning TEXT NOT NULL,
            example TEXT,
            level TEXT NOT NULL,
            learnedAt TEXT NOT NULL,
            language_pair TEXT NOT NULL DEFAULT 'en-tr',
            UNIQUE(word, language_pair)
          );
          
          INSERT INTO learned_words_temp (word, meaning, example, level, learnedAt)
          SELECT word, meaning, example, level, learnedAt FROM learned_words;
          
          DROP TABLE learned_words;
          
          ALTER TABLE learned_words_temp RENAME TO learned_words;
          
          COMMIT;
        `);
      }
      
      // exercise_results tablosunu kontrol et ve güncelle
      const exerciseResultsInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(exercise_results)"
      );
      
      const hasLevel = exerciseResultsInfo.some(column => column.name === 'level');
      
      if (!hasLevel) {
        // Yeni sütunları ekle
        await this.db.execAsync(`
          ALTER TABLE exercise_results ADD COLUMN level TEXT;
          ALTER TABLE exercise_results ADD COLUMN word_list_id INTEGER;
          ALTER TABLE exercise_results ADD COLUMN word_list_name TEXT;
        `);
        
        console.log("exercise_results tablosu güncellendi, yeni sütunlar eklendi.");
      }
      
      // words tablosunu kontrol et ve streak sütununu ekle
      const wordsTableInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(words)"
      );
      
      const hasStreak = wordsTableInfo.some(column => column.name === 'streak');
      
      if (!hasStreak) {
        // streak sütununu ekle
        await this.db.execAsync(`
          ALTER TABLE words ADD COLUMN streak INTEGER DEFAULT 0;
        `);
        
        console.log("words tablosu güncellendi, streak sütunu eklendi.");
      }
      
      // İndeks oluştur
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_words_level_lang ON words(level, language_pair);
        CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
        CREATE INDEX IF NOT EXISTS idx_learned_words_lang ON learned_words(language_pair);
        CREATE INDEX IF NOT EXISTS idx_exercise_results_lang ON exercise_results(language_pair);
        CREATE INDEX IF NOT EXISTS idx_custom_word_lists_lang ON custom_word_lists(language_pair);
        CREATE INDEX IF NOT EXISTS idx_custom_word_list_items_list ON custom_word_list_items(list_id);
        CREATE INDEX IF NOT EXISTS idx_unfinished_exercises_lang ON unfinished_exercises(language_pair);
      `);
      
      this.initialized = true;
    } catch (error) {
      console.error("Database initialization error:", error);
    }
  }

  // Kelime datasını dil çiftine göre SQLite'a kaydet - toplu insert yerine tek tek insert ile optimize edildi
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
        'SELECT word, meaning, example, level, streak FROM words WHERE level = ? AND language_pair = ?',
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
      
      // Önce mevcut seviyeleri al
      const levels = await this.db.getAllAsync<{level: string}>(
        'SELECT DISTINCT level FROM words WHERE language_pair = ? ORDER BY level',
        [languagePair]
      );
      
      if (levels.length === 0) {
        return [];
      }
      
      // Her seviyeden dengeli şekilde kelime almak için
      const perLevelLimit = Math.ceil(limit / levels.length);
      let result: Word[] = [];
      
      // Her seviyeden kelime al
      for (const levelObj of levels) {
        const levelWords = await this.db.getAllAsync<Word>(
          `SELECT word, meaning, example, level, streak FROM words 
           WHERE language_pair = ? AND level = ? 
           ORDER BY RANDOM() 
           LIMIT ?`,
          [languagePair, levelObj.level, perLevelLimit]
        );
        
        result = [...result, ...levelWords];
      }
      
      // Sonuçları karıştır
      result = result.sort(() => Math.random() - 0.5);
      
      // Limit kadar kelime döndür
      return result.slice(0, limit);
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
        `SELECT word, meaning, example, level, streak FROM words 
         WHERE language_pair = ? AND (word LIKE ? OR meaning LIKE ?) 
         ORDER BY level, word
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
        query = `SELECT word, meaning, example, level, streak FROM words 
                WHERE language_pair = ? AND level = ? 
                ORDER BY word
                LIMIT ? OFFSET ?`;
        params = [languagePair, level, limit, offset];
      } else {
        query = `SELECT word, meaning, example, level, streak FROM words 
                WHERE language_pair = ? 
                ORDER BY level, word
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
        sqlQuery = `SELECT word, meaning, example, level, streak FROM words 
                   WHERE language_pair = ? AND level = ? AND (word LIKE ? OR meaning LIKE ?) 
                   ORDER BY word
                   LIMIT ? OFFSET ?`;
        params = [languagePair, level, `%${query}%`, `%${query}%`, limit, offset];
      } else {
        sqlQuery = `SELECT word, meaning, example, level, streak FROM words 
                   WHERE language_pair = ? AND (word LIKE ? OR meaning LIKE ?) 
                   ORDER BY level, word
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

  // Belirli bir kelimeyi öğrenilen kelimelerden sil
  async deleteLearnedWord(word: string, languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.runAsync(
        'DELETE FROM learned_words WHERE word = ? AND language_pair = ?',
        [word, languagePair]
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting learned word:', error);
      return false;
    }
  }

  // Kelime doğru cevaplandığında streak sayısını artır
  async incrementWordStreak(word: string, level: string, languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.runAsync(
        'UPDATE words SET streak = streak + 1 WHERE word = ? AND level = ? AND language_pair = ?',
        [word, level, languagePair]
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error incrementing word streak:', error);
      return false;
    }
  }

  // Kelime yanlış cevaplandığında streak sayısını azalt (minimum 0)
  async decrementWordStreak(word: string, level: string, languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.runAsync(
        'UPDATE words SET streak = MAX(0, streak - 1) WHERE word = ? AND level = ? AND language_pair = ?',
        [word, level, languagePair]
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error decrementing word streak:', error);
      return false;
    }
  }

  // Belirli bir seviye ve dil çifti için kelimeleri streak sayılarıyla birlikte getir
  async getWordsWithStreaks(level: string, languagePair: string): Promise<Word[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<Word>(
        'SELECT word, meaning, example, level, streak FROM words WHERE level = ? AND language_pair = ? ORDER BY streak DESC, word',
        [level, languagePair]
      );
      return result;
    } catch (error) {
      console.error('Error getting words with streaks from SQLite:', error);
      return [];
    }
  }

  // Kelime streak sayısını sıfırla
  async resetWordStreak(word: string, level: string, languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.runAsync(
        'UPDATE words SET streak = 0 WHERE word = ? AND level = ? AND language_pair = ?',
        [word, level, languagePair]
      );
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error resetting word streak:', error);
      return false;
    }
  }

  // Dil çifti için streak istatistiklerini getir
  async getStreakStatistics(languagePair: string): Promise<{
    totalWords: number;
    averageStreak: number;
    streakDistribution: { streak: number; count: number }[];
  }> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      // Toplam kelime sayısı
      const totalResult = await this.db.getFirstAsync<{count: number}>(
        'SELECT COUNT(*) as count FROM words WHERE language_pair = ?',
        [languagePair]
      );
      
      // Ortalama streak
      const avgResult = await this.db.getFirstAsync<{avg: number}>(
        'SELECT AVG(streak) as avg FROM words WHERE language_pair = ?',
        [languagePair]
      );
      
      // Streak dağılımı
      const distributionResult = await this.db.getAllAsync<{streak: number; count: number}>(
        'SELECT streak, COUNT(*) as count FROM words WHERE language_pair = ? GROUP BY streak ORDER BY streak',
        [languagePair]
      );
      
      return {
        totalWords: totalResult?.count || 0,
        averageStreak: avgResult?.avg || 0,
        streakDistribution: distributionResult
      };
    } catch (error) {
      console.error('Error getting streak statistics:', error);
      return {
        totalWords: 0,
        averageStreak: 0,
        streakDistribution: []
      };
    }
  }

  // Öğrenilen kelimeleri SQLite'a kaydet
  async saveLearnedWords(words: LearnedWord[], languagePair: string): Promise<boolean> {
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
            placeholders.push('(?, ?, ?, ?, ?, ?)');
            values.push(
              word.word,
              word.meaning,
              word.example || '',
              word.level,
              word.learnedAt,
              languagePair
            );
          }
          
          const query = `
            INSERT OR REPLACE INTO learned_words (word, meaning, example, level, learnedAt, language_pair) 
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
  async getLearnedWords(languagePair: string): Promise<LearnedWord[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<LearnedWord>(
        'SELECT word, meaning, example, level, learnedAt, language_pair FROM learned_words WHERE language_pair = ?',
        [languagePair]
      );
      return result.map(row => ({
        id: row.word, // word'ü id olarak kullan
        word: row.word,
        meaning: row.meaning,
        example: row.example,
        level: row.level,
        learnedAt: row.learnedAt
      }));
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

  // Egzersiz sonucunu kaydet ve ID'sini döndür
  async saveExerciseResult(
    exerciseType: string,
    score: number,
    totalQuestions: number,
    languagePair: string,
    wordSource: string = 'learned',
    level: string | null = null,
    wordListId: number | null = null,
    wordListName: string | null = null
  ): Promise<number | null> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const date = new Date().toISOString();
      
      const result = await this.db.runAsync(
        'INSERT INTO exercise_results (exercise_type, score, total_questions, date, language_pair, word_source, level, word_list_id, word_list_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [exerciseType, score, totalQuestions, date, languagePair, wordSource, level, wordListId, wordListName]
      );
      
      // Eklenen kaydın ID'sini döndür
      return result.lastInsertRowId;
    } catch (error) {
      console.error('Error saving exercise result:', error);
      return null;
    }
  }

  // Egzersiz detaylarını kaydet
  async saveExerciseDetails(
    exerciseId: number,
    details: any,
    languagePair: string
  ): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      // Detayları JSON olarak serialize et
      const detailsJson = JSON.stringify(details);
      
      await this.db.runAsync(
        'INSERT INTO exercise_details (exercise_id, details, language_pair) VALUES (?, ?, ?)',
        [exerciseId, detailsJson, languagePair]
      );
      
      return true;
    } catch (error) {
      console.error('Error saving exercise details:', error);
      return false;
    }
  }
  
  // Egzersiz detaylarını getir
  async getExerciseDetails(exerciseId: number): Promise<any | null> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<{
        id: number;
        exercise_id: number;
        details: string;
        language_pair: string;
      }>(
        'SELECT * FROM exercise_details WHERE exercise_id = ?',
        [exerciseId]
      );
      
      if (result.length > 0) {
        const detailsRow = result[0];
        // JSON'dan parse et
        return {
          id: detailsRow.id,
          exerciseId: detailsRow.exercise_id,
          details: JSON.parse(detailsRow.details),
          languagePair: detailsRow.language_pair
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting exercise details:', error);
      return null;
    }
  }
  
  // Egzersiz sonuçlarını detaylarıyla birlikte getir
  async getExerciseResultsWithDetails(languagePair: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      // Önce egzersiz sonuçlarını al
      const results = await this.db.getAllAsync<{
        id: number;
        exercise_type: string;
        score: number;
        total_questions: number;
        date: string;
        language_pair: string;
        word_source?: string;
        level?: string;
        word_list_id?: number;
        word_list_name?: string;
      }>(
        `SELECT * FROM exercise_results 
         WHERE language_pair = ? 
         ORDER BY date DESC 
         LIMIT ? OFFSET ?`,
        [languagePair, limit, offset]
      );
      
      // Her sonuç için detayları al
      const resultsWithDetails = [];
      for (const result of results) {
        const details = await this.getExerciseDetails(result.id);
        resultsWithDetails.push({
          id: result.id,
          exercise_type: result.exercise_type,
          score: result.score,
          total_questions: result.total_questions,
          date: result.date,
          language_pair: result.language_pair,
          word_source: result.word_source,
          level: result.level,
          word_list_id: result.word_list_id,
          word_list_name: result.word_list_name,
          details: details ? details.details : null
        });
      }
      
      return resultsWithDetails;
    } catch (error) {
      console.error('Error getting exercise results with details:', error);
      return [];
    }
  }

  // Özel kelime listesi oluştur
  async createWordList(name: string, languagePair: string): Promise<number | null> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const createdAt = new Date().toISOString();
      const result = await this.db.runAsync(
        'INSERT INTO custom_word_lists (name, created_at, language_pair) VALUES (?, ?, ?)',
        [name, createdAt, languagePair]
      );
      
      return result.lastInsertRowId || null;
    } catch (error) {
      console.error('Error creating word list:', error);
      return null;
    }
  }

  // Özel kelime listesine kelime ekle
  async addWordToList(listId: number, word: Word): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      // Önce kelimenin zaten listede olup olmadığını kontrol et
      const existingWord = await this.db.getFirstAsync<{id: number}>(
        'SELECT id FROM custom_word_list_items WHERE list_id = ? AND word = ?',
        [listId, word.word]
      );
      
      if (existingWord) {
        // Kelime zaten var, güncelleme yap
        const addedAt = new Date().toISOString();
        await this.db.runAsync(
          'UPDATE custom_word_list_items SET meaning = ?, example = ?, level = ?, added_at = ? WHERE list_id = ? AND word = ?',
          [word.meaning, word.example || '', word.level || 'custom', addedAt, listId, word.word]
        );
      } else {
        // Yeni kelime ekle
        const addedAt = new Date().toISOString();
        await this.db.runAsync(
          'INSERT OR IGNORE INTO custom_word_list_items (list_id, word, meaning, example, level, added_at) VALUES (?, ?, ?, ?, ?, ?)',
          [listId, word.word, word.meaning, word.example || '', word.level || 'custom', addedAt]
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error adding word to list:', error);
      return false;
    }
  }

  // Özel kelime listelerini getir
  async getWordLists(languagePair: string): Promise<{ id: number; name: string; created_at: string }[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const lists = await this.db.getAllAsync<{ id: number; name: string; created_at: string }>(
        'SELECT id, name, created_at FROM custom_word_lists WHERE language_pair = ? ORDER BY created_at DESC',
        [languagePair]
      );
      
      return lists;
    } catch (error) {
      console.error('Error getting word lists:', error);
      return [];
    }
  }

  // Özel kelime listesindeki kelimeleri getir
  async getWordsFromList(listId: number): Promise<Word[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const words = await this.db.getAllAsync<Word>(
        'SELECT word, meaning, example, level FROM custom_word_list_items WHERE list_id = ? ORDER BY added_at DESC',
        [listId]
      );
      
      return words.map(word => ({
        id: word.word, // word'ü id olarak kullan
        word: word.word,
        meaning: word.meaning,
        example: word.example,
        level: word.level
      }));
    } catch (error) {
      console.error('Error getting words from list:', error);
      return [];
    }
  }

  // Özel kelime listesini sil
  async deleteWordList(listId: number): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      await this.db.runAsync('DELETE FROM custom_word_lists WHERE id = ?', [listId]);
      return true;
    } catch (error) {
      console.error('Error deleting word list:', error);
      return false;
    }
  }

  // Özel kelime listesinden kelime sil
  async removeWordFromList(listId: number | string, word: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      await this.db.runAsync(
        'DELETE FROM custom_word_list_items WHERE list_id = ? AND word = ?',
        [listId, word]
      );
      return true;
    } catch (error) {
      console.error('Error removing word from list:', error);
      return false;
    }
  }

  // Kelime listesindeki kelimeleri getir
  async getWordListItems(listId: string): Promise<Word[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const result = await this.db.getAllAsync<{
        id: number;
        word: string;
        meaning: string;
        example: string | null;
        level: string | null;
        added_at: string;
      }>(
        `SELECT w.*, cwli.added_at 
         FROM custom_word_list_items cwli
         JOIN words w ON w.id = cwli.word_id
         WHERE cwli.list_id = ?
         ORDER BY cwli.added_at DESC`,
        [listId]
      );
      
      return result.map(row => ({
        id: row.id.toString(),
        word: row.word,
        meaning: row.meaning,
        example: row.example || undefined,
        level: row.level || undefined
      }));
    } catch (error) {
      console.error('Error getting word list items:', error);
      return [];
    }
  }

  // Belirli bir dil çifti için egzersiz sonuçlarını getir
  async getExerciseResults(languagePair: string): Promise<{
    id: number;
    exercise_type: string;
    score: number;
    total_questions: number;
    date: string;
    word_source?: string;
  }[]> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      const results = await this.db.getAllAsync<{
        id: number;
        exercise_type: string;
        score: number;
        total_questions: number;
        date: string;
        word_source?: string;
      }>(
        'SELECT id, exercise_type, score, total_questions, date, word_source FROM exercise_results WHERE language_pair = ? ORDER BY date DESC',
        [languagePair]
      );
      
      return results;
    } catch (error) {
      console.error('Egzersiz sonuçları alınırken hata:', error);
      return [];
    }
  }

  // Yarım Kalan Egzersizler için Fonksiyonlar
  
  async saveUnfinishedExercise(exercise: UnfinishedExercise): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO unfinished_exercises (
        timestamp, language_pair, exercise_type, question_index, total_questions, score, 
        asked_words, question_details, word_source, level, word_list_id, word_list_name, previous_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      exercise.timestamp,
      exercise.languagePair,
      exercise.exerciseType,
      exercise.questionIndex,
      exercise.totalQuestions,
      exercise.score,
      JSON.stringify(exercise.askedWords),
      JSON.stringify(exercise.questionDetails),
      exercise.wordSource || null,
      exercise.level || null,
      exercise.wordListId || null,
      exercise.wordListName || null,
      exercise.previousType || null,
    ];
    await this.db.runAsync(query, params);
  }

  async getUnfinishedExercises(languagePair: string): Promise<UnfinishedExercise[]> {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const query = `
      SELECT * FROM unfinished_exercises 
      WHERE language_pair = ? AND timestamp >= ? 
      ORDER BY timestamp DESC
    `;
    const results = await this.getAllAsync<any>(query, [languagePair, twentyFourHoursAgo]);
    
    // JSON stringleri parse et
    return results.map(ex => ({
      ...ex,
      languagePair: ex.language_pair,
      exerciseType: ex.exercise_type,
      questionIndex: ex.question_index,
      totalQuestions: ex.total_questions,
      askedWords: JSON.parse(ex.asked_words),
      questionDetails: JSON.parse(ex.question_details),
      wordSource: ex.word_source,
      wordListId: ex.word_list_id,
      wordListName: ex.word_list_name,
      previousType: ex.previous_type,
    }));
  }

  async deleteUnfinishedExercise(timestamp: number): Promise<void> {
    const query = 'DELETE FROM unfinished_exercises WHERE timestamp = ?';
    await this.db.runAsync(query, [timestamp]);
  }
}

export const dbService = new DatabaseService(); 