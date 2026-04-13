/**
 * Dexie IndexedDB Schema — Hello-EQ
 *
 * All user-facing tables store `EncryptedRow` values whose `blob` field
 * contains the AES-GCM–encrypted JSON produced by encryptionService.ts.
 * The Dexie indexes only touch non-sensitive metadata (id, collectionId,
 * updatedAt) so that queries can be performed without decryption.
 *
 * Table overview:
 *   keyvalue            – singleton collection blobs (settings, aiState, llmMemory)
 *   emotions            – one row per EmotionEntry
 *   events              – one row per CareerEvent
 *   reflections         – one row per JournalReflection
 *   actions             – one row per MicroAction
 *   goals               – one row per Goal
 *   exercises           – one row per TasteExercise
 *   users               – one row per UserProfile (collectionId = 'profile')
 *   exercise_evaluations– one row per PMGraphEvaluationRecord (added v3)
 *
 * Schema versions:
 *   v1 — initial schema (keyvalue, emotions, events, reflections, actions, goals, exercises)
 *   v2 — added decisions, workModes
 *   v3 — added exercise_evaluations (PM Graph-backed evaluation results)
 */

import Dexie, { type Table } from 'dexie';
import type { EncryptedBlob } from './encryptionService';

// ── Row shapes ────────────────────────────────────────────────────────────────

/** A single encrypted entity row. */
export interface EncryptedRow {
  /** Stable entity id (e.g. 'emo_123'). For singletons use the constant key. */
  id: string;
  /** AES-GCM ciphertext + IV produced by encryptionService.encrypt(). */
  blob: EncryptedBlob;
  /** ISO timestamp — allows pruning/sorting without decryption. */
  updatedAt: string;
}

/**
 * Evaluation row — extends EncryptedRow with one unencrypted index field.
 *
 * `hello_eq_exercise_id` is stored in plaintext so that evaluations for a
 * specific friction case can be queried without decrypting every row.
 * All other evaluation fields (scores, signals, etc.) live in the encrypted blob.
 */
export interface EvaluationRow extends EncryptedRow {
  /** Plaintext index — the FrictionCase ID this evaluation belongs to. */
  hello_eq_exercise_id: string;
}

// Singleton keys used in the keyvalue table.
export const KV_SETTINGS  = 'settings'  as const;
export const KV_AI_STATE  = 'aiState'   as const;
export const KV_LLM_MEMORY = 'llmMemory' as const;
export const KV_USER      = 'user'      as const;

// ── Database class ────────────────────────────────────────────────────────────

class HEQDatabase extends Dexie {
  /** Key-value singletons: settings, aiState, llmMemory, user. */
  keyvalue!: Table<EncryptedRow, string>;

  emotions!:    Table<EncryptedRow, string>;
  events!:      Table<EncryptedRow, string>;
  reflections!: Table<EncryptedRow, string>;
  actions!:     Table<EncryptedRow, string>;
  goals!:       Table<EncryptedRow, string>;
  exercises!:   Table<EncryptedRow, string>;
  decisions!:   Table<EncryptedRow, string>;
  workModes!:   Table<EncryptedRow, string>;

  /**
   * PM Graph-backed evaluation results.
   * Uses EvaluationRow so hello_eq_exercise_id is an indexed, unencrypted
   * field while all score/signal data lives in the encrypted blob.
   */
  exercise_evaluations!: Table<EvaluationRow, string>;

  constructor() {
    super('hello-eq-db-v1');

    this.version(1).stores({
      keyvalue:    'id',
      emotions:    'id, updatedAt',
      events:      'id, updatedAt',
      reflections: 'id, updatedAt',
      actions:     'id, updatedAt',
      goals:       'id, updatedAt',
      exercises:   'id, updatedAt',
    });

    this.version(2).stores({
      keyvalue:    'id',
      emotions:    'id, updatedAt',
      events:      'id, updatedAt',
      reflections: 'id, updatedAt',
      actions:     'id, updatedAt',
      goals:       'id, updatedAt',
      exercises:   'id, updatedAt',
      decisions:   'id, updatedAt',
      workModes:   'id, updatedAt',
    });

    this.version(3).stores({
      keyvalue:             'id',
      emotions:             'id, updatedAt',
      events:               'id, updatedAt',
      reflections:          'id, updatedAt',
      actions:              'id, updatedAt',
      goals:                'id, updatedAt',
      exercises:            'id, updatedAt',
      decisions:            'id, updatedAt',
      workModes:            'id, updatedAt',
      // hello_eq_exercise_id is a plaintext index — see EvaluationRow.
      exercise_evaluations: 'id, updatedAt, hello_eq_exercise_id',
    });
  }
}

export const db = new HEQDatabase();

// ── Generic encrypted CRUD helpers ───────────────────────────────────────────

import { encrypt, decrypt } from './encryptionService';

/** Write (upsert) a single encrypted entity to a table. */
export async function dbPut<T>(
  table: Table<EncryptedRow, string>,
  id: string,
  value: T,
): Promise<void> {
  const blob = await encrypt(value);
  await table.put({ id, blob, updatedAt: new Date().toISOString() });
}

/** Read and decrypt a single entity, returning null if absent. */
export async function dbGet<T>(
  table: Table<EncryptedRow, string>,
  id: string,
): Promise<T | null> {
  const row = await table.get(id);
  if (!row) return null;
  return decrypt<T>(row.blob);
}

/** Read and decrypt all rows in a table, sorted by updatedAt descending. */
export async function dbGetAll<T>(
  table: Table<EncryptedRow, string>,
): Promise<T[]> {
  const rows = await table.orderBy('updatedAt').reverse().toArray();
  return Promise.all(rows.map(r => decrypt<T>(r.blob)));
}

/** Delete a single row by id. */
export async function dbDelete(
  table: Table<EncryptedRow, string>,
  id: string,
): Promise<void> {
  await table.delete(id);
}

/** Replace all rows in a table with a new array of entities (each must have an `id`). */
export async function dbReplaceAll<T extends { id: string }>(
  table: Table<EncryptedRow, string>,
  items: T[],
): Promise<void> {
  const now = new Date().toISOString();
  const rows = await Promise.all(
    items.map(async item => {
      const blob = await encrypt(item);
      return { id: item.id, blob, updatedAt: now } satisfies EncryptedRow;
    }),
  );
  await table.clear();
  await table.bulkPut(rows);
}

/**
 * Write (upsert) a single EvaluationRow — like dbPut but preserves the
 * plaintext hello_eq_exercise_id index field alongside the encrypted blob.
 */
export async function dbPutEvaluation<T>(
  table: Table<EvaluationRow, string>,
  id: string,
  exerciseId: string,
  value: T,
): Promise<void> {
  const blob = await encrypt(value);
  await table.put({
    id,
    blob,
    updatedAt:             new Date().toISOString(),
    hello_eq_exercise_id:  exerciseId,
  });
}

/**
 * Read and decrypt all EvaluationRows that belong to a specific exercise,
 * sorted by updatedAt descending.
 */
export async function dbGetEvaluationsByExercise<T>(
  table: Table<EvaluationRow, string>,
  exerciseId: string,
): Promise<T[]> {
  const rows = await table
    .where('hello_eq_exercise_id')
    .equals(exerciseId)
    .reverse()
    .sortBy('updatedAt');
  return Promise.all(rows.map(r => decrypt<T>(r.blob)));
}

// ── Migration helper: import from legacy localStorage ────────────────────────

/**
 * One-time migration from the old `eicos_*` localStorage keys into Dexie.
 * Safe to call on every startup — it exits immediately if migration is already done.
 */
export async function migrateFromLocalStorage(): Promise<void> {
  const MIGRATION_FLAG = 'heq_migrated_to_idb_v1';
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const legacy: Record<string, string> = {
    user:          'eicos_user_profile',
    emotions:      'eicos_emotions',
    events:        'eicos_events',
    actions:       'eicos_actions',
    reflections:   'eicos_reflections',
    goals:         'eicos_goals',
    exercises:     'eicos_taste_exercises',
    settings:      'eicos_settings',
    aiUsageCount:  'eicos_ai_usage_count',
    aiUnlocked:    'eicos_ai_unlocked',
    llmMemory:     'eicos_llm_memory',
  };

  try {
    // Migrate user
    const rawUser = localStorage.getItem(legacy.user);
    if (rawUser) {
      const user = JSON.parse(rawUser) as { id: string };
      await dbPut(db.keyvalue, KV_USER, user);
    }

    // Migrate settings + aiState into keyvalue
    const rawSettings = localStorage.getItem(legacy.settings);
    if (rawSettings) await dbPut(db.keyvalue, KV_SETTINGS, JSON.parse(rawSettings));

    const aiUsageCount = localStorage.getItem(legacy.aiUsageCount);
    const aiUnlocked   = localStorage.getItem(legacy.aiUnlocked);
    await dbPut(db.keyvalue, KV_AI_STATE, {
      aiUsageCount: aiUsageCount ? (JSON.parse(aiUsageCount) as number) : 0,
      aiUnlocked:   aiUnlocked   ? (JSON.parse(aiUnlocked)  as boolean) : false,
    });

    // Migrate arrays
    const migrate = async <T extends { id: string }>(
      table: Table<EncryptedRow, string>,
      key: string,
    ) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const items = JSON.parse(raw) as T[];
      if (Array.isArray(items) && items.length > 0) await dbReplaceAll(table, items);
    };

    await migrate(db.emotions,    legacy.emotions);
    await migrate(db.events,      legacy.events);
    await migrate(db.actions,     legacy.actions);
    await migrate(db.reflections, legacy.reflections);
    await migrate(db.goals,       legacy.goals);
    await migrate(db.exercises,   legacy.exercises);

    // Migrate LLM memory singleton
    const rawMemory = localStorage.getItem(legacy.llmMemory);
    if (rawMemory) await dbPut(db.keyvalue, KV_LLM_MEMORY, JSON.parse(rawMemory));

    // Mark migration complete and clean up legacy keys
    localStorage.setItem(MIGRATION_FLAG, 'true');
    Object.values(legacy).forEach(k => localStorage.removeItem(k));
    // heq_control_focus and heq_ideal_scenario contain non-sensitive planning
    // data and are still read directly by components — leave them in localStorage.
  } catch (err) {
    console.warn('[HEQ] LocalStorage migration failed — starting fresh', err);
    localStorage.setItem(MIGRATION_FLAG, 'true'); // don't retry on failure
  }
}
