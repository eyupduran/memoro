import * as SQLite from 'expo-sqlite';

class DatabaseUtils {
  private db!: SQLite.SQLiteDatabase;
  private initialized: boolean = false;

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
      await this.db.execAsync(`
        PRAGMA synchronous = NORMAL;
        PRAGMA journal_mode = WAL;
      `);
      this.initialized = true;
    } catch (error) {
      console.error("Database initialization error:", error);
    }
  }

  async checkWordDataExists(languagePair: string): Promise<boolean> {
    try {
      if (!this.initialized) await this.initDatabase();

      const result = await this.db.getFirstAsync<{count: number}>(
        'SELECT COUNT(*) as count FROM words WHERE language_pair = ?',
        [languagePair]
      );
      
      return result?.count ? result.count > 0 : false;
    } catch (error) {
      console.error('Error checking word data:', error);
      return false;
    }
  }
}

export const databaseUtils = new DatabaseUtils();
export const checkWordDataExists = (languagePair: string) => databaseUtils.checkWordDataExists(languagePair); 