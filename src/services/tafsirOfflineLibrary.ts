import { ALL_SURAHS } from '../data/quranMeta';

export const OFFLINE_TAFSIR_SOURCE = {
  translationKey: 'arabic_moyassar',
  version: '1.0.1',
  releaseDate: '2026-11-09',
  publisher: 'مجمع الملك فهد لطباعة المصحف الشريف بالمدينة المنورة',
  source: 'QuranEnc.com',
  endpoint: 'https://quranenc.com/api/v1/translation/sura'
} as const;

const DB_NAME = 'wird-offline-tafsir';
const DB_VERSION = 1;
const SURAH_STORE = 'surahs';
const META_STORE = 'metadata';
const META_KEY = 'manifest';
const TOTAL_SURAHS = 114;

export interface QuranEncTafsirRow {
  sura: number | string;
  aya: number | string;
  translation: string;
  footnotes?: unknown;
  [key: string]: unknown;
}

interface StoredSurah {
  surahNumber: number;
  sourceVersion: string;
  savedAt: string;
  payload: unknown;
}

interface StoredManifest {
  key: string;
  sourceVersion: string;
  downloadedSurahs: number[];
  status: 'downloading' | 'paused' | 'complete';
  updatedAt: string;
}

export interface OfflineTafsirDownloadStatus {
  downloadedSurahs: number;
  totalSurahs: number;
  isComplete: boolean;
  status: 'not_downloaded' | 'downloading' | 'paused' | 'complete';
  sourceVersion: string;
  releaseDate: string;
}

export interface OfflineTafsirDownloadProgress extends OfflineTafsirDownloadStatus {
  currentSurah: number | null;
}

interface DownloadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: OfflineTafsirDownloadProgress) => void;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('التخزين المحلي IndexedDB غير متاح في هذا المتصفح.'));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SURAH_STORE)) {
        database.createObjectStore(SURAH_STORE, { keyPath: 'surahNumber' });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('تعذر فتح قاعدة بيانات التفسير المحلية.'));
    };
    request.onblocked = () => {
      databasePromise = null;
      reject(new Error('قاعدة بيانات التفسير مشغولة في نافذة أخرى. أغلق النسخة الأخرى وحاول مجددًا.'));
    };
  });

  return databasePromise;
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('فشل الوصول إلى بيانات التفسير المحلية.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('تعذر حفظ بيانات التفسير المحلية.'));
    transaction.onabort = () => reject(transaction.error || new Error('تم إلغاء حفظ بيانات التفسير المحلية.'));
  });
}

async function readManifest(database: IDBDatabase): Promise<StoredManifest | null> {
  const transaction = database.transaction(META_STORE, 'readonly');
  const value = await requestValue(transaction.objectStore(META_STORE).get(META_KEY)) as StoredManifest | undefined;
  return value || null;
}

async function writeManifest(database: IDBDatabase, manifest: StoredManifest): Promise<void> {
  const transaction = database.transaction(META_STORE, 'readwrite');
  transaction.objectStore(META_STORE).put(manifest);
  await transactionDone(transaction);
}

async function readStoredSurah(database: IDBDatabase, surahNumber: number): Promise<StoredSurah | null> {
  const transaction = database.transaction(SURAH_STORE, 'readonly');
  const value = await requestValue(transaction.objectStore(SURAH_STORE).get(surahNumber)) as StoredSurah | undefined;
  return value || null;
}

async function writeStoredSurah(database: IDBDatabase, record: StoredSurah): Promise<void> {
  const transaction = database.transaction(SURAH_STORE, 'readwrite');
  transaction.objectStore(SURAH_STORE).put(record);
  await transactionDone(transaction);
}

async function deleteStoredSurah(database: IDBDatabase, surahNumber: number): Promise<void> {
  const transaction = database.transaction(SURAH_STORE, 'readwrite');
  transaction.objectStore(SURAH_STORE).delete(surahNumber);
  await transactionDone(transaction);
}

async function markSurahMissing(database: IDBDatabase, surahNumber: number): Promise<void> {
  const manifest = await readManifest(database);
  if (!manifest || manifest.sourceVersion !== OFFLINE_TAFSIR_SOURCE.version) return;
  await writeManifest(database, {
    ...manifest,
    downloadedSurahs: manifest.downloadedSurahs.filter(number => number !== surahNumber),
    status: 'paused',
    updatedAt: new Date().toISOString()
  });
}

function extractRows(payload: unknown): QuranEncTafsirRow[] {
  if (Array.isArray(payload)) return payload as QuranEncTafsirRow[];
  if (payload && typeof payload === 'object') {
    const value = payload as { result?: unknown; data?: unknown };
    if (Array.isArray(value.result)) return value.result as QuranEncTafsirRow[];
    if (Array.isArray(value.data)) return value.data as QuranEncTafsirRow[];
  }
  throw new Error('استجابة مصدر التفسير لا تحتوي على قائمة آيات صالحة.');
}

/** Validate coordinates and coverage while storing the original source payload unchanged. */
function validateSurahPayload(surahNumber: number, payload: unknown): QuranEncTafsirRow[] {
  const rows = extractRows(payload);
  const expectedCount = ALL_SURAHS[surahNumber - 1]?.versesCount;
  if (!expectedCount || rows.length !== expectedCount) {
    throw new Error(`عدد آيات تفسير سورة ${surahNumber} غير مكتمل: المتوقع ${expectedCount ?? 'غير معروف'}، والمستلم ${rows.length}.`);
  }

  const valid = rows.every((row, index) =>
    Number(row.sura) === surahNumber &&
    Number(row.aya) === index + 1 &&
    typeof row.translation === 'string' &&
    row.translation.trim().length > 0
  );
  if (!valid) {
    throw new Error(`ترتيب أو محتوى تفسير سورة ${surahNumber} غير مطابق لإحداثيات المصحف.`);
  }
  return rows;
}

async function verifyCurrentSourceVersion(signal?: AbortSignal): Promise<void> {
  const response = await fetch('https://quranenc.com/api/v1/translations/list/ar?localization=ar', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal
  });
  if (!response.ok) {
    throw new Error(`تعذر التحقق من إصدار التفسير من QuranEnc (HTTP ${response.status}).`);
  }

  const payload: unknown = await response.json();
  const translations = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { translations?: unknown }).translations)
      ? (payload as { translations: unknown[] }).translations
      : [];
  const selected = translations.find(item =>
    item && typeof item === 'object' &&
    (item as { key?: unknown }).key === OFFLINE_TAFSIR_SOURCE.translationKey
  ) as { version?: unknown } | undefined;

  if (!selected || typeof selected.version !== 'string') {
    throw new Error('لم يعثر QuranEnc على إصدار موثوق لمفتاح التفسير الميسر.');
  }
  if (selected.version !== OFFLINE_TAFSIR_SOURCE.version) {
    throw new Error(`أصدر QuranEnc نسخة أحدث (${selected.version}). يلزم تحديث بيانات المصدر في وِرد قبل تنزيلها حتى لا نضع رقم إصدار غير صحيح على المحتوى.`);
  }
}

function isValidStoredSurah(record: StoredSurah): boolean {
  if (
    record.sourceVersion !== OFFLINE_TAFSIR_SOURCE.version ||
    !Number.isInteger(record.surahNumber) ||
    record.surahNumber < 1 ||
    record.surahNumber > TOTAL_SURAHS
  ) return false;

  try {
    validateSurahPayload(record.surahNumber, record.payload);
    return true;
  } catch {
    return false;
  }
}

function makeStatus(downloadedSurahs: number[], status: OfflineTafsirDownloadStatus['status']): OfflineTafsirDownloadStatus {
  const verifiedNumbers = [...new Set(downloadedSurahs.filter(number =>
    Number.isInteger(number) && number >= 1 && number <= TOTAL_SURAHS
  ))].sort((a, b) => a - b);
  const isComplete = verifiedNumbers.length === TOTAL_SURAHS &&
    verifiedNumbers.every((number, index) => number === index + 1);
  return {
    downloadedSurahs: verifiedNumbers.length,
    totalSurahs: TOTAL_SURAHS,
    isComplete,
    status: isComplete ? 'complete' : status,
    sourceVersion: OFFLINE_TAFSIR_SOURCE.version,
    releaseDate: OFFLINE_TAFSIR_SOURCE.releaseDate
  };
}

/**
 * Derive readiness from validated IndexedDB records, not only the manifest.
 * A crash between persisting a surah and updating the manifest can leave a
 * valid local payload missing from downloadedSurahs (or even without a
 * manifest). The records are the source of truth for what is actually stored.
 */
export function deriveOfflineTafsirDownloadStatus(
  storedRecords: unknown[],
  manifestValue: unknown
): OfflineTafsirDownloadStatus {
  const validRecords = (Array.isArray(storedRecords) ? storedRecords : []).filter((record): record is StoredSurah =>
    Boolean(record && typeof record === 'object' && isValidStoredSurah(record as StoredSurah))
  );
  const validStoredNumbers = new Set(validRecords.map(record => record.surahNumber));
  const manifest = manifestValue && typeof manifestValue === 'object'
    ? manifestValue as StoredManifest
    : null;

  let status: OfflineTafsirDownloadStatus['status'];
  if (validStoredNumbers.size === 0) {
    status = 'not_downloaded';
  } else if (
    manifest?.sourceVersion === OFFLINE_TAFSIR_SOURCE.version &&
    manifest.status === 'downloading'
  ) {
    status = 'downloading';
  } else if (
    manifest?.sourceVersion === OFFLINE_TAFSIR_SOURCE.version &&
    manifest.status === 'complete' &&
    validStoredNumbers.size === TOTAL_SURAHS
  ) {
    status = 'complete';
  } else {
    status = 'paused';
  }

  return makeStatus([...validStoredNumbers], status);
}

export async function getOfflineTafsirDownloadStatus(): Promise<OfflineTafsirDownloadStatus> {
  const database = await openDatabase();
  const transaction = database.transaction(SURAH_STORE, 'readonly');
  const storedRecords = await requestValue(transaction.objectStore(SURAH_STORE).getAll()) as StoredSurah[];
  const manifest = await readManifest(database);
  return deriveOfflineTafsirDownloadStatus(storedRecords, manifest);
}

export async function getOfflineTafsirForSurah(surahNumber: number): Promise<QuranEncTafsirRow[] | null> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > TOTAL_SURAHS) return null;
  const database = await openDatabase();
  const record = await readStoredSurah(database, surahNumber);
  if (!record || record.sourceVersion !== OFFLINE_TAFSIR_SOURCE.version) return null;
  try {
    return validateSurahPayload(surahNumber, record.payload);
  } catch (error) {
    await deleteStoredSurah(database, surahNumber);
    await markSurahMissing(database, surahNumber);
    throw error;
  }
}

export async function getOfflineTafsirForAyah(surahNumber: number, ayahNumber: number): Promise<QuranEncTafsirRow | null> {
  const rows = await getOfflineTafsirForSurah(surahNumber);
  return rows?.find(row => Number(row.aya) === ayahNumber) || null;
}

/**
 * Downloads one surah at a time, validates complete verse coverage, and stores
 * the untouched QuranEnc payload in IndexedDB. Existing current-version surahs
 * are skipped, so aborts and network failures can be resumed safely.
 */
export async function downloadOfflineTafsirMuyassar(options: DownloadOptions = {}): Promise<OfflineTafsirDownloadStatus> {
  const database = await openDatabase();
  const { signal, onProgress } = options;
  await verifyCurrentSourceVersion(signal);
  let currentSurah: number | null = null;
  let manifest = await readManifest(database);

  if (manifest && manifest.sourceVersion !== OFFLINE_TAFSIR_SOURCE.version) {
    const clearTransaction = database.transaction([SURAH_STORE, META_STORE], 'readwrite');
    clearTransaction.objectStore(SURAH_STORE).clear();
    clearTransaction.objectStore(META_STORE).clear();
    await transactionDone(clearTransaction);
    manifest = null;
  }

  const transaction = database.transaction(SURAH_STORE, 'readonly');
  const existingRecords = await requestValue(transaction.objectStore(SURAH_STORE).getAll()) as StoredSurah[];
  const downloaded = new Set(
    existingRecords.filter(isValidStoredSurah).map(record => record.surahNumber)
  );

  const publishProgress = (status: OfflineTafsirDownloadStatus['status']) => {
    const result = makeStatus([...downloaded], status);
    onProgress?.({ ...result, currentSurah });
  };

  manifest = {
    key: META_KEY,
    sourceVersion: OFFLINE_TAFSIR_SOURCE.version,
    downloadedSurahs: [...downloaded].sort((a, b) => a - b),
    status: 'downloading',
    updatedAt: new Date().toISOString()
  };
  await writeManifest(database, manifest);
  publishProgress('downloading');

  try {
    for (let surahNumber = 1; surahNumber <= TOTAL_SURAHS; surahNumber += 1) {
      currentSurah = surahNumber;
      if (signal?.aborted) throw new DOMException('تم إيقاف التنزيل مؤقتًا.', 'AbortError');

      if (downloaded.has(surahNumber)) {
        publishProgress('downloading');
        continue;
      }

      const response = await fetch(
        `${OFFLINE_TAFSIR_SOURCE.endpoint}/${OFFLINE_TAFSIR_SOURCE.translationKey}/${surahNumber}`,
        { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal }
      );
      if (!response.ok) {
        throw new Error(`تعذر تنزيل تفسير سورة ${surahNumber} (HTTP ${response.status}).`);
      }

      const payload: unknown = await response.json();
      validateSurahPayload(surahNumber, payload);
      await writeStoredSurah(database, {
        surahNumber,
        sourceVersion: OFFLINE_TAFSIR_SOURCE.version,
        savedAt: new Date().toISOString(),
        payload
      });
      downloaded.add(surahNumber);
      manifest = {
        key: META_KEY,
        sourceVersion: OFFLINE_TAFSIR_SOURCE.version,
        downloadedSurahs: [...downloaded].sort((a, b) => a - b),
        status: 'downloading',
        updatedAt: new Date().toISOString()
      };
      await writeManifest(database, manifest);
      publishProgress('downloading');
    }

    manifest = {
      key: META_KEY,
      sourceVersion: OFFLINE_TAFSIR_SOURCE.version,
      downloadedSurahs: [...downloaded].sort((a, b) => a - b),
      status: 'complete',
      updatedAt: new Date().toISOString()
    };
    await writeManifest(database, manifest);
    currentSurah = null;
    const result = makeStatus([...downloaded], 'complete');
    onProgress?.({ ...result, currentSurah: null });
    return result;
  } catch (error) {
    manifest = {
      key: META_KEY,
      sourceVersion: OFFLINE_TAFSIR_SOURCE.version,
      downloadedSurahs: [...downloaded].sort((a, b) => a - b),
      status: 'paused',
      updatedAt: new Date().toISOString()
    };
    await writeManifest(database, manifest);
    publishProgress('paused');
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    throw error;
  }
}

export async function deleteOfflineTafsirMuyassar(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([SURAH_STORE, META_STORE], 'readwrite');
  transaction.objectStore(SURAH_STORE).clear();
  transaction.objectStore(META_STORE).clear();
  await transactionDone(transaction);
}
