import * as SQLite from 'expo-sqlite';
import type { Word, WordList, LearnedWord } from '../types/words';
import type { UnfinishedExercise } from '../screens/ExerciseQuestionScreen';

/**
 * Logical tables that cloudSync knows how to push. Every write method in
 * DatabaseService tags itself with one of these so cloudSync can push only
 * the tables that actually changed instead of re-uploading everything.
 *
 * Note: exercise_results and exercise_details are tagged together under
 * 'exercise_results' because the two are always written as a pair and the
 * push logic joins them.
 */
export type SyncTable =
  | 'learned_words'
  | 'word_progress'
  | 'exercise_results'
  | 'custom_word_lists'
  | 'custom_word_list_items'
  | 'unfinished_exercises'
  | 'user_settings';

class DatabaseService {
  private db!: SQLite.SQLiteDatabase;
  private initialized: boolean = false;
  private BATCH_SIZE = 500; // Toplu işlem için maksimum kelime sayısı
  // Called after any user-data write. cloudSync registers a listener here to
  // schedule a debounced push. The argument is the *logical* table name so
  // cloudSync can skip pushing tables that haven't changed.
  //
  // Kept as a callback rather than an import to avoid a circular dependency
  // (cloudSync imports dbService).
  private onDirtyCallback: ((table: SyncTable) => void) | null = null;
  // When > 0, markDirty is suppressed. cloudSync bumps this around pull()
  // so writes done by the pull flow itself don't trigger another push.
  private suppressDirtyDepth = 0;

  public setOnDirty(callback: ((table: SyncTable) => void) | null): void {
    this.onDirtyCallback = callback;
  }

  public suppressDirty(on: boolean): void {
    this.suppressDirtyDepth += on ? 1 : -1;
    if (this.suppressDirtyDepth < 0) this.suppressDirtyDepth = 0;
  }

  private now(): string {
    return new Date().toISOString();
  }

  private markDirty(table: SyncTable): void {
    if (this.suppressDirtyDepth > 0) return;
    try {
      this.onDirtyCallback?.(table);
    } catch (err) {
      console.warn('onDirty callback threw:', err);
    }
  }

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
          updated_at TEXT NOT NULL DEFAULT '',
          deleted_at TEXT DEFAULT NULL,
          UNIQUE(word, language_pair)
        );

        CREATE TABLE IF NOT EXISTS exercise_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exercise_type TEXT NOT NULL,
          score INTEGER NOT NULL,
          total_questions INTEGER NOT NULL,
          date TEXT NOT NULL,
          language_pair TEXT NOT NULL,
          word_source TEXT,
          updated_at TEXT NOT NULL DEFAULT '',
          deleted_at TEXT DEFAULT NULL
        );

        CREATE TABLE IF NOT EXISTS exercise_details (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exercise_id INTEGER NOT NULL,
          details TEXT NOT NULL,
          language_pair TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT '',
          deleted_at TEXT DEFAULT NULL,
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
          updated_at TEXT NOT NULL DEFAULT '',
          deleted_at TEXT DEFAULT NULL,
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
          variant_key TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT '',
          deleted_at TEXT DEFAULT NULL,
          FOREIGN KEY(list_id) REFERENCES custom_word_lists(id) ON DELETE CASCADE,
          UNIQUE(list_id, word, variant_key)
        );

        CREATE TABLE IF NOT EXISTS word_details (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          language_pair TEXT NOT NULL,
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(word, language_pair)
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
          previous_type TEXT,
          updated_at TEXT NOT NULL DEFAULT '',
          deleted_at TEXT DEFAULT NULL
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

      // custom_word_list_items tablosunu kontrol et ve variant_key sütununu ekle.
      // variant_key, aynı kelimenin farklı sözlük varyantlarının (detay ekranından gelen
      // farklı definition/example) ayrı satırlar olarak saklanmasını sağlar.
      // Eski UNIQUE(list_id, word) kısıtı, UNIQUE(list_id, word, variant_key) ile değiştirilir.
      // SQLite UNIQUE kısıtını ALTER edemediği için tabloyu yeniden yaratıyoruz.
      const customWordListItemsInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(custom_word_list_items)"
      );

      const hasVariantKey = customWordListItemsInfo.some(column => column.name === 'variant_key');

      if (customWordListItemsInfo.length > 0 && !hasVariantKey) {
        await this.db.execAsync(`
          BEGIN TRANSACTION;

          CREATE TABLE custom_word_list_items_temp (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            list_id INTEGER NOT NULL,
            word TEXT NOT NULL,
            meaning TEXT NOT NULL,
            example TEXT,
            level TEXT NOT NULL,
            added_at TEXT NOT NULL,
            variant_key TEXT NOT NULL DEFAULT '',
            FOREIGN KEY(list_id) REFERENCES custom_word_lists(id) ON DELETE CASCADE,
            UNIQUE(list_id, word, variant_key)
          );

          INSERT INTO custom_word_list_items_temp (id, list_id, word, meaning, example, level, added_at, variant_key)
          SELECT id, list_id, word, meaning, example, level, added_at, '' FROM custom_word_list_items;

          DROP TABLE custom_word_list_items;

          ALTER TABLE custom_word_list_items_temp RENAME TO custom_word_list_items;

          COMMIT;
        `);

        console.log("custom_word_list_items tablosu güncellendi, variant_key sütunu eklendi.");
      }

      // Incremental sync migration: add updated_at + deleted_at to user-data tables.
      // Check learned_words as sentinel — if it already has updated_at, all tables do.
      const syncMigrationInfo = await this.db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(learned_words)"
      );
      const hasUpdatedAt = syncMigrationInfo.some(c => c.name === 'updated_at');
      if (!hasUpdatedAt) {
        await this.db.execAsync(`
          ALTER TABLE learned_words ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
          ALTER TABLE learned_words ADD COLUMN deleted_at TEXT DEFAULT NULL;
          ALTER TABLE exercise_results ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
          ALTER TABLE exercise_results ADD COLUMN deleted_at TEXT DEFAULT NULL;
          ALTER TABLE exercise_details ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
          ALTER TABLE exercise_details ADD COLUMN deleted_at TEXT DEFAULT NULL;
          ALTER TABLE custom_word_lists ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
          ALTER TABLE custom_word_lists ADD COLUMN deleted_at TEXT DEFAULT NULL;
          ALTER TABLE custom_word_list_items ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
          ALTER TABLE custom_word_list_items ADD COLUMN deleted_at TEXT DEFAULT NULL;
          ALTER TABLE unfinished_exercises ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
          ALTER TABLE unfinished_exercises ADD COLUMN deleted_at TEXT DEFAULT NULL;
        `);
        console.log("Incremental sync migration: updated_at + deleted_at columns added.");
      }

      // İndeks oluştur
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_words_level_lang ON words(level, language_pair);
        CREATE INDEX IF NOT EXISTS idx_words_word ON words(word);
        CREATE INDEX IF NOT EXISTS idx_learned_words_lang ON learned_words(language_pair);
        CREATE INDEX IF NOT EXISTS idx_learned_words_updated ON learned_words(updated_at);
        CREATE INDEX IF NOT EXISTS idx_exercise_results_lang ON exercise_results(language_pair);
        CREATE INDEX IF NOT EXISTS idx_exercise_results_updated ON exercise_results(updated_at);
        CREATE INDEX IF NOT EXISTS idx_custom_word_lists_lang ON custom_word_lists(language_pair);
        CREATE INDEX IF NOT EXISTS idx_custom_word_list_items_list ON custom_word_list_items(list_id);
        CREATE INDEX IF NOT EXISTS idx_custom_word_list_items_updated ON custom_word_list_items(updated_at);
        CREATE INDEX IF NOT EXISTS idx_unfinished_exercises_lang ON unfinished_exercises(language_pair);
        CREATE INDEX IF NOT EXISTS idx_word_details_word_lang ON word_details(word, language_pair);
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

  // Kelime detaylarını (DictionaryResponse yapısı) toplu olarak kaydet.
  // Beklenen giriş formatı: Record<string, DictionaryResponse> — anahtar kelime,
  // değer ise o kelimeye ait sözlük girdilerini içeren dizi (dizilerin dizisi).
  async saveWordDetails(
    details: Record<string, any>,
    languagePair: string
  ): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();

      const entries = Object.entries(details || {});
      if (entries.length === 0) {
        return true;
      }

      console.log(
        `Detaylı kelime verisi kaydı başlatılıyor: ${entries.length} kelime, dil: ${languagePair}`
      );
      const startTime = Date.now();
      const updatedAt = new Date().toISOString();

      await this.db.withTransactionAsync(async () => {
        for (let i = 0; i < entries.length; i += this.BATCH_SIZE) {
          const batch = entries.slice(i, i + this.BATCH_SIZE);
          const placeholders: string[] = [];
          const values: any[] = [];

          for (const [word, data] of batch) {
            placeholders.push('(?, ?, ?, ?)');
            values.push(
              word,
              languagePair,
              JSON.stringify(data),
              updatedAt
            );
          }

          const query = `
            INSERT OR REPLACE INTO word_details (word, language_pair, data, updated_at)
            VALUES ${placeholders.join(',')}
          `;

          await this.db.runAsync(query, values);
        }
      });

      const endTime = Date.now();
      console.log(
        `Detaylı kelime verisi kaydı tamamlandı: ${entries.length} kelime, ${endTime - startTime}ms`
      );
      return true;
    } catch (error) {
      console.error('Error saving word details to SQLite:', error);
      return false;
    }
  }

  // Tek bir kelime için detay verisini getir (DictionaryResponse olarak parse edilmiş).
  async getWordDetail(word: string, languagePair: string): Promise<any | null> {
    try {
      if (!this.initialized) await this.initDatabase();

      const result = await this.db.getFirstAsync<{ data: string }>(
        'SELECT data FROM word_details WHERE word = ? AND language_pair = ? LIMIT 1',
        [word, languagePair]
      );

      if (!result?.data) return null;
      try {
        return JSON.parse(result.data);
      } catch (parseError) {
        console.error('Error parsing word detail JSON:', parseError);
        return null;
      }
    } catch (error) {
      console.error('Error getting word detail from SQLite:', error);
      return null;
    }
  }

  // Detaylı kelime verisinin belirli bir dil çifti için yüklü olup olmadığını kontrol et.
  async isWordDetailsLoaded(languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();

      const result = await this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM word_details WHERE language_pair = ?',
        [languagePair]
      );
      return result?.count ? result.count > 0 : false;
    } catch (error) {
      console.error('Error checking word details data:', error);
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

  // Belirli bir kelimeyi öğrenilen kelimelerden sil (soft delete)
  async deleteLearnedWord(word: string, languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      const ts = this.now();
      const result = await this.db.runAsync(
        'UPDATE learned_words SET deleted_at = ?, updated_at = ? WHERE word = ? AND language_pair = ? AND deleted_at IS NULL',
        [ts, ts, word, languagePair]
      );

      if (result.changes > 0) this.markDirty('learned_words');
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

      if (result.changes > 0) this.markDirty('word_progress');
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

      if (result.changes > 0) this.markDirty('word_progress');
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

      if (result.changes > 0) this.markDirty('word_progress');
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
      
      const ts = this.now();
      await this.db.withTransactionAsync(async () => {
        // Her BATCH_SIZE kelime için toplu sorgu
        for (let i = 0; i < words.length; i += this.BATCH_SIZE) {
          const batch = words.slice(i, i + this.BATCH_SIZE);
          let placeholders = [];
          let values = [];

          for (const word of batch) {
            placeholders.push('(?, ?, ?, ?, ?, ?, ?)');
            values.push(
              word.word,
              word.meaning,
              word.example || '',
              word.level,
              word.learnedAt,
              languagePair,
              ts
            );
          }

          const query = `
            INSERT OR REPLACE INTO learned_words (word, meaning, example, level, learnedAt, language_pair, updated_at)
            VALUES ${placeholders.join(',')}
          `;

          await this.db.runAsync(query, values);
        }
      });

      this.markDirty('learned_words');
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
        'SELECT word, meaning, example, level, learnedAt, language_pair FROM learned_words WHERE language_pair = ? AND deleted_at IS NULL',
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
        'INSERT INTO exercise_results (exercise_type, score, total_questions, date, language_pair, word_source, level, word_list_id, word_list_name, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [exerciseType, score, totalQuestions, date, languagePair, wordSource, level, wordListId, wordListName, this.now()]
      );

      this.markDirty('exercise_results');
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
        'INSERT INTO exercise_details (exercise_id, details, language_pair, updated_at) VALUES (?, ?, ?, ?)',
        [exerciseId, detailsJson, languagePair, this.now()]
      );

      // exercise_results ve exercise_details her zaman beraber push edilir —
      // details yazıldığında tek bir dirty tag yeterli.
      this.markDirty('exercise_results');
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
        'SELECT * FROM exercise_details WHERE exercise_id = ? AND deleted_at IS NULL',
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
         WHERE language_pair = ? AND deleted_at IS NULL
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
        'INSERT INTO custom_word_lists (name, created_at, language_pair, updated_at) VALUES (?, ?, ?, ?)',
        [name, createdAt, languagePair, this.now()]
      );

      this.markDirty('custom_word_lists');
      return result.lastInsertRowId || null;
    } catch (error) {
      console.error('Error creating word list:', error);
      return null;
    }
  }

  // Özel kelime listesine kelime ekle.
  // variantKey:
  //   - '' (varsayılan) → mevcut davranış: aynı kelime listede zaten varsa üzerine yazılır
  //   - non-empty → her benzersiz variantKey ayrı satır olarak saklanır (detay ekranı için)
  async addWordToList(listId: number, word: Word, variantKey: string = ''): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();

      // Önce aynı (list_id, word, variant_key) üçlüsünün zaten var olup olmadığını kontrol et
      const existingWord = await this.db.getFirstAsync<{id: number}>(
        'SELECT id FROM custom_word_list_items WHERE list_id = ? AND word = ? AND variant_key = ? AND deleted_at IS NULL',
        [listId, word.word, variantKey]
      );

      const addedAt = new Date().toISOString();

      const ts = this.now();
      if (existingWord) {
        // Aynı varyant zaten var, güncelleme yap (example/meaning yenilenmiş olabilir)
        await this.db.runAsync(
          'UPDATE custom_word_list_items SET meaning = ?, example = ?, level = ?, added_at = ?, updated_at = ? WHERE list_id = ? AND word = ? AND variant_key = ?',
          [word.meaning, word.example || '', word.level || 'custom', addedAt, ts, listId, word.word, variantKey]
        );
      } else {
        // Yeni kayıt ekle
        await this.db.runAsync(
          'INSERT OR IGNORE INTO custom_word_list_items (list_id, word, meaning, example, level, added_at, variant_key, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [listId, word.word, word.meaning, word.example || '', word.level || 'custom', addedAt, variantKey, ts]
        );
      }

      this.markDirty('custom_word_list_items');
      return true;
    } catch (error) {
      console.error('Error adding word to list:', error);
      return false;
    }
  }

  // Özel kelime listelerini getir
  async getWordLists(languagePair: string): Promise<{ id: number; name: string; created_at: string; word_count: number }[]> {
    try {
      if (!this.initialized) await this.initDatabase();

      const lists = await this.db.getAllAsync<{ id: number; name: string; created_at: string; word_count: number }>(
        `SELECT l.id, l.name, l.created_at,
                COUNT(i.id) as word_count
         FROM custom_word_lists l
         LEFT JOIN custom_word_list_items i ON i.list_id = l.id AND i.deleted_at IS NULL
         WHERE l.language_pair = ? AND l.deleted_at IS NULL
         GROUP BY l.id
         ORDER BY l.created_at DESC`,
        [languagePair]
      );

      return lists;
    } catch (error) {
      console.error('Error getting word lists:', error);
      return [];
    }
  }

  // Özel kelime listesindeki kelimeleri getir.
  // variant_key sütunu da döndürülür — aynı kelimenin farklı varyantlarının (detay ekranından)
  // ayrı satırlar olarak listelenebilmesi ve tekil silinebilmesi için.
  async getWordsFromList(listId: number): Promise<Word[]> {
    try {
      if (!this.initialized) await this.initDatabase();

      const rows = await this.db.getAllAsync<{
        word: string;
        meaning: string;
        example?: string;
        level: string;
        variant_key: string;
      }>(
        'SELECT word, meaning, example, level, variant_key FROM custom_word_list_items WHERE list_id = ? AND deleted_at IS NULL ORDER BY added_at DESC',
        [listId]
      );

      return rows.map(row => ({
        // id, aynı kelimenin birden fazla varyantı olduğunda React list key çakışmasını önlemek için
        // word + variant_key birleşimi olarak üretilir. variant_key boşsa eski davranışla aynı.
        id: row.variant_key ? `${row.word}::${row.variant_key}` : row.word,
        word: row.word,
        meaning: row.meaning,
        example: row.example,
        level: row.level,
        variantKey: row.variant_key,
      }));
    } catch (error) {
      console.error('Error getting words from list:', error);
      return [];
    }
  }

  // Özel kelime listesini sil (soft delete — list + child items)
  async deleteWordList(listId: number): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      const ts = this.now();
      await this.db.withTransactionAsync(async () => {
        await this.db.runAsync(
          'UPDATE custom_word_lists SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
          [ts, ts, listId]
        );
        await this.db.runAsync(
          'UPDATE custom_word_list_items SET deleted_at = ?, updated_at = ? WHERE list_id = ? AND deleted_at IS NULL',
          [ts, ts, listId]
        );
      });
      this.markDirty('custom_word_lists');
      this.markDirty('custom_word_list_items');
      return true;
    } catch (error) {
      console.error('Error deleting word list:', error);
      return false;
    }
  }

  // Özel kelime listesinden kelime sil.
  // variantKey verilirse sadece o varyant satırı silinir (detay ekranından eklenen satırlar).
  // Verilmezse o kelimeye ait tüm varyant satırları silinir (eski davranışla uyumlu).
  async removeWordFromList(
    listId: number | string,
    word: string,
    variantKey?: string
  ): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();

      const ts = this.now();
      if (variantKey !== undefined) {
        await this.db.runAsync(
          'UPDATE custom_word_list_items SET deleted_at = ?, updated_at = ? WHERE list_id = ? AND word = ? AND variant_key = ? AND deleted_at IS NULL',
          [ts, ts, listId, word, variantKey]
        );
      } else {
        await this.db.runAsync(
          'UPDATE custom_word_list_items SET deleted_at = ?, updated_at = ? WHERE list_id = ? AND word = ? AND deleted_at IS NULL',
          [ts, ts, listId, word]
        );
      }
      this.markDirty('custom_word_list_items');
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

      const query = `
        SELECT
          word,
          meaning,
          example,
          level,
          added_at,
          variant_key
        FROM custom_word_list_items
        WHERE list_id = ? AND deleted_at IS NULL
      `;

      const rows = await this.db.getAllAsync<{
        word: string;
        meaning: string;
        example?: string;
        level: string;
        added_at: string;
        variant_key: string;
      }>(query, [listId]);

      return rows.map(row => ({
        id: row.variant_key ? `${row.word}::${row.variant_key}` : row.word,
        word: row.word,
        meaning: row.meaning,
        example: row.example,
        level: row.level,
        variantKey: row.variant_key,
      }));
    } catch (error) {
      console.error('Error getting word list items:', error);
      return [];
    }
  }

  // Kelime listesinin streak durumunu kontrol et
  async checkWordListStreak(listId: number, languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      
      // Listedeki tüm kelimeleri al
      const words = await this.getWordListItems(listId.toString());
      
      // Her kelime için egzersiz sonuçlarını kontrol et
      for (const word of words) {
        const query = `
          SELECT COUNT(*) as count
          FROM exercise_results er
          JOIN exercise_details ed ON er.id = ed.exercise_id
          WHERE er.language_pair = ?
          AND er.deleted_at IS NULL
          AND ed.deleted_at IS NULL
          AND er.score = er.total_questions
          AND ed.details LIKE ?
          AND er.word_list_id = ?
        `;
        
        const result = await this.getFirstAsync<{ count: number }>(
          query,
          [languagePair, `%${word.word}%`, listId]
        );
        
        // Eğer kelime için başarılı bir egzersiz sonucu yoksa false döndür
        if (!result || result.count === 0) {
          return false;
        }
      }
      
      // Tüm kelimeler için başarılı egzersiz sonucu varsa true döndür
      return true;
    } catch (error) {
      console.error('Error checking word list streak:', error);
      return false;
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
        'SELECT id, exercise_type, score, total_questions, date, word_source FROM exercise_results WHERE language_pair = ? AND deleted_at IS NULL ORDER BY date DESC',
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
        asked_words, question_details, word_source, level, word_list_id, word_list_name, previous_type, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      this.now(),
    ];
    await this.db.runAsync(query, params);
    this.markDirty('unfinished_exercises');
  }

  async getUnfinishedExercises(languagePair: string): Promise<UnfinishedExercise[]> {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const query = `
      SELECT * FROM unfinished_exercises
      WHERE language_pair = ? AND timestamp >= ? AND deleted_at IS NULL
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
    const ts = this.now();
    await this.db.runAsync(
      'UPDATE unfinished_exercises SET deleted_at = ?, updated_at = ? WHERE timestamp = ? AND deleted_at IS NULL',
      [ts, ts, timestamp]
    );
    this.markDirty('unfinished_exercises');
  }

  // ===========================================================================
  // Cloud sync helpers
  // These are used by `cloudSync.ts` to serialize/restore user data over the
  // wire. They are intentionally "raw" (no JSON reshaping) so the sync layer
  // can push and pull in a predictable shape.
  // ===========================================================================

  /**
   * Returns learned words for a language pair with every column needed to push
   * to cloud, including `language_pair` itself.
   */
  async getLearnedWordsRaw(languagePair: string): Promise<Array<{
    word: string;
    meaning: string;
    example: string | null;
    level: string;
    learnedAt: string;
  }>> {
    try {
      if (!this.initialized) await this.initDatabase();
      const rows = await this.db.getAllAsync<{
        word: string;
        meaning: string;
        example: string | null;
        level: string;
        learnedAt: string;
      }>(
        'SELECT word, meaning, example, level, learnedAt FROM learned_words WHERE language_pair = ? AND deleted_at IS NULL',
        [languagePair]
      );
      return rows;
    } catch (error) {
      console.error('Error in getLearnedWordsRaw:', error);
      return [];
    }
  }

  /**
   * Returns per-word streak progress that is nonzero, for sync to cloud.
   * Streaks live on the global `words` table, so we scope by language_pair
   * and only include rows where the user has actually made progress.
   */
  async getWordProgressForSync(languagePair: string): Promise<Array<{
    word: string;
    level: string;
    streak: number;
  }>> {
    try {
      if (!this.initialized) await this.initDatabase();
      const rows = await this.db.getAllAsync<{
        word: string;
        level: string;
        streak: number;
      }>(
        'SELECT word, level, streak FROM words WHERE language_pair = ? AND streak > 0',
        [languagePair]
      );
      return rows;
    } catch (error) {
      console.error('Error in getWordProgressForSync:', error);
      return [];
    }
  }

  /**
   * Restores word progress pulled from the cloud. Streaks are stored on the
   * global `words` table — this method only updates rows that already exist
   * (the global word list is seeded on first launch, so by the time we pull,
   * the words are present).
   */
  async restoreWordProgress(
    progress: Array<{ word: string; level: string; streak: number }>,
    languagePair: string
  ): Promise<void> {
    try {
      if (!this.initialized) await this.initDatabase();
      if (progress.length === 0) return;
      await this.db.withTransactionAsync(async () => {
        for (const p of progress) {
          await this.db.runAsync(
            'UPDATE words SET streak = ? WHERE word = ? AND level = ? AND language_pair = ?',
            [p.streak, p.word, p.level, languagePair]
          );
        }
      });
    } catch (error) {
      console.error('Error in restoreWordProgress:', error);
    }
  }

  /**
   * Returns exercise results with every column needed to push to cloud.
   */
  async getExerciseResultsForSync(languagePair: string): Promise<Array<{
    id: number;
    exercise_type: string;
    score: number;
    total_questions: number;
    date: string;
    word_source: string | null;
    level: string | null;
    word_list_id: number | null;
    word_list_name: string | null;
  }>> {
    try {
      if (!this.initialized) await this.initDatabase();
      const rows = await this.db.getAllAsync<any>(
        `SELECT id, exercise_type, score, total_questions, date, word_source, level, word_list_id, word_list_name
         FROM exercise_results WHERE language_pair = ? AND deleted_at IS NULL`,
        [languagePair]
      );
      return rows;
    } catch (error) {
      console.error('Error in getExerciseResultsForSync:', error);
      return [];
    }
  }

  /**
   * Used by the pull flow to re-insert a full exercise result row. The caller
   * passes the original `client_id` (the SQLite id that was originally
   * generated when the user created this row) and we preserve it — otherwise
   * the next push would send a NEW autoincrement id for the same row, and
   * the cloud would accumulate duplicates on every sign-out/sign-in cycle.
   */
  async insertExerciseResultRaw(
    id: number,
    row: {
      exercise_type: string;
      score: number;
      total_questions: number;
      date: string;
      language_pair: string;
      word_source: string | null;
      level: string | null;
      word_list_id: number | null;
      word_list_name: string | null;
    }
  ): Promise<number | null> {
    try {
      if (!this.initialized) await this.initDatabase();
      const result = await this.db.runAsync(
        `INSERT INTO exercise_results (id, exercise_type, score, total_questions, date, language_pair, word_source, level, word_list_id, word_list_name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          row.exercise_type,
          row.score,
          row.total_questions,
          row.date,
          row.language_pair,
          row.word_source,
          row.level,
          row.word_list_id,
          row.word_list_name,
          this.now(),
        ]
      );
      return result.lastInsertRowId ?? id;
    } catch (error) {
      console.error('Error in insertExerciseResultRaw:', error);
      return null;
    }
  }

  /**
   * Returns custom word list items for sync — the raw rows (word + variant_key
   * + added_at) that map 1:1 to the cloud `custom_word_list_items` table.
   */
  async getWordListItemsForSync(listId: number): Promise<Array<{
    word: string;
    meaning: string;
    example: string | null;
    level: string;
    added_at: string;
    variant_key: string;
  }>> {
    try {
      if (!this.initialized) await this.initDatabase();
      const rows = await this.db.getAllAsync<any>(
        'SELECT word, meaning, example, level, added_at, variant_key FROM custom_word_list_items WHERE list_id = ? AND deleted_at IS NULL',
        [listId]
      );
      return rows;
    } catch (error) {
      console.error('Error in getWordListItemsForSync:', error);
      return [];
    }
  }

  /**
   * Used by the pull flow to re-create a word list with its original id
   * (the cloud `client_id`). Preserving the id is critical so the next push
   * doesn't send a different id for the same row — otherwise the cloud
   * would accumulate duplicates on every sign-out/sign-in cycle.
   */
  async insertWordListRaw(
    id: number,
    name: string,
    createdAt: string,
    languagePair: string
  ): Promise<number | null> {
    try {
      if (!this.initialized) await this.initDatabase();
      const result = await this.db.runAsync(
        'INSERT INTO custom_word_lists (id, name, created_at, language_pair, updated_at) VALUES (?, ?, ?, ?, ?)',
        [id, name, createdAt, languagePair, this.now()]
      );
      return result.lastInsertRowId ?? id;
    } catch (error) {
      console.error('Error in insertWordListRaw:', error);
      return null;
    }
  }

  /**
   * Used by the pull flow to insert a word list item with a specific added_at.
   */
  async insertWordListItemRaw(
    listId: number,
    item: {
      word: string;
      meaning: string;
      example: string;
      level: string;
      added_at: string;
      variant_key: string;
    }
  ): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();
      await this.db.runAsync(
        `INSERT OR IGNORE INTO custom_word_list_items
         (list_id, word, meaning, example, level, added_at, variant_key, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          listId,
          item.word,
          item.meaning,
          item.example || '',
          item.level,
          item.added_at,
          item.variant_key || '',
          this.now(),
        ]
      );
      return true;
    } catch (error) {
      console.error('Error in insertWordListItemRaw:', error);
      return false;
    }
  }

  /**
   * Wipes all USER-SPECIFIC data from the local DB. Global content (the
   * `words`, `word_details`, and `background_images` tables) is PRESERVED so
   * the app does not need to re-download after a sign-out / sign-in.
   *
   * Word streaks on the `words` table are also reset to zero for the given
   * language pair — they're conceptually user progress even though they live
   * on a shared table.
   */
  async wipeUserData(languagePair: string): Promise<void> {
    try {
      if (!this.initialized) await this.initDatabase();
      await this.db.withTransactionAsync(async () => {
        await this.db.runAsync(
          'DELETE FROM learned_words WHERE language_pair = ?',
          [languagePair]
        );
        await this.db.runAsync(
          'DELETE FROM exercise_details WHERE language_pair = ?',
          [languagePair]
        );
        await this.db.runAsync(
          'DELETE FROM exercise_results WHERE language_pair = ?',
          [languagePair]
        );
        // custom_word_list_items cascade via FK when their parent list is gone
        await this.db.runAsync(
          'DELETE FROM custom_word_lists WHERE language_pair = ?',
          [languagePair]
        );
        // Clean up any orphaned items just in case FK cascade is disabled
        await this.db.runAsync(
          'DELETE FROM custom_word_list_items WHERE list_id NOT IN (SELECT id FROM custom_word_lists)'
        );
        await this.db.runAsync(
          'DELETE FROM unfinished_exercises WHERE language_pair = ?',
          [languagePair]
        );
        // Reset streaks on the global word table (they are per-user progress)
        await this.db.runAsync(
          'UPDATE words SET streak = 0 WHERE language_pair = ?',
          [languagePair]
        );
      });
    } catch (error) {
      console.error('Error in wipeUserData:', error);
    }
  }

  // ===========================================================================
  // Incremental sync: delta query methods
  //
  // Each method returns rows changed since `since` (ISO timestamp). If `since`
  // is null, ALL rows are returned (full-push fallback for first-ever sync).
  // Both live rows (deleted_at IS NULL) and soft-deleted rows are included —
  // cloudSync needs both to decide what to upsert vs what to delete from cloud.
  // ===========================================================================

  async getLearnedWordsChangedSince(languagePair: string, since: string | null) {
    const base = 'SELECT word, meaning, example, level, learnedAt, deleted_at FROM learned_words WHERE language_pair = ?';
    if (since === null) {
      return this.getAllAsync<any>(base, [languagePair]);
    }
    return this.getAllAsync<any>(`${base} AND updated_at > ?`, [languagePair, since]);
  }

  async getExerciseResultsChangedSince(languagePair: string, since: string | null) {
    const base = `SELECT id, exercise_type, score, total_questions, date, word_source, level, word_list_id, word_list_name, deleted_at
                  FROM exercise_results WHERE language_pair = ?`;
    if (since === null) {
      return this.getAllAsync<any>(base, [languagePair]);
    }
    return this.getAllAsync<any>(`${base} AND updated_at > ?`, [languagePair, since]);
  }

  async getExerciseDetailsChangedSince(languagePair: string, since: string | null) {
    const base = 'SELECT exercise_id, details, deleted_at FROM exercise_details WHERE language_pair = ?';
    if (since === null) {
      return this.getAllAsync<any>(base, [languagePair]);
    }
    return this.getAllAsync<any>(`${base} AND updated_at > ?`, [languagePair, since]);
  }

  async getWordListsChangedSince(languagePair: string, since: string | null) {
    const base = 'SELECT id, name, created_at, deleted_at FROM custom_word_lists WHERE language_pair = ?';
    if (since === null) {
      return this.getAllAsync<any>(base, [languagePair]);
    }
    return this.getAllAsync<any>(`${base} AND updated_at > ?`, [languagePair, since]);
  }

  async getWordListItemsChangedSince(languagePair: string, since: string | null) {
    const base = `SELECT i.id, i.list_id, i.word, i.meaning, i.example, i.level, i.added_at, i.variant_key, i.deleted_at
                  FROM custom_word_list_items i
                  JOIN custom_word_lists l ON i.list_id = l.id
                  WHERE l.language_pair = ?`;
    if (since === null) {
      return this.getAllAsync<any>(base, [languagePair]);
    }
    return this.getAllAsync<any>(`${base} AND i.updated_at > ?`, [languagePair, since]);
  }

  async getUnfinishedExercisesChangedSince(languagePair: string, since: string | null) {
    const base = `SELECT timestamp, language_pair, exercise_type, question_index, total_questions, score,
                         asked_words, question_details, word_source, level, word_list_id, word_list_name, previous_type, deleted_at
                  FROM unfinished_exercises WHERE language_pair = ?`;
    if (since === null) {
      return this.getAllAsync<any>(base, [languagePair]);
    }
    return this.getAllAsync<any>(`${base} AND updated_at > ?`, [languagePair, since]);
  }

  // ===========================================================================
  // Incremental sync: prune old soft-deleted rows
  // ===========================================================================

  /**
   * Hard-deletes rows that were soft-deleted more than `daysOld` days ago.
   * Called after a successful push so the cloud has already received the
   * delete commands and we can safely reclaim local storage.
   */
  async pruneSoftDeletes(languagePair: string, daysOld: number = 30): Promise<void> {
    try {
      if (!this.initialized) await this.initDatabase();
      const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
      await this.db.withTransactionAsync(async () => {
        await this.db.runAsync(
          'DELETE FROM learned_words WHERE deleted_at IS NOT NULL AND deleted_at < ? AND language_pair = ?',
          [cutoff, languagePair]
        );
        await this.db.runAsync(
          'DELETE FROM exercise_details WHERE deleted_at IS NOT NULL AND deleted_at < ? AND language_pair = ?',
          [cutoff, languagePair]
        );
        await this.db.runAsync(
          'DELETE FROM exercise_results WHERE deleted_at IS NOT NULL AND deleted_at < ? AND language_pair = ?',
          [cutoff, languagePair]
        );
        await this.db.runAsync(
          'DELETE FROM custom_word_list_items WHERE deleted_at IS NOT NULL AND deleted_at < ?',
          [cutoff]
        );
        await this.db.runAsync(
          'DELETE FROM custom_word_lists WHERE deleted_at IS NOT NULL AND deleted_at < ? AND language_pair = ?',
          [cutoff, languagePair]
        );
        await this.db.runAsync(
          'DELETE FROM unfinished_exercises WHERE deleted_at IS NOT NULL AND deleted_at < ? AND language_pair = ?',
          [cutoff, languagePair]
        );
      });
    } catch (error) {
      console.warn('Error in pruneSoftDeletes (non-fatal):', error);
    }
  }
}

export const dbService = new DatabaseService(); 