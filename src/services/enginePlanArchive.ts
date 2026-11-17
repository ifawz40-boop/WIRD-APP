import type { EngineGeneratedPlan } from './planningEngine';
import {
  IndexedDbSyncJournal,
  STORE_ENGINE_PLAN_ARCHIVE_HEADS,
  STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS,
  STORE_ENGINE_PLAN_ARCHIVE_RECORDS,
  type JournalEnqueueResult,
  type JournalMutationInput
} from './indexedDbSyncJournal';
import { isValidEngineGeneratedPlan, StorageService } from './storageService';

export const ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION = 1;

export interface EnginePlanArchiveHead {
  scopeKey: string;
  committedRevision: number;
  legacyMigrated: boolean;
  legacyFingerprint?: string;
  updatedAtMs: number;
  schemaVersion: typeof ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION;
}

export interface EnginePlanArchiveManifest {
  scopeKey: string;
  revision: number;
  parentRevision: number | null;
  status: 'staged' | 'committed';
  recordCount: number;
  orderedRecordIds: string[];
  fingerprintAlgorithm: 'SHA-256';
  fingerprint: string;
  mutationId?: string;
  createdAtMs: number;
  schemaVersion: typeof ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION;
}

export interface EnginePlanArchiveRecordRow {
  scopeKey: string;
  revision: number;
  ordinal: number;
  recordId: string;
  record: EngineGeneratedPlan;
  schemaVersion: typeof ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION;
}

export interface EnginePlanArchiveOptions {
  journal?: IndexedDbSyncJournal;
  databaseName?: string;
  indexedDBFactory?: IDBFactory;
}

export interface EnginePlanArchiveHydrationResult {
  scopeKey: string;
  revision: number;
  fingerprint: string;
  records: EngineGeneratedPlan[];
  migratedFromLegacy: boolean;
}

export function isValidArchiveScopeKey(scopeKey: unknown): scopeKey is string {
  if (typeof scopeKey !== 'string') return false;
  if (scopeKey === 'guest') return true;
  if (!scopeKey.startsWith('user:')) return false;
  const uid = scopeKey.slice('user:'.length);
  return uid.length > 0 && uid.length <= 128 && !/[\u0000-\u001f]/.test(uid);
}

/** Deterministic canonical JSON serialization rejecting NaN/Infinity, sparse arrays, and cycles. */
export function canonicalArchiveSerialize(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null) return 'null';
  const kind = typeof value;
  if (kind === 'string' || kind === 'boolean') return JSON.stringify(value);
  if (kind === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new Error('يحتوي أرشيف الخطط على قيمة رقمية غير منتهية (NaN أو Infinity).');
    }
    return JSON.stringify(value);
  }
  if (kind === 'undefined') return 'undefined';
  if (kind !== 'object') {
    throw new Error('نوع غير مدعوم في تسلسل أرشيف الخطط.');
  }

  const obj = value as object;
  if (seen.has(obj)) {
    throw new Error('مرجع دائري غير مدعوم داخل سجل الخطط.');
  }
  seen.add(obj);
  try {
    if (Array.isArray(obj)) {
      const parts: string[] = [];
      for (let i = 0; i < obj.length; i++) {
        if (!(i in obj)) {
          throw new Error('مصفوفة غير متصلة (sparse array) غير مدعومة في أرشيف الخطط.');
        }
        const serialized = canonicalArchiveSerialize(obj[i], seen);
        parts.push(serialized === 'undefined' ? 'null' : serialized);
      }
      return '[' + parts.join(',') + ']';
    }
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const entries: string[] = [];
    for (const key of keys) {
      const serialized = canonicalArchiveSerialize(record[key], seen);
      if (serialized !== 'undefined') {
        entries.push(JSON.stringify(key) + ':' + serialized);
      }
    }
    return '{' + entries.join(',') + '}';
  } finally {
    seen.delete(obj);
  }
}

export async function computeArchiveSha256Hex(payload: string): Promise<string> {
  const bytes = new TextEncoder().encode(payload);
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('واجهة التشفير Web Crypto SHA-256 غير متاحة للتحقق من سلامة الأرشيف.');
  }
  const digest = await cryptoObj.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function validateArchiveEnginePlans(records: unknown): EngineGeneratedPlan[] {
  if (!Array.isArray(records)) {
    throw new Error('بيانات الخطط الذكية يجب أن تكون مصفوفة صالحة.');
  }
  const seenIds = new Set<string>();
  const normalized: EngineGeneratedPlan[] = [];
  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    if (!isValidEngineGeneratedPlan(item)) {
      throw new Error(`سجل الخطة رقم ${i + 1} غير صالح أو يحتوي قيماً تالفة.`);
    }
    if (seenIds.has(item.id)) {
      throw new Error(`يوجد تكرار في معرّف الخطة الذكية (${item.id}).`);
    }
    seenIds.add(item.id);
    // Validate deterministic serializability & clone cleanly
    const canonical = canonicalArchiveSerialize(item);
    normalized.push(JSON.parse(canonical) as EngineGeneratedPlan);
  }
  return normalized;
}

export async function computeEnginePlansFingerprint(
  scopeKey: string,
  revision: number,
  records: EngineGeneratedPlan[]
): Promise<{ fingerprint: string; orderedRecordIds: string[] }> {
  const orderedRecordIds = records.map(r => r.id);
  const envelope = canonicalArchiveSerialize({
    archiveSchemaVersion: ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION,
    scopeKey,
    revision,
    recordCount: records.length,
    orderedRecordIds,
    records
  });
  const fingerprint = await computeArchiveSha256Hex(envelope);
  return { fingerprint, orderedRecordIds };
}

function getJournalInstance(options: EnginePlanArchiveOptions): {
  journal: IndexedDbSyncJournal;
  ownsJournal: boolean;
} {
  if (options.journal) return { journal: options.journal, ownsJournal: false };
  return {
    journal: new IndexedDbSyncJournal({
      databaseName: options.databaseName,
      indexedDBFactory: options.indexedDBFactory
    }),
    ownsJournal: true
  };
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('فشلت عملية قراءة IndexedDB للأرشيف.'));
  });
}

function idbTxComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => {
      const err = tx.error;
      if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'QuotaExceededError') {
        reject(new Error('مساحة التخزين المحلية ممتلئة؛ لم يتم حفظ تعديل أرشيف الخطط وحُفظت النسخة السابقة.'));
        return;
      }
      reject(err instanceof Error ? err : new Error('توقفت معاملة أرشيف الخطط دون إتمام.'));
    };
    tx.onerror = () => { /* handled by onabort */ };
  });
}

async function readHeadAndRevisionRaw(
  db: IDBDatabase,
  scopeKey: string,
  revision?: number
): Promise<{
  head: EnginePlanArchiveHead | undefined;
  manifest: EnginePlanArchiveManifest | undefined;
  rows: EnginePlanArchiveRecordRow[];
}> {
  const tx = db.transaction(
    [STORE_ENGINE_PLAN_ARCHIVE_HEADS, STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS, STORE_ENGINE_PLAN_ARCHIVE_RECORDS],
    'readonly'
  );
  const completed = idbTxComplete(tx);
  const headsStore = tx.objectStore(STORE_ENGINE_PLAN_ARCHIVE_HEADS);
  const manifestsStore = tx.objectStore(STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS);
  const recordsStore = tx.objectStore(STORE_ENGINE_PLAN_ARCHIVE_RECORDS);

  const head = (await idbRequest(headsStore.get(scopeKey))) as EnginePlanArchiveHead | undefined;
  const targetRev = revision !== undefined ? revision : head?.committedRevision;
  if (targetRev === undefined || !Number.isSafeInteger(targetRev) || targetRev < 0) {
    await completed;
    return { head, manifest: undefined, rows: [] };
  }

  const manifest = (await idbRequest(manifestsStore.get([scopeKey, targetRev]))) as EnginePlanArchiveManifest | undefined;
  const rows = (await idbRequest(
    recordsStore.index('scopeRevision').getAll(IDBKeyRange.only([scopeKey, targetRev]))
  )) as EnginePlanArchiveRecordRow[];
  await completed;
  return { head, manifest, rows };
}

async function verifyManifestAndRows(
  scopeKey: string,
  expectedRevision: number,
  manifest: EnginePlanArchiveManifest | undefined,
  rows: EnginePlanArchiveRecordRow[],
  requireCommitted: boolean
): Promise<EngineGeneratedPlan[]> {
  if (!manifest) {
    throw new Error(`بيان المراجعة رقم ${expectedRevision} لأرشيف الخطط مفقود.`);
  }
  if (manifest.scopeKey !== scopeKey || manifest.revision !== expectedRevision) {
    throw new Error('بيان أرشيف الخطط لا يطابق النطاق أو رقم المراجعة المطلوب.');
  }
  if (requireCommitted && manifest.status !== 'committed') {
    throw new Error(`المراجعة رقم ${expectedRevision} غير معتمدة (حالة غير مكتملة).`);
  }
  if (!Array.isArray(manifest.orderedRecordIds) || manifest.orderedRecordIds.length !== manifest.recordCount) {
    throw new Error('تضارب عدد سجلات الخطط مع قائمة المعرّفات المرتبة في البيان.');
  }
  if (rows.length !== manifest.recordCount) {
    throw new Error(`عدد سجلات الخطط المسترجعة (${rows.length}) لا يطابق البيان (${manifest.recordCount}).`);
  }

  const sortedRows = [...rows].sort((a, b) => a.ordinal - b.ordinal);
  const records: EngineGeneratedPlan[] = [];
  for (let i = 0; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    if (row.scopeKey !== scopeKey || row.revision !== expectedRevision ||
        row.ordinal !== i || row.recordId !== manifest.orderedRecordIds[i]) {
      throw new Error('تلف في ترتيب أو معرّف سجلات الخطط داخل أرشيف IndexedDB.');
    }
    if (!isValidEngineGeneratedPlan(row.record) || row.record.id !== row.recordId) {
      throw new Error(`سجل الخطة ${row.recordId} تالف أو غير مطابق لمعرّفه.`);
    }
    records.push(row.record);
  }

  const { fingerprint, orderedRecordIds } = await computeEnginePlansFingerprint(
    scopeKey,
    expectedRevision,
    records
  );
  if (fingerprint !== manifest.fingerprint ||
      JSON.stringify(orderedRecordIds) !== JSON.stringify(manifest.orderedRecordIds)) {
    throw new Error('فشل التحقق من بصمة SHA-256 لأرشيف الخطط؛ تم إيقاف التحميل لحماية البيانات.');
  }

  return records;
}

/** Verify and read a specific revision of the Engine Plans archive. */
export async function verifyEnginePlansArchiveRevision(
  scopeKey: string,
  revision: number,
  options: EnginePlanArchiveOptions & { requireCommitted?: boolean } = {}
): Promise<{ valid: boolean; records: EngineGeneratedPlan[]; manifest?: EnginePlanArchiveManifest; error?: string }> {
  if (!isValidArchiveScopeKey(scopeKey) || !Number.isSafeInteger(revision) || revision < 0) {
    return { valid: false, records: [], error: 'نطاق أو رقم مراجعة غير صالح لأرشيف الخطط.' };
  }
  const { journal, ownsJournal } = getJournalInstance(options);
  try {
    const db = await journal.getArchiveDatabase();
    const { manifest, rows } = await readHeadAndRevisionRaw(db, scopeKey, revision);
    const records = await verifyManifestAndRows(
      scopeKey,
      revision,
      manifest,
      rows,
      options.requireCommitted !== false
    );
    return { valid: true, records, manifest };
  } catch (error) {
    return {
      valid: false,
      records: [],
      error: error instanceof Error ? error.message : 'تعذر التحقق من مراجعة أرشيف الخطط.'
    };
  } finally {
    if (ownsJournal) journal.close();
  }
}

/** Read and verify the currently committed Engine Plans snapshot for a scope. */
export async function readCommittedEnginePlansArchive(
  scopeKey: string,
  options: EnginePlanArchiveOptions = {}
): Promise<{ revision: number; fingerprint: string; records: EngineGeneratedPlan[] } | null> {
  if (!isValidArchiveScopeKey(scopeKey)) {
    throw new Error('نطاق حساب غير صالح لقراءة أرشيف الخطط.');
  }
  const { journal, ownsJournal } = getJournalInstance(options);
  try {
    const db = await journal.getArchiveDatabase();
    const { head, manifest, rows } = await readHeadAndRevisionRaw(db, scopeKey);
    if (!head) return null;
    const records = await verifyManifestAndRows(scopeKey, head.committedRevision, manifest, rows, true);
    return {
      revision: head.committedRevision,
      fingerprint: manifest!.fingerprint,
      records
    };
  } finally {
    if (ownsJournal) journal.close();
  }
}

/**
 * AuthGate startup hydration & lossless copy->verify->mark migration for one scope.
 * Never mutates or deletes the legacy localStorage source copy.
 */
export async function initializeEnginePlansArchiveForScope(
  scopeKey: string,
  options: EnginePlanArchiveOptions = {}
): Promise<EnginePlanArchiveHydrationResult> {
  if (!isValidArchiveScopeKey(scopeKey)) {
    throw new Error('نطاق الحساب غير صالح لتهيئة أرشيف الخطط.');
  }

  // Always clear stale in-memory cache first so no prior account data can leak.
  StorageService.clearHydratedEnginePlansCache();

  const { journal, ownsJournal } = getJournalInstance(options);
  try {
    const db = await journal.getArchiveDatabase();
    const existing = await readHeadAndRevisionRaw(db, scopeKey);

    if (existing.head) {
      const records = await verifyManifestAndRows(
        scopeKey,
        existing.head.committedRevision,
        existing.manifest,
        existing.rows,
        true
      );
      if (StorageService.getStorageScope() === scopeKey) {
        StorageService.setHydratedEnginePlansSnapshot(
          scopeKey,
          records,
          existing.head.committedRevision,
          existing.manifest!.fingerprint
        );
      }
      return {
        scopeKey,
        revision: existing.head.committedRevision,
        fingerprint: existing.manifest!.fingerprint,
        records,
        migratedFromLegacy: false
      };
    }

    // No archive head yet: read scoped legacy localStorage bytes strictly without modifying them.
    const { raw } = StorageService.readRawEnginePlansLegacyBytes();
    if (raw === null) {
      const revision = 0;
      const { fingerprint, orderedRecordIds } = await computeEnginePlansFingerprint(scopeKey, revision, []);
      const now = Date.now();
      const manifest: EnginePlanArchiveManifest = {
        scopeKey,
        revision,
        parentRevision: null,
        status: 'committed',
        recordCount: 0,
        orderedRecordIds,
        fingerprintAlgorithm: 'SHA-256',
        fingerprint,
        createdAtMs: now,
        schemaVersion: ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION
      };
      const head: EnginePlanArchiveHead = {
        scopeKey,
        committedRevision: revision,
        legacyMigrated: false,
        updatedAtMs: now,
        schemaVersion: ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION
      };
      const tx = db.transaction([STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS, STORE_ENGINE_PLAN_ARCHIVE_HEADS], 'readwrite');
      tx.objectStore(STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS).put(manifest);
      tx.objectStore(STORE_ENGINE_PLAN_ARCHIVE_HEADS).put(head);
      await idbTxComplete(tx);

      if (StorageService.getStorageScope() === scopeKey) {
        StorageService.setHydratedEnginePlansSnapshot(scopeKey, [], revision, fingerprint);
      }
      return { scopeKey, revision, fingerprint, records: [], migratedFromLegacy: false };
    }

    // Strict parse & validate legacy bytes (fail closed if corrupt)
    let parsedLegacy: unknown;
    try {
      parsedLegacy = JSON.parse(raw);
    } catch {
      throw new Error('سجل الخطط الذكية القديم تالف (JSON غير صالح)؛ تم الحفاظ على بايتاته دون ترحيل.');
    }
    const validatedPlans = validateArchiveEnginePlans(parsedLegacy);
    const revision = 1;
    const { fingerprint, orderedRecordIds } = await computeEnginePlansFingerprint(scopeKey, revision, validatedPlans);
    const legacyFingerprint = await computeArchiveSha256Hex(raw);
    const now = Date.now();

    // Stage 1 (copy): write staged manifest + individual records without moving head yet
    const stagedManifest: EnginePlanArchiveManifest = {
      scopeKey,
      revision,
      parentRevision: null,
      status: 'staged',
      recordCount: validatedPlans.length,
      orderedRecordIds,
      fingerprintAlgorithm: 'SHA-256',
      fingerprint,
      mutationId: 'legacy-migration-v1',
      createdAtMs: now,
      schemaVersion: ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION
    };
    const txStage = db.transaction([STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS, STORE_ENGINE_PLAN_ARCHIVE_RECORDS], 'readwrite');
    txStage.objectStore(STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS).put(stagedManifest);
    const recordsStore = txStage.objectStore(STORE_ENGINE_PLAN_ARCHIVE_RECORDS);
    for (let ordinal = 0; ordinal < validatedPlans.length; ordinal++) {
      const rec = validatedPlans[ordinal];
      recordsStore.put({
        scopeKey,
        revision,
        ordinal,
        recordId: rec.id,
        record: rec,
        schemaVersion: ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION
      } satisfies EnginePlanArchiveRecordRow);
    }
    await idbTxComplete(txStage);

    // Stage 2 (verify): independent read-back verification before committing head
    const readback = await readHeadAndRevisionRaw(db, scopeKey, revision);
    const verifiedRecords = await verifyManifestAndRows(scopeKey, revision, readback.manifest, readback.rows, false);
    if (readback.manifest?.fingerprint !== fingerprint) {
      throw new Error('عدم تطابق بصمة التحقق أثناء ترحيل أرشيف الخطط.');
    }

    // Stage 3 (mark): mark revision committed & record head without touching localStorage
    const committedManifest: EnginePlanArchiveManifest = { ...stagedManifest, status: 'committed' };
    const head: EnginePlanArchiveHead = {
      scopeKey,
      committedRevision: revision,
      legacyMigrated: true,
      legacyFingerprint,
      updatedAtMs: Date.now(),
      schemaVersion: ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION
    };
    const txCommit = db.transaction([STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS, STORE_ENGINE_PLAN_ARCHIVE_HEADS], 'readwrite');
    txCommit.objectStore(STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS).put(committedManifest);
    txCommit.objectStore(STORE_ENGINE_PLAN_ARCHIVE_HEADS).put(head);
    await idbTxComplete(txCommit);

    if (StorageService.getStorageScope() === scopeKey) {
      StorageService.setHydratedEnginePlansSnapshot(scopeKey, verifiedRecords, revision, fingerprint);
    }
    return {
      scopeKey,
      revision,
      fingerprint,
      records: verifiedRecords,
      migratedFromLegacy: true
    };
  } finally {
    if (ownsJournal) journal.close();
  }
}

/**
 * Commit a new immutable Engine Plans archive revision, optionally atomically inside
 * the same IndexedDB transaction as a journal event + outbox entry.
 */
export async function commitEnginePlansArchiveRevision(
  scopeKey: string,
  plans: EngineGeneratedPlan[],
  options: EnginePlanArchiveOptions & {
    expectedRevision?: number | null;
    mutationId?: string;
    journalMutation?: JournalMutationInput;
    deferLocalProjection?: boolean;
  } = {}
): Promise<{
  revision: number;
  fingerprint: string;
  records: EngineGeneratedPlan[];
  journalResult?: JournalEnqueueResult;
}> {
  if (!isValidArchiveScopeKey(scopeKey)) {
    throw new Error('نطاق حساب غير صالح لحفظ أرشيف الخطط.');
  }
  const validatedPlans = validateArchiveEnginePlans(plans);
  const { journal, ownsJournal } = getJournalInstance(options);
  try {
    const db = await journal.getArchiveDatabase();
    const { head } = await readHeadAndRevisionRaw(db, scopeKey);
    const currentRevision = head ? head.committedRevision : 0;
    const expectedRevision = options.expectedRevision !== undefined ? options.expectedRevision : currentRevision;
    const newRevision = (expectedRevision ?? currentRevision) + 1;

    const { fingerprint, orderedRecordIds } = await computeEnginePlansFingerprint(
      scopeKey,
      newRevision,
      validatedPlans
    );
    const now = Date.now();
    const manifest: EnginePlanArchiveManifest = {
      scopeKey,
      revision: newRevision,
      parentRevision: head ? head.committedRevision : null,
      status: 'committed',
      recordCount: validatedPlans.length,
      orderedRecordIds,
      fingerprintAlgorithm: 'SHA-256',
      fingerprint,
      mutationId: options.mutationId ?? options.journalMutation?.mutationId,
      createdAtMs: now,
      schemaVersion: ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION
    };
    const nextHead: EnginePlanArchiveHead = {
      scopeKey,
      committedRevision: newRevision,
      legacyMigrated: head?.legacyMigrated ?? false,
      ...(head?.legacyFingerprint ? { legacyFingerprint: head.legacyFingerprint } : {}),
      updatedAtMs: now,
      schemaVersion: ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION
    };

    const txRes = await journal.commitEnginePlanArchiveTransaction({
      scopeKey,
      expectedRevision,
      newRevision,
      manifest: manifest as unknown as Record<string, unknown>,
      records: validatedPlans,
      head: nextHead as unknown as Record<string, unknown>,
      journalMutation: options.journalMutation
    });

    if (!options.deferLocalProjection && !options.journalMutation && StorageService.getStorageScope() === scopeKey) {
      StorageService.setHydratedEnginePlansSnapshot(scopeKey, validatedPlans, newRevision, fingerprint);
      // Keep compatibility rollback key updated only when safe & <= 100 plans
      if (validatedPlans.length <= 100) {
        StorageService.saveEnginePlans(validatedPlans);
      }
    }

    return {
      revision: newRevision,
      fingerprint,
      records: validatedPlans,
      journalResult: txRes.journalResult
    };
  } finally {
    if (ownsJournal) journal.close();
  }
}

/** Verify and roll back head pointer to an earlier immutable revision without deleting newer data. */
export async function rollbackEnginePlansArchiveRevision(
  scopeKey: string,
  targetRevision: number,
  options: EnginePlanArchiveOptions = {}
): Promise<{ revision: number; fingerprint: string; records: EngineGeneratedPlan[] }> {
  if (!isValidArchiveScopeKey(scopeKey) || !Number.isSafeInteger(targetRevision) || targetRevision < 0) {
    throw new Error('بيانات الرجوع لإصدار أرشيف الخطط غير صالحة.');
  }
  const { journal, ownsJournal } = getJournalInstance(options);
  try {
    const verification = await verifyEnginePlansArchiveRevision(scopeKey, targetRevision, {
      journal,
      requireCommitted: true
    });
    if (!verification.valid || !verification.manifest) {
      throw new Error(verification.error || 'تعذر التحقق من الإصدار المستهدف للرجوع.');
    }
    const db = await journal.getArchiveDatabase();
    const { head } = await readHeadAndRevisionRaw(db, scopeKey);
    const nextHead: EnginePlanArchiveHead = {
      scopeKey,
      committedRevision: targetRevision,
      legacyMigrated: head?.legacyMigrated ?? false,
      ...(head?.legacyFingerprint ? { legacyFingerprint: head.legacyFingerprint } : {}),
      updatedAtMs: Date.now(),
      schemaVersion: ENGINE_PLAN_ARCHIVE_SCHEMA_VERSION
    };
    const tx = db.transaction([STORE_ENGINE_PLAN_ARCHIVE_HEADS], 'readwrite');
    tx.objectStore(STORE_ENGINE_PLAN_ARCHIVE_HEADS).put(nextHead);
    await idbTxComplete(tx);

    if (StorageService.getStorageScope() === scopeKey) {
      StorageService.setHydratedEnginePlansSnapshot(
        scopeKey,
        verification.records,
        targetRevision,
        verification.manifest.fingerprint
      );
      if (verification.records.length <= 100) {
        StorageService.saveEnginePlans(verification.records);
      }
    }
    return {
      revision: targetRevision,
      fingerprint: verification.manifest.fingerprint,
      records: verification.records
    };
  } finally {
    if (ownsJournal) journal.close();
  }
}

/** Async verified snapshot reader used exclusively by exportFullBackupVerified(). */
export async function exportVerifiedEnginePlansSnapshot(
  scopeKey: string,
  options: EnginePlanArchiveOptions = {}
): Promise<{ revision: number; fingerprint: string; records: EngineGeneratedPlan[] } | null> {
  return readCommittedEnginePlansArchive(scopeKey, options);
}
