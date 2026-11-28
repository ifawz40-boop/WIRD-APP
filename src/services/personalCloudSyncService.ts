import { auth, WIRD_GOOGLE_OAUTH_CLIENT_ID } from '../lib/firebase';
import {
  applyAccountCloudBundleToLocal,
  captureAccountCloudBundle,
  decodeCompactSyncCapsule,
  encodeCompactSyncCapsule,
  fingerprintAccountCloudBundle,
  isValidAccountCloudBundle,
  mergeAccountCloudBundles,
  type AccountCloudBundleV4,
  type MergeBundleStats,
} from './accountCloudBundleService';
import { StorageService } from './storageService';
import { subscribeLocalSyncMutation } from './syncTombstoneRegistry';

export const PERSONAL_CLOUD_META_KEY = 'wird.personal.cloud.meta.v1';
export const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const GOOGLE_DRIVE_VAULT_FILENAME = 'wird-account-vault-v4.json';
const HANDLE_DB_NAME = 'wird-personal-cloud-handles-v1';
const HANDLE_STORE_NAME = 'fileHandles';

export interface PersonalCloudSyncMeta {
  googleDriveEnabled: boolean;
  googleDriveAutoSync: boolean;
  googleDriveAccountHint: string | null;
  lastGoogleDriveSyncAtMs: number | null;
  linkedFileName: string | null;
  lastLinkedFileSyncAtMs: number | null;
  lastSummaryAr: string | null;
}

export interface PersonalCloudSyncResult {
  success: boolean;
  provider: 'google-drive' | 'linked-file' | 'capsule';
  stats?: MergeBundleStats;
  messageAr: string;
  driveApiNotEnabled?: boolean;
  driveApiEnableUrl?: string;
}

const DEFAULT_META: PersonalCloudSyncMeta = {
  googleDriveEnabled: false,
  googleDriveAutoSync: true,
  googleDriveAccountHint: null,
  lastGoogleDriveSyncAtMs: null,
  linkedFileName: null,
  lastLinkedFileSyncAtMs: null,
  lastSummaryAr: null,
};

let memoryDriveToken: string | null = null;
let memoryDriveTokenExpiresAtMs = 0;
let memoryDriveScopeUid: string | null = null;
let autoDriveSyncTimer: ReturnType<typeof setTimeout> | null = null;
let driveSyncInFlight = false;
const metaListeners = new Set<(meta: PersonalCloudSyncMeta) => void>();

function resolveMetaKey(): string {
  return StorageService.resolveScopedKey(PERSONAL_CLOUD_META_KEY);
}

export function readPersonalCloudMeta(): PersonalCloudSyncMeta {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_META };
    const raw = localStorage.getItem(resolveMetaKey());
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw) as Partial<PersonalCloudSyncMeta>;
    return {
      googleDriveEnabled: Boolean(parsed.googleDriveEnabled),
      googleDriveAutoSync: parsed.googleDriveAutoSync !== false,
      googleDriveAccountHint:
        typeof parsed.googleDriveAccountHint === 'string' ? parsed.googleDriveAccountHint : null,
      lastGoogleDriveSyncAtMs:
        typeof parsed.lastGoogleDriveSyncAtMs === 'number' ? parsed.lastGoogleDriveSyncAtMs : null,
      linkedFileName: typeof parsed.linkedFileName === 'string' ? parsed.linkedFileName : null,
      lastLinkedFileSyncAtMs:
        typeof parsed.lastLinkedFileSyncAtMs === 'number' ? parsed.lastLinkedFileSyncAtMs : null,
      lastSummaryAr: typeof parsed.lastSummaryAr === 'string' ? parsed.lastSummaryAr : null,
    };
  } catch {
    return { ...DEFAULT_META };
  }
}

export function updatePersonalCloudMeta(patch: Partial<PersonalCloudSyncMeta>): PersonalCloudSyncMeta {
  const next: PersonalCloudSyncMeta = {
    ...readPersonalCloudMeta(),
    ...patch,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(resolveMetaKey(), JSON.stringify(next));
    }
  } catch {
    // Ignore storage quota failure
  }
  for (const listener of metaListeners) {
    try {
      listener(next);
    } catch {
      // Ignore subscriber error
    }
  }
  return next;
}

export function subscribePersonalCloudMeta(
  listener: (meta: PersonalCloudSyncMeta) => void
): () => void {
  metaListeners.add(listener);
  listener(readPersonalCloudMeta());
  return () => {
    metaListeners.delete(listener);
  };
}

export function hasActiveGoogleDriveSession(): boolean {
  const activeScope = StorageService.getStorageScope();
  return (
    Boolean(memoryDriveToken) &&
    memoryDriveScopeUid === activeScope &&
    Date.now() < memoryDriveTokenExpiresAtMs - 20_000
  );
}

export function disconnectGoogleDrivePersonalCloud(): void {
  memoryDriveToken = null;
  memoryDriveTokenExpiresAtMs = 0;
  memoryDriveScopeUid = null;
  if (autoDriveSyncTimer) {
    clearTimeout(autoDriveSyncTimer);
    autoDriveSyncTimer = null;
  }
  updatePersonalCloudMeta({
    googleDriveEnabled: false,
    lastSummaryAr: 'تم فصل ربط خزنة Google Drive الشخصية لهذا الجهاز.',
  });
}

function formatMergeStatsMessage(prefixAr: string, stats: MergeBundleStats): string {
  if (stats.addedCount === 0 && stats.deletedCount === 0) {
    return `${prefixAr} — جميع الإضافات والحذوفات متطابقة ومحدّثة بالكامل.`;
  }
  const parts: string[] = [];
  if (stats.addedCount > 0) parts.push(`دمج ${stats.addedCount} إضافة جديدة`);
  if (stats.deletedCount > 0) parts.push(`تطبيق ${stats.deletedCount} عملية حذف`);
  return `${prefixAr} (${parts.join(' + ')}).`;
}

async function requestGoogleDriveAccessToken(interactive: boolean): Promise<string> {
  const currentScope = StorageService.getStorageScope();
  if (hasActiveGoogleDriveSession()) {
    return memoryDriveToken!;
  }

  const gisOauth2 =
    typeof window !== 'undefined' ? (window as any).google?.accounts?.oauth2 : undefined;
  if (!gisOauth2?.initTokenClient || !WIRD_GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error('خدمة هوية Google غير محمّلة حالياً؛ تأكد من الاتصال بالإنترنت ثم أعد المحاولة.');
  }

  const hintEmail =
    auth?.currentUser?.email || readPersonalCloudMeta().googleDriveAccountHint || undefined;

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const tokenClient = gisOauth2.initTokenClient({
      client_id: WIRD_GOOGLE_OAUTH_CLIENT_ID,
      scope: GOOGLE_DRIVE_APPDATA_SCOPE,
      ...(hintEmail ? { hint: hintEmail } : {}),
      callback: (resp: any) => {
        if (settled) return;
        settled = true;
        if (resp?.access_token) {
          const expiresSec = Number(resp.expires_in) || 3500;
          memoryDriveToken = String(resp.access_token);
          memoryDriveTokenExpiresAtMs = Date.now() + expiresSec * 1000;
          memoryDriveScopeUid = currentScope;
          resolve(memoryDriveToken);
        } else {
          reject(
            new Error(
              resp?.error === 'access_denied'
                ? 'تم إلغاء منح صلاحية المجلد الخاص للتطبيق في Google Drive.'
                : resp?.error_description || 'تعذر الحصول على تصريح الوصول إلى Google Drive AppData.'
            )
          );
        }
      },
      error_callback: (err: any) => {
        if (settled) return;
        settled = true;
        if (err?.type === 'popup_closed') {
          reject(new Error('تم إغلاق نافذة Google قبل إتمام الربط.'));
        } else if (err?.type === 'popup_failed_to_open') {
          reject(new Error('حظر المتصفح النافذة المنبثقة؛ اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.'));
        } else {
          reject(new Error('تعذر فتح نافذة تفويض Google Drive.'));
        }
      },
    });

    tokenClient.requestAccessToken({
      prompt: interactive ? '' : 'none',
    });
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = 14_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Bidirectional CRDT + Tombstone synchronization with the user's own private
 * `appDataFolder` on Google Drive (`https://www.googleapis.com/auth/drive.appdata`).
 * Zero access to user's personal Drive files; 100% isolated per Google account.
 */
export async function syncWithGoogleDrivePersonalCloud(options?: {
  interactive?: boolean;
}): Promise<PersonalCloudSyncResult> {
  if (driveSyncInFlight) {
    return {
      success: false,
      provider: 'google-drive',
      messageAr: 'توجد عملية مزامنة جارية بالفعل مع Google Drive.',
    };
  }

  const interactive = options?.interactive !== false;
  driveSyncInFlight = true;

  try {
    const accessToken = await requestGoogleDriveAccessToken(interactive);
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const listUrl =
      'https://www.googleapis.com/drive/v3/files' +
      `?spaces=appDataFolder&q=${encodeURIComponent(
        `name='${GOOGLE_DRIVE_VAULT_FILENAME}' and trashed=false`
      )}&fields=files(id,name,modifiedTime,size)&pageSize=5`;

    const listResp = await fetchWithTimeout(listUrl, { method: 'GET', headers: authHeaders });
    if (!listResp.ok) {
      const errJson = await listResp.json().catch(() => null);
      const errMessage = String(errJson?.error?.message || '');
      const errReason = String(
        errJson?.error?.details?.[0]?.reason || errJson?.error?.errors?.[0]?.reason || ''
      );
      if (
        listResp.status === 403 &&
        (errReason === 'accessNotConfigured' ||
          errMessage.includes('Google Drive API has not been used') ||
          errMessage.includes('it is disabled'))
      ) {
        return {
          success: false,
          provider: 'google-drive',
          driveApiNotEnabled: true,
          driveApiEnableUrl:
            'https://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=741238306826',
          messageAr:
            'يتطلب تفعيل خدمة Google Drive API لمرة واحدة في مشروع السحابة؛ أو يمكنك استخدام ربط ملف السحابة الذكي أدناه فوراً.',
        };
      }
      if (listResp.status === 401) {
        memoryDriveToken = null;
        memoryDriveTokenExpiresAtMs = 0;
      }
      throw new Error(errMessage || `رفض Google Drive الطلب (HTTP ${listResp.status}).`);
    }

    const listData = (await listResp.json()) as { files?: Array<{ id: string }> };
    const existingFile = listData.files?.[0] ?? null;

    const localBundle = captureAccountCloudBundle(Date.now());
    const localFp = fingerprintAccountCloudBundle(localBundle);
    let targetBundle: AccountCloudBundleV4 = localBundle;
    let stats: MergeBundleStats = { addedCount: 0, deletedCount: 0, domainsMerged: [] };
    let remoteFp: string | null = null;

    if (existingFile?.id) {
      const downloadResp = await fetchWithTimeout(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(existingFile.id)}?alt=media`,
        { method: 'GET', headers: authHeaders }
      );
      if (downloadResp.ok) {
        const remoteJson = await downloadResp.json().catch(() => null);
        if (isValidAccountCloudBundle(remoteJson)) {
          remoteFp = fingerprintAccountCloudBundle(remoteJson);
          const mergedResult = mergeAccountCloudBundles(localBundle, remoteJson, Date.now());
          targetBundle = mergedResult.merged;
          stats = mergedResult.stats;
          if (fingerprintAccountCloudBundle(targetBundle) !== localFp) {
            await applyAccountCloudBundleToLocal(targetBundle);
          }
        }
      }
    }

    const finalFp = fingerprintAccountCloudBundle(targetBundle);
    if (!existingFile?.id || finalFp !== remoteFp) {
      const serialized = JSON.stringify(targetBundle);
      if (existingFile?.id) {
        const updateResp = await fetchWithTimeout(
          `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
            existingFile.id
          )}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            body: serialized,
          }
        );
        if (!updateResp.ok) {
          throw new Error(`تعذر تحديث ملف الخزنة في Google Drive (HTTP ${updateResp.status}).`);
        }
      } else {
        const boundary = 'wird_vault_boundary_' + Date.now();
        const metadata = JSON.stringify({
          name: GOOGLE_DRIVE_VAULT_FILENAME,
          parents: ['appDataFolder'],
          mimeType: 'application/json',
        });
        const multipartBody =
          `--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          `${metadata}\r\n` +
          `--${boundary}\r\n` +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          `${serialized}\r\n` +
          `--${boundary}--`;

        const createResp = await fetchWithTimeout(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              ...authHeaders,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );
        if (!createResp.ok) {
          throw new Error(`تعذر إنشاء ملف الخزنة في Google Drive (HTTP ${createResp.status}).`);
        }
      }
    }

    const nowMs = Date.now();
    const summaryAr = formatMergeStatsMessage('تمت المزامنة مع سحابتك على Google Drive', stats);
    updatePersonalCloudMeta({
      googleDriveEnabled: true,
      googleDriveAccountHint: auth?.currentUser?.email || readPersonalCloudMeta().googleDriveAccountHint,
      lastGoogleDriveSyncAtMs: nowMs,
      lastSummaryAr: summaryAr,
    });

    return {
      success: true,
      provider: 'google-drive',
      stats,
      messageAr: summaryAr,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'google-drive',
      messageAr:
        error instanceof Error ? error.message : 'تعذر إكمال المزامنة مع خزنة Google Drive الشخصية.',
    };
  } finally {
    driveSyncInFlight = false;
  }
}

// ============================================================================
// Provider 2: Live Linked Cloud File (iCloud Drive / OneDrive / Dropbox / Local)
// ============================================================================

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).showOpenFilePicker === 'function' &&
    typeof (window as any).showSaveFilePicker === 'function'
  );
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        db.createObjectStore(HANDLE_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open handle DB'));
  });
}

async function saveLinkedFileHandle(handle: any): Promise<void> {
  try {
    const db = await openHandleDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readwrite');
      tx.objectStore(HANDLE_STORE_NAME).put(handle, StorageService.getStorageScope());
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Non-fatal if browser blocks handle serialization
  }
}

async function loadLinkedFileHandle(): Promise<any | null> {
  try {
    const db = await openHandleDatabase();
    return await new Promise<any | null>((resolve) => {
      const tx = db.transaction(HANDLE_STORE_NAME, 'readonly');
      const req = tx.objectStore(HANDLE_STORE_NAME).get(StorageService.getStorageScope());
      req.onsuccess = () => {
        db.close();
        resolve(req.result ?? null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

async function syncWithFileHandleInternal(handle: any): Promise<PersonalCloudSyncResult> {
  if (typeof handle.queryPermission === 'function') {
    let perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
      perm = await handle.requestPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') {
      return {
        success: false,
        provider: 'linked-file',
        messageAr: 'لم يُمنح إذن القراءة والكتابة لملف المزامنة السحابي.',
      };
    }
  }

  const localBundle = captureAccountCloudBundle(Date.now());
  const localFp = fingerprintAccountCloudBundle(localBundle);
  let targetBundle = localBundle;
  let stats: MergeBundleStats = { addedCount: 0, deletedCount: 0, domainsMerged: [] };

  try {
    const file: File = await handle.getFile();
    if (file.size > 0 && file.size <= 4_000_000) {
      const text = await file.text();
      if (text.trim()) {
        const parsed = JSON.parse(text);
        if (isValidAccountCloudBundle(parsed)) {
          const mergedResult = mergeAccountCloudBundles(localBundle, parsed, Date.now());
          targetBundle = mergedResult.merged;
          stats = mergedResult.stats;
          if (fingerprintAccountCloudBundle(targetBundle) !== localFp) {
            await applyAccountCloudBundleToLocal(targetBundle);
          }
        }
      }
    }
  } catch {
    // New or empty file — write initial bundle below
  }

  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(targetBundle, null, 2));
  await writable.close();

  const fileName = String(handle.name || GOOGLE_DRIVE_VAULT_FILENAME);
  const summaryAr = formatMergeStatsMessage(`تمت المزامنة ثنائية الاتجاه مع (${fileName})`, stats);
  updatePersonalCloudMeta({
    linkedFileName: fileName,
    lastLinkedFileSyncAtMs: Date.now(),
    lastSummaryAr: summaryAr,
  });

  return {
    success: true,
    provider: 'linked-file',
    stats,
    messageAr: summaryAr,
  };
}

export async function linkCloudSyncFile(mode: 'open' | 'create'): Promise<PersonalCloudSyncResult> {
  if (!isFileSystemAccessSupported()) {
    return {
      success: false,
      provider: 'linked-file',
      messageAr: 'متصفحك الحالي لا يدعم الربط المباشر للملفات؛ استخدم زري التصدير والدمج الذكي أدناه.',
    };
  }
  try {
    let handle: any;
    if (mode === 'create') {
      handle = await (window as any).showSaveFilePicker({
        suggestedName: GOOGLE_DRIVE_VAULT_FILENAME,
        types: [
          {
            description: 'ملف خزنة مزامنة وِرد السحابية (JSON)',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
    } else {
      const picked = await (window as any).showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'ملف خزنة مزامنة وِرد السحابية (JSON)',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      handle = picked?.[0];
    }
    if (!handle) {
      return { success: false, provider: 'linked-file', messageAr: 'لم يتم اختيار ملف.' };
    }
    await saveLinkedFileHandle(handle);
    return await syncWithFileHandleInternal(handle);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { success: false, provider: 'linked-file', messageAr: 'تم إلغاء اختيار الملف.' };
    }
    return {
      success: false,
      provider: 'linked-file',
      messageAr: error instanceof Error ? error.message : 'تعذر ربط ملف المزامنة السحابي.',
    };
  }
}

export async function syncLinkedCloudFileNow(): Promise<PersonalCloudSyncResult> {
  const handle = await loadLinkedFileHandle();
  if (!handle) {
    return linkCloudSyncFile('open');
  }
  try {
    return await syncWithFileHandleInternal(handle);
  } catch (error) {
    return {
      success: false,
      provider: 'linked-file',
      messageAr:
        error instanceof Error
          ? error.message
          : 'تعذر الوصول إلى الملف السحابي المربوط؛ أعد اختياره مرة أخرى.',
    };
  }
}

/**
 * Universal Smart Cloud Vault Export & Bidirectional Merge (works on Safari/iOS/Android/Desktop).
 * Unlike standard backup restore (which overwrites), `mergeSmartCloudVaultJson` merges BOTH additions AND deletions!
 */
export function exportSmartCloudVaultJson(): string {
  const bundle = captureAccountCloudBundle(Date.now());
  return JSON.stringify(bundle, null, 2);
}

export async function mergeSmartCloudVaultJson(rawText: string): Promise<PersonalCloudSyncResult> {
  try {
    const parsed = JSON.parse(rawText);
    if (!isValidAccountCloudBundle(parsed)) {
      return {
        success: false,
        provider: 'linked-file',
        messageAr:
          'هذا الملف ليس ملف خزنة مزامنة ذكية بصيغة V4؛ لاستيراد نسخة احتياطية تقليدية استخدم قسم النسخ الاحتياطي.',
      };
    }
    const localBundle = captureAccountCloudBundle(Date.now());
    const { merged, stats } = mergeAccountCloudBundles(localBundle, parsed, Date.now());
    await applyAccountCloudBundleToLocal(merged);
    const summaryAr = formatMergeStatsMessage('تم الدمج الذكي لملف السحابة (إضافات + حذوفات)', stats);
    updatePersonalCloudMeta({
      lastLinkedFileSyncAtMs: Date.now(),
      lastSummaryAr: summaryAr,
    });
    return {
      success: true,
      provider: 'linked-file',
      stats,
      messageAr: summaryAr,
    };
  } catch {
    return {
      success: false,
      provider: 'linked-file',
      messageAr: 'تعذر قراءة ملف المزامنة؛ تأكد من اختيار ملف JSON سليم.',
    };
  }
}

// ============================================================================
// Provider 3: Instant Compressed Sync Capsule (Peer-to-Peer Device Sync)
// ============================================================================

export async function createInstantSyncCapsule(): Promise<string> {
  const bundle = captureAccountCloudBundle(Date.now());
  return encodeCompactSyncCapsule(bundle);
}

export async function mergeInstantSyncCapsule(capsuleText: string): Promise<PersonalCloudSyncResult> {
  try {
    const remoteBundle = await decodeCompactSyncCapsule(capsuleText);
    const localBundle = captureAccountCloudBundle(Date.now());
    const { merged, stats } = mergeAccountCloudBundles(localBundle, remoteBundle, Date.now());
    await applyAccountCloudBundleToLocal(merged);
    const summaryAr = formatMergeStatsMessage('تم تطبيق كبسولة المزامنة الفورية بنجاح', stats);
    updatePersonalCloudMeta({
      lastSummaryAr: summaryAr,
    });
    return {
      success: true,
      provider: 'capsule',
      stats,
      messageAr: summaryAr,
    };
  } catch (error) {
    return {
      success: false,
      provider: 'capsule',
      messageAr: error instanceof Error ? error.message : 'كبسولة المزامنة غير صالحة.',
    };
  }
}

// Auto-sync listener when Google Drive session is active and `googleDriveAutoSync` is enabled
subscribeLocalSyncMutation(() => {
  const meta = readPersonalCloudMeta();
  if (!meta.googleDriveEnabled || !meta.googleDriveAutoSync || !hasActiveGoogleDriveSession()) {
    return;
  }
  if (autoDriveSyncTimer) {
    clearTimeout(autoDriveSyncTimer);
  }
  autoDriveSyncTimer = setTimeout(() => {
    autoDriveSyncTimer = null;
    if (hasActiveGoogleDriveSession()) {
      void syncWithGoogleDrivePersonalCloud({ interactive: false }).catch(() => undefined);
    }
  }, 2500);
});
