import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';
import { dbService, SyncTable } from './database';
import { authService } from './authService';

const LAST_SYNC_KEY = 'cloud_last_sync_at';
const LAST_USER_ID_KEY = 'cloud_last_user_id';
// Long-ish debounce on purpose: an exercise run fires ~10 streak writes in
// quick succession and we want them to coalesce into one push.
const DEBOUNCE_MS = 5000;

// AsyncStorage keys that are considered "user settings" and synced via
// the `user_settings` cloud table. Everything else is treated as device-local.
const SYNCED_SETTING_KEYS = [
  'theme',
  'selectedLanguage',
  'learningLanguage',
  'notificationsEnabled',
  'notificationHour',
  'notificationMinute',
  'offlineMode',
  'auto_wallpaper_settings',
];

// Every table cloudSync knows about. Used for full-push (onSignInBootstrap)
// when we explicitly want every table to go, regardless of dirty tracking.
const ALL_SYNC_TABLES: SyncTable[] = [
  'learned_words',
  'word_progress',
  'exercise_results',
  'custom_word_lists',
  'custom_word_list_items',
  'unfinished_exercises',
  'user_settings',
];

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  error: string | null;
}

type Listener = (state: SyncState) => void;

class CloudSyncService {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentState: SyncState = {
    status: 'idle',
    lastSyncAt: null,
    error: null,
  };
  private listeners = new Set<Listener>();
  private inFlight = false;
  // Set of tables that have pending writes not yet pushed to cloud. Each
  // dbService write calls markTableDirty(table), push() drains it.
  private dirtyTables = new Set<SyncTable>();
  // If we're mid-push and more writes arrive, queue them into a NEW set so
  // the in-flight push doesn't swallow them. Drained on next push.
  private pendingTables = new Set<SyncTable>();
  // Tracks whether the user is currently signed in. Set by AuthContext
  // whenever the session changes. When false, cloudSync is completely
  // silent — no dirty tracking, no network calls. The app runs as a pure
  // offline local-only experience (guest mode).
  private hasActiveSession = false;

  /**
   * Called by AuthContext whenever the session appears/disappears. Lets
   * cloudSync short-circuit its work when the user is browsing as a guest.
   */
  setHasActiveSession(hasSession: boolean) {
    this.hasActiveSession = hasSession;
  }

  async init() {
    const last = await AsyncStorage.getItem(LAST_SYNC_KEY);
    this.currentState.lastSyncAt = last;
    this.emit();
  }

  getState(): SyncState {
    return this.currentState;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const l of this.listeners) l(this.currentState);
  }

  private setState(patch: Partial<SyncState>) {
    this.currentState = { ...this.currentState, ...patch };
    this.emit();
  }

  /**
   * Called by dbService after any user-data write. Adds the table to the
   * dirty set and schedules a debounced push. If more writes arrive inside
   * the debounce window, they just add to the set — one push handles them all.
   */
  markTableDirty(table: SyncTable) {
    if (!isSupabaseConfigured()) return;
    // Guest mode: no session → cloudSync is a complete no-op. Writes land
    // in SQLite only and never touch the network. When the user later signs
    // in, onSignInBootstrap full-pushes everything to cloud in one shot.
    if (!this.hasActiveSession) return;
    // If a push is currently running, collect new writes into pendingTables
    // so they get picked up by the NEXT push. Otherwise drain straight into
    // the main dirty set.
    if (this.inFlight) {
      this.pendingTables.add(table);
    } else {
      this.dirtyTables.add(table);
    }
    this.scheduleDebouncedPush();
  }

  private scheduleDebouncedPush() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.push().catch((err) => {
        console.warn('[cloudSync] scheduled push failed:', err);
      });
    }, DEBOUNCE_MS);
  }

  /**
   * Push dirty tables to cloud. Each dirty table is fully replaced (all rows
   * for the current user + language pair are deleted, then the current local
   * rows are inserted) so that local deletes propagate to cloud.
   *
   * If nothing is dirty, this is a no-op.
   *
   * Pass `fullPush=true` to force all tables to be pushed regardless of the
   * dirty set — used by onSignOutCleanup and first-time onSignInBootstrap.
   */
  async push(languagePair?: string, fullPush = false): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    if (this.inFlight) return false;
    const user = await authService.getCurrentUser();
    if (!user) return false;

    // Decide which tables to push BEFORE flipping inFlight, so concurrent
    // writes know to queue into pendingTables.
    const tablesToPush = fullPush
      ? new Set<SyncTable>(ALL_SYNC_TABLES)
      : new Set(this.dirtyTables);

    if (tablesToPush.size === 0) {
      // Nothing to do. Don't touch state.
      return true;
    }

    // Clear the dirty set now that we've captured what to push. Any writes
    // that land during the network call will go into pendingTables and
    // trigger a follow-up push.
    this.dirtyTables.clear();

    this.inFlight = true;
    this.setState({ status: 'syncing', error: null });

    try {
      const pair = languagePair || (await this.getCurrentLanguagePair());
      await this.pushTables(user.id, pair, tablesToPush);
      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNC_KEY, now);
      this.setState({ status: 'idle', lastSyncAt: now, error: null });
      return true;
    } catch (err: any) {
      console.error('[cloudSync] push error:', err);
      // If push failed, restore the tables we tried to push so a retry
      // picks them up. Merge with anything new that arrived in the meantime.
      for (const t of tablesToPush) this.dirtyTables.add(t);
      this.setState({ status: 'error', error: err?.message || 'push failed' });
      return false;
    } finally {
      this.inFlight = false;
      // Drain anything that arrived during the push.
      if (this.pendingTables.size > 0) {
        for (const t of this.pendingTables) this.dirtyTables.add(t);
        this.pendingTables.clear();
        this.scheduleDebouncedPush();
      }
    }
  }

  /**
   * Full download of the current user's cloud data into the local SQLite DB.
   * WIPES local user data first (learned words, exercises, custom lists,
   * streaks, unfinished exercises) then restores from the cloud snapshot.
   * Global content (words, word_details, background_images) is preserved.
   */
  async pull(languagePair?: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    if (this.inFlight) return false;
    const user = await authService.getCurrentUser();
    if (!user) return false;

    this.inFlight = true;
    this.setState({ status: 'syncing', error: null });
    // Suppress the dirty callback while the pull flow writes to SQLite —
    // otherwise every restored row would schedule a new push immediately.
    dbService.suppressDirty(true);

    try {
      const pair = languagePair || (await this.getCurrentLanguagePair());
      await dbService.wipeUserData(pair);
      await this.pullAll(user.id, pair);
      const now = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNC_KEY, now);
      this.setState({ status: 'idle', lastSyncAt: now, error: null });
      return true;
    } catch (err: any) {
      console.error('[cloudSync] pull error:', err);
      this.setState({ status: 'error', error: err?.message || 'pull failed' });
      return false;
    } finally {
      dbService.suppressDirty(false);
      this.inFlight = false;
    }
  }

  /**
   * Called by AuthContext whenever a session appears (fresh sign-in OR
   * app relaunch with a persisted session). Three code paths:
   *
   *   1. SAME USER AS LAST TIME (most common — app relaunch):
   *      Full-push every table. Reconciles offline edits that accumulated
   *      while the app was closed. No pull — we already are the source of
   *      truth on this device.
   *
   *   2. FIRST-EVER SIGN-IN ON THIS DEVICE, CLOUD IS EMPTY:
   *      The user is upgrading a guest account to a real one. Their local
   *      SQLite data has value and must go to the cloud — full-push it.
   *      This is the "I was using the app as a guest and just created an
   *      account" migration flow.
   *
   *   3. FIRST-EVER SIGN-IN ON THIS DEVICE, CLOUD HAS DATA:
   *      The user already has an account (from another device or a fresh
   *      reinstall). Cloud is authoritative — wipe local and pull. Any
   *      guest data the user accumulated here is discarded. (We don't try
   *      to merge two independent data sets automatically.)
   */
  async onSignInBootstrap(languagePair: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    const user = await authService.getCurrentUser();
    if (!user) return false;

    const lastUserId = await AsyncStorage.getItem(LAST_USER_ID_KEY);
    const isSameUser = lastUserId === user.id;

    if (isSameUser) {
      // Path 1 — app relaunch for a returning user.
      return this.push(languagePair, true);
    }

    // New user (or first sign-in ever on this device). Check if the cloud
    // already has data for them — that tells us whether to migrate local
    // guest data up (path 2) or wipe local and pull (path 3).
    const cloudHasData = await this.cloudHasDataForUser(user.id, languagePair);

    if (!cloudHasData) {
      // Path 2 — guest-to-account upgrade. Push local SQLite up to cloud.
      const ok = await this.push(languagePair, true);
      if (ok) {
        await AsyncStorage.setItem(LAST_USER_ID_KEY, user.id);
      }
      return ok;
    }

    // Path 3 — existing account with cloud data. Local guest data is
    // discarded; cloud wins.
    const ok = await this.pull(languagePair);
    if (ok) {
      await AsyncStorage.setItem(LAST_USER_ID_KEY, user.id);
    }
    return ok;
  }

  /**
   * Quick probe: does the cloud already hold any user data for this user?
   * We just need a yes/no answer so one lightweight count query is enough.
   */
  private async cloudHasDataForUser(
    userId: string,
    languagePair: string
  ): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('learned_words')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('language_pair', languagePair);
      if (error) {
        // On error be conservative — assume cloud has data so we don't
        // accidentally overwrite it with local-only guest data.
        console.warn('[cloudSync] cloudHasDataForUser probe failed:', error);
        return true;
      }
      if ((count ?? 0) > 0) return true;

      // learned_words is usually the biggest and earliest-populated table,
      // but if it's empty double-check custom_word_lists too — a user who
      // only used custom lists would have zero learned_words.
      const { count: listCount } = await supabase
        .from('custom_word_lists')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('language_pair', languagePair);
      return (listCount ?? 0) > 0;
    } catch (err) {
      console.warn('[cloudSync] cloudHasDataForUser threw:', err);
      return true;
    }
  }

  /**
   * Called before sign-out. Attempts a final full push so no unsaved
   * changes are lost. Local data is INTENTIONALLY preserved — the user
   * can keep using the app as a guest after signing out. If they sign
   * back in later (even a different account), onSignInBootstrap will
   * handle the migration/wipe decision.
   */
  async onSignOutCleanup(languagePair: string): Promise<void> {
    try {
      await this.push(languagePair, true);
    } catch {
      // ignore — best effort
    }
    // Note: we do NOT call dbService.wipeUserData here. The user might
    // keep using the app offline as a guest after logging out, and
    // deleting their progress would be a hostile surprise.
    await AsyncStorage.removeItem(LAST_SYNC_KEY);
    await AsyncStorage.removeItem(LAST_USER_ID_KEY);
    this.setState({ lastSyncAt: null, status: 'idle', error: null });
  }

  // ---------------------------------------------------------------------------
  // Internal: PUSH
  // ---------------------------------------------------------------------------

  /**
   * Push only the given set of tables to cloud, using full-replace semantics:
   * for each table we first DELETE every existing row for this user + language
   * pair, then INSERT the current local rows. This makes local deletes
   * propagate to the cloud — plain upsert would never remove stale rows.
   *
   * Each table runs in its own try/catch so a single failure doesn't block
   * the rest. If any table errors we throw at the end so the caller can mark
   * the sync as failed and retry later.
   *
   * The delete+insert is not a real transaction (Supabase REST API doesn't
   * expose one from the client), so there's a ~100ms window where the cloud
   * looks empty between the two calls. Fine for Memoro's single-user usage.
   */
  private async pushTables(
    userId: string,
    languagePair: string,
    tables: Set<SyncTable>
  ) {
    const errors: Array<{ table: string; error: any }> = [];

    const run = async (table: string, fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (err) {
        console.warn(`[cloudSync] push ${table} failed:`, err);
        errors.push({ table, error: err });
      }
    };

    // Helper that replaces all rows in a single table for (user, language).
    // If rows is empty, it still clears the cloud copy — that's how we
    // propagate "local is now empty" to cloud.
    const replaceTable = async (
      tableName: string,
      rows: any[],
      extraFilter?: (q: any) => any
    ) => {
      // 1. Delete current cloud rows for this user + language pair.
      let deleteQuery = supabase
        .from(tableName)
        .delete()
        .eq('user_id', userId)
        .eq('language_pair', languagePair);
      if (extraFilter) deleteQuery = extraFilter(deleteQuery);
      const { error: delErr } = await deleteQuery;
      if (delErr) throw delErr;

      // 2. Insert the new rows (if any).
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from(tableName).insert(rows);
        if (insErr) throw insErr;
      }
    };

    if (tables.has('learned_words')) {
      await run('learned_words', async () => {
        const learned = await dbService.getLearnedWordsRaw(languagePair);
        const rows = learned.map((w) => ({
          user_id: userId,
          word: w.word,
          meaning: w.meaning,
          example: w.example || null,
          level: w.level,
          learned_at: w.learnedAt,
          language_pair: languagePair,
        }));
        await replaceTable('learned_words', rows);
      });
    }

    if (tables.has('word_progress')) {
      await run('word_progress', async () => {
        const progress = await dbService.getWordProgressForSync(languagePair);
        const rows = progress.map((p) => ({
          user_id: userId,
          word: p.word,
          level: p.level,
          language_pair: languagePair,
          streak: p.streak,
        }));
        await replaceTable('word_progress', rows);
      });
    }

    // exercise_results and exercise_details are always written together —
    // pushing one without the other would leave orphan detail rows or
    // detail-less results. When either is dirty, re-push both.
    if (tables.has('exercise_results')) {
      const exerciseResults = await dbService.getExerciseResultsForSync(
        languagePair
      );

      await run('exercise_results', async () => {
        const rows = exerciseResults.map((r) => ({
          user_id: userId,
          client_id: r.id,
          exercise_type: r.exercise_type,
          score: r.score,
          total_questions: r.total_questions,
          date: r.date,
          language_pair: languagePair,
          word_source: r.word_source || null,
          level: r.level || null,
          word_list_id: r.word_list_id || null,
          word_list_name: r.word_list_name || null,
        }));
        await replaceTable('exercise_results', rows);
      });

      await run('exercise_details', async () => {
        const detailRows: any[] = [];
        for (const r of exerciseResults) {
          const d = await dbService.getExerciseDetails(r.id);
          if (d && d.details) {
            detailRows.push({
              user_id: userId,
              exercise_client_id: r.id,
              details: d.details,
              language_pair: languagePair,
            });
          }
        }
        await replaceTable('exercise_details', detailRows);
      });
    }

    // custom_word_lists and custom_word_list_items are pushed together for
    // the same reason — items reference lists by client_id, so they must
    // stay consistent on the cloud side.
    if (
      tables.has('custom_word_lists') ||
      tables.has('custom_word_list_items')
    ) {
      const lists = await dbService.getWordLists(languagePair);

      await run('custom_word_lists', async () => {
        const listRows = lists.map((l) => ({
          user_id: userId,
          client_id: l.id,
          name: l.name,
          created_at: l.created_at,
          language_pair: languagePair,
        }));
        await replaceTable('custom_word_lists', listRows);
      });

      await run('custom_word_list_items', async () => {
        const itemRows: any[] = [];
        for (const l of lists) {
          const items = await dbService.getWordListItemsForSync(l.id);
          for (const it of items) {
            itemRows.push({
              user_id: userId,
              list_client_id: l.id,
              word: it.word,
              meaning: it.meaning,
              example: it.example || null,
              level: it.level,
              added_at: it.added_at,
              variant_key: it.variant_key || '',
            });
          }
        }
        // custom_word_list_items has no language_pair column — its scope is
        // the parent list, which is already language-scoped. We delete all
        // items owned by this user whose list_client_id matches any of the
        // local lists, then re-insert. To keep the logic simple we delete
        // ALL items for the user and re-insert the full local set.
        const { error: delErr } = await supabase
          .from('custom_word_list_items')
          .delete()
          .eq('user_id', userId);
        if (delErr) throw delErr;
        if (itemRows.length > 0) {
          const { error: insErr } = await supabase
            .from('custom_word_list_items')
            .insert(itemRows);
          if (insErr) throw insErr;
        }
      });
    }

    if (tables.has('unfinished_exercises')) {
      await run('unfinished_exercises', async () => {
        const unfinished = await dbService.getUnfinishedExercises(languagePair);
        const rows = unfinished.map((ex) => ({
          user_id: userId,
          timestamp: ex.timestamp,
          language_pair: languagePair,
          exercise_type: ex.exerciseType,
          question_index: ex.questionIndex,
          total_questions: ex.totalQuestions,
          score: ex.score,
          asked_words: ex.askedWords,
          question_details: ex.questionDetails,
          word_source: ex.wordSource || null,
          level: ex.level || null,
          word_list_id: ex.wordListId || null,
          word_list_name: ex.wordListName || null,
          previous_type: ex.previousType || null,
        }));
        await replaceTable('unfinished_exercises', rows);
      });
    }

    if (tables.has('user_settings')) {
      // user_settings is a single row per user — upsert by user_id is fine,
      // no delete+insert dance needed.
      await run('user_settings', async () => {
        const settings = await this.collectSettings();
        const { error } = await supabase
          .from('user_settings')
          .upsert({ user_id: userId, data: settings });
        if (error) throw error;
      });
    }

    if (errors.length) {
      const first = errors[0];
      throw new Error(
        `${first.table}: ${first.error?.message || 'push failed'}`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: PULL
  // ---------------------------------------------------------------------------

  private async pullAll(userId: string, languagePair: string) {
    // learned_words
    const { data: learnedRows, error: learnedErr } = await supabase
      .from('learned_words')
      .select('*')
      .eq('user_id', userId)
      .eq('language_pair', languagePair);
    if (learnedErr) throw learnedErr;
    if (learnedRows && learnedRows.length) {
      await dbService.saveLearnedWords(
        learnedRows.map((r: any) => ({
          id: r.word,
          word: r.word,
          meaning: r.meaning,
          example: r.example || '',
          level: r.level,
          learnedAt: r.learned_at,
        })),
        languagePair
      );
    }

    // word_progress
    const { data: progressRows, error: progressErr } = await supabase
      .from('word_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('language_pair', languagePair);
    if (progressErr) throw progressErr;
    if (progressRows && progressRows.length) {
      await dbService.restoreWordProgress(
        progressRows.map((r: any) => ({
          word: r.word,
          level: r.level,
          streak: r.streak,
        })),
        languagePair
      );
    }

    // exercise_results + details
    // We preserve each row's original client_id as the local SQLite id so
    // follow-up pushes produce the same rows, not duplicates.
    const { data: resultRows, error: resultErr } = await supabase
      .from('exercise_results')
      .select('*')
      .eq('user_id', userId)
      .eq('language_pair', languagePair);
    if (resultErr) throw resultErr;
    if (resultRows && resultRows.length) {
      for (const r of resultRows as any[]) {
        await dbService.insertExerciseResultRaw(r.client_id, {
          exercise_type: r.exercise_type,
          score: r.score,
          total_questions: r.total_questions,
          date: r.date,
          language_pair: languagePair,
          word_source: r.word_source,
          level: r.level,
          word_list_id: r.word_list_id,
          word_list_name: r.word_list_name,
        });
      }
    }

    const { data: detailRows, error: detailErr } = await supabase
      .from('exercise_details')
      .select('*')
      .eq('user_id', userId)
      .eq('language_pair', languagePair);
    if (detailErr) throw detailErr;
    if (detailRows && detailRows.length) {
      for (const d of detailRows as any[]) {
        // exercise_client_id is the original SQLite id, which we just
        // reinserted above — so the FK link is intact.
        await dbService.saveExerciseDetails(
          d.exercise_client_id,
          d.details,
          languagePair
        );
      }
    }

    // custom_word_lists + items
    const { data: listRows, error: listErr } = await supabase
      .from('custom_word_lists')
      .select('*')
      .eq('user_id', userId)
      .eq('language_pair', languagePair);
    if (listErr) throw listErr;
    if (listRows && listRows.length) {
      for (const l of listRows as any[]) {
        await dbService.insertWordListRaw(
          l.client_id,
          l.name,
          l.created_at,
          languagePair
        );
      }
    }

    const { data: itemRows, error: itemErr } = await supabase
      .from('custom_word_list_items')
      .select('*')
      .eq('user_id', userId);
    if (itemErr) throw itemErr;
    if (itemRows && itemRows.length) {
      for (const it of itemRows as any[]) {
        await dbService.insertWordListItemRaw(it.list_client_id, {
          word: it.word,
          meaning: it.meaning,
          example: it.example || '',
          level: it.level,
          added_at: it.added_at,
          variant_key: it.variant_key || '',
        });
      }
    }

    // unfinished_exercises
    const { data: unfinishedRows, error: unfinishedErr } = await supabase
      .from('unfinished_exercises')
      .select('*')
      .eq('user_id', userId)
      .eq('language_pair', languagePair);
    if (unfinishedErr) throw unfinishedErr;
    if (unfinishedRows && unfinishedRows.length) {
      for (const ex of unfinishedRows as any[]) {
        await dbService.saveUnfinishedExercise({
          timestamp: ex.timestamp,
          languagePair: languagePair,
          exerciseType: ex.exercise_type,
          questionIndex: ex.question_index,
          totalQuestions: ex.total_questions,
          score: ex.score,
          askedWords: ex.asked_words,
          questionDetails: ex.question_details,
          wordSource: ex.word_source,
          level: ex.level,
          wordListId: ex.word_list_id,
          wordListName: ex.word_list_name,
          previousType: ex.previous_type,
        } as any);
      }
    }

    // user_settings
    const { data: settingsRow, error: settingsErr } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (settingsErr) throw settingsErr;
    if (settingsRow?.data && typeof settingsRow.data === 'object') {
      await this.restoreSettings(settingsRow.data);
    }
  }

  // ---------------------------------------------------------------------------
  // Settings helpers
  // ---------------------------------------------------------------------------

  private async collectSettings(): Promise<Record<string, any>> {
    const out: Record<string, any> = {};
    for (const key of SYNCED_SETTING_KEYS) {
      const v = await AsyncStorage.getItem(key);
      if (v !== null) {
        try {
          out[key] = JSON.parse(v);
        } catch {
          out[key] = v;
        }
      }
    }
    return out;
  }

  private async restoreSettings(data: Record<string, any>) {
    for (const [key, value] of Object.entries(data)) {
      if (!SYNCED_SETTING_KEYS.includes(key)) continue;
      const stringValue =
        typeof value === 'string' ? value : JSON.stringify(value);
      await AsyncStorage.setItem(key, stringValue);
    }
  }

  private async getCurrentLanguagePair(): Promise<string> {
    const native = (await AsyncStorage.getItem('selectedLanguage')) || 'tr';
    const learning = (await AsyncStorage.getItem('learningLanguage')) || 'en';
    return `${learning}-${native}`;
  }
}

export const cloudSync = new CloudSyncService();
