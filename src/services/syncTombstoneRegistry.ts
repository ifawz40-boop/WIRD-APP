export const SYNC_TOMBSTONES_STORAGE_KEY = 'wird.sync.tombstones.v1';

export type SyncTombstoneDomain =
  | 'plans'
  | 'enginePlans'
  | 'portions'
  | 'weakVerses'
  | 'tests'
  | 'readingKhatmas'
  | 'khatmaPages'
  | 'pageBookmarks'
  | 'ribbons'
  | 'adhkarFavorites'
  | 'adhkarCounts'
  | 'customTasbih'
  | 'seerahChapters'
  | 'customVideoSeries'
  | 'watchedVideos'
  | 'videoNotes';

export const ALL_SYNC_TOMBSTONE_DOMAINS: readonly SyncTombstoneDomain[] = [
  'plans',
  'enginePlans',
  'portions',
  'weakVerses',
  'tests',
  'readingKhatmas',
  'khatmaPages',
  'pageBookmarks',
  'ribbons',
  'adhkarFavorites',
  'adhkarCounts',
  'customTasbih',
  'seerahChapters',
  'customVideoSeries',
  'watchedVideos',
  'videoNotes',
] as const;

export interface SyncTombstoneLedgerV1 {
  schemaVersion: 1;
  updatedAtMs: number;
  profileUpdatedAtMs: number;
  upsertedAtMs: Partial<Record<SyncTombstoneDomain, Record<string, number>>>;
  deletedAtMs: Partial<Record<SyncTombstoneDomain, Record<string, number>>>;
}

const VALID_DOMAIN_SET = new Set<string>(ALL_SYNC_TOMBSTONE_DOMAINS);
const MAX_ENTRIES_PER_DOMAIN = 600;

let applyingRemoteSyncDepth = 0;
const localMutationListeners = new Set<() => void>();

export function isApplyingRemoteSync(): boolean {
  return applyingRemoteSyncDepth > 0;
}

export function withApplyingRemoteSyncGuardSync<T>(fn: () => T): T {
  applyingRemoteSyncDepth += 1;
  try {
    return fn();
  } finally {
    applyingRemoteSyncDepth = Math.max(0, applyingRemoteSyncDepth - 1);
  }
}

export async function withApplyingRemoteSyncGuard<T>(fn: () => Promise<T> | T): Promise<T> {
  applyingRemoteSyncDepth += 1;
  try {
    return await fn();
  } finally {
    applyingRemoteSyncDepth = Math.max(0, applyingRemoteSyncDepth - 1);
  }
}

export function subscribeLocalSyncMutation(listener: () => void): () => void {
  localMutationListeners.add(listener);
  return () => {
    localMutationListeners.delete(listener);
  };
}

function notifyLocalSyncMutation(): void {
  if (isApplyingRemoteSync()) return;
  for (const listener of localMutationListeners) {
    try {
      listener();
    } catch {
      // Listener errors must never interrupt persistence.
    }
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeTimestamp(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER - 10_000, Math.trunc(value));
}

function pruneDomainMap(map: Record<string, number>): Record<string, number> {
  const entries = Object.entries(map).filter(
    ([key, ts]) => key.length > 0 && key.length <= 180 && sanitizeTimestamp(ts) > 0
  );
  if (entries.length <= MAX_ENTRIES_PER_DOMAIN) {
    const clean: Record<string, number> = {};
    for (const [key, ts] of entries) clean[key] = sanitizeTimestamp(ts);
    return clean;
  }
  entries.sort((a, b) => b[1] - a[1]);
  const pruned: Record<string, number> = {};
  for (const [key, ts] of entries.slice(0, MAX_ENTRIES_PER_DOMAIN)) {
    pruned[key] = sanitizeTimestamp(ts);
  }
  return pruned;
}

function sanitizeDomainMapRecord(
  raw: unknown
): Partial<Record<SyncTombstoneDomain, Record<string, number>>> {
  if (!isPlainRecord(raw)) return {};
  const result: Partial<Record<SyncTombstoneDomain, Record<string, number>>> = {};
  for (const [domain, domainMap] of Object.entries(raw)) {
    if (!VALID_DOMAIN_SET.has(domain) || !isPlainRecord(domainMap)) continue;
    const rawEntries: Record<string, number> = {};
    for (const [itemId, ts] of Object.entries(domainMap)) {
      const cleanTs = sanitizeTimestamp(ts);
      if (itemId && itemId.length <= 180 && cleanTs > 0) {
        rawEntries[itemId] = cleanTs;
      }
    }
    if (Object.keys(rawEntries).length > 0) {
      result[domain as SyncTombstoneDomain] = pruneDomainMap(rawEntries);
    }
  }
  return result;
}

export function createEmptyTombstoneLedger(nowMs: number = 0): SyncTombstoneLedgerV1 {
  return {
    schemaVersion: 1,
    updatedAtMs: sanitizeTimestamp(nowMs),
    profileUpdatedAtMs: 0,
    upsertedAtMs: {},
    deletedAtMs: {},
  };
}

export function normalizeSyncTombstoneLedger(raw: unknown): SyncTombstoneLedgerV1 {
  if (!isPlainRecord(raw) || raw.schemaVersion !== 1) {
    return createEmptyTombstoneLedger(0);
  }
  return {
    schemaVersion: 1,
    updatedAtMs: sanitizeTimestamp(raw.updatedAtMs),
    profileUpdatedAtMs: sanitizeTimestamp(raw.profileUpdatedAtMs),
    upsertedAtMs: sanitizeDomainMapRecord(raw.upsertedAtMs),
    deletedAtMs: sanitizeDomainMapRecord(raw.deletedAtMs),
  };
}

export interface TombstoneStorageAdapter {
  getRawItem(key: string): string | null;
  setRawItem(key: string, value: string): boolean;
}

let defaultAdapter: TombstoneStorageAdapter | null = null;

export function registerTombstoneStorageAdapter(adapter: TombstoneStorageAdapter): void {
  defaultAdapter = adapter;
}

export function readSyncTombstoneLedger(
  getRawItem?: (key: string) => string | null
): SyncTombstoneLedgerV1 {
  const reader = getRawItem ?? defaultAdapter?.getRawItem;
  if (!reader) return createEmptyTombstoneLedger(0);
  try {
    const raw = reader(SYNC_TOMBSTONES_STORAGE_KEY);
    if (!raw) return createEmptyTombstoneLedger(0);
    return normalizeSyncTombstoneLedger(JSON.parse(raw));
  } catch {
    return createEmptyTombstoneLedger(0);
  }
}

export function writeSyncTombstoneLedger(
  ledger: SyncTombstoneLedgerV1,
  setRawItem?: (key: string, value: string) => boolean
): boolean {
  const writer = setRawItem ?? defaultAdapter?.setRawItem;
  if (!writer) return false;
  try {
    const normalized = normalizeSyncTombstoneLedger(ledger);
    return writer(SYNC_TOMBSTONES_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return false;
  }
}

/**
 * Hybrid Logical Clock (HLC) item upsert stamp:
 * Always advances strictly past any prior tombstone (`deletedAtMs + 1`) for the same item
 * so an explicit re-add/restore cleanly supersedes an older deletion even under clock skew.
 */
export function recordSyncUpsert(
  domain: SyncTombstoneDomain,
  itemId: string,
  nowMs: number = Date.now()
): void {
  if (isApplyingRemoteSync()) return;
  const trimmed = itemId.trim();
  if (!trimmed || trimmed.length > 180) return;

  const ledger = readSyncTombstoneLedger();
  const prevUpsert = ledger.upsertedAtMs[domain]?.[trimmed] ?? 0;
  const prevDelete = ledger.deletedAtMs[domain]?.[trimmed] ?? 0;
  const nextTs = Math.max(sanitizeTimestamp(nowMs), prevUpsert + 1, prevDelete + 1, 1);

  const domainUpserts = { ...(ledger.upsertedAtMs[domain] || {}), [trimmed]: nextTs };
  ledger.upsertedAtMs[domain] = pruneDomainMap(domainUpserts);
  ledger.updatedAtMs = Math.max(ledger.updatedAtMs, nextTs);
  writeSyncTombstoneLedger(ledger);
  notifyLocalSyncMutation();
}

/**
 * Hybrid Logical Clock (HLC) item deletion stamp:
 * Always advances strictly past any prior upsert (`upsertedAtMs + 1`) for the same item
 * so a deletion is guaranteed to suppress resurrection across all devices regardless of clock skew.
 */
export function recordSyncDeletion(
  domain: SyncTombstoneDomain,
  itemId: string,
  nowMs: number = Date.now()
): void {
  if (isApplyingRemoteSync()) return;
  const trimmed = itemId.trim();
  if (!trimmed || trimmed.length > 180) return;

  const ledger = readSyncTombstoneLedger();
  const prevUpsert = ledger.upsertedAtMs[domain]?.[trimmed] ?? 0;
  const prevDelete = ledger.deletedAtMs[domain]?.[trimmed] ?? 0;
  const nextTs = Math.max(sanitizeTimestamp(nowMs), prevUpsert + 1, prevDelete + 1, 1);

  const domainDeletes = { ...(ledger.deletedAtMs[domain] || {}), [trimmed]: nextTs };
  ledger.deletedAtMs[domain] = pruneDomainMap(domainDeletes);
  ledger.updatedAtMs = Math.max(ledger.updatedAtMs, nextTs);
  writeSyncTombstoneLedger(ledger);
  notifyLocalSyncMutation();
}

export function recordProfileTouch(nowMs: number = Date.now()): void {
  if (isApplyingRemoteSync()) return;
  const ledger = readSyncTombstoneLedger();
  const nextTs = Math.max(sanitizeTimestamp(nowMs), ledger.profileUpdatedAtMs + 1, 1);
  ledger.profileUpdatedAtMs = nextTs;
  ledger.updatedAtMs = Math.max(ledger.updatedAtMs, nextTs);
  writeSyncTombstoneLedger(ledger);
  notifyLocalSyncMutation();
}

/**
 * Diffs previous vs next ID sets on local snapshot writes (`plans`, `enginePlans`, `portions`, `weakVerses`),
 * automatically stamping tombstones for any removed IDs and upsert timestamps for added IDs.
 */
export function reconcileSnapshotArrayMutations(
  domain: SyncTombstoneDomain,
  previousIds: Iterable<string>,
  nextIds: Iterable<string>,
  changedExistingIds: Iterable<string> = [],
  nowMs: number = Date.now()
): void {
  if (isApplyingRemoteSync()) return;
  const prevSet = new Set<string>();
  for (const id of previousIds) {
    if (id && id.length <= 180) prevSet.add(id);
  }
  const nextSet = new Set<string>();
  for (const id of nextIds) {
    if (id && id.length <= 180) nextSet.add(id);
  }

  const deleted: string[] = [];
  for (const oldId of prevSet) {
    if (!nextSet.has(oldId)) deleted.push(oldId);
  }

  const upserted = new Set<string>();
  for (const newId of nextSet) {
    if (!prevSet.has(newId)) upserted.add(newId);
  }
  for (const changedId of changedExistingIds) {
    if (nextSet.has(changedId)) upserted.add(changedId);
  }

  if (deleted.length === 0 && upserted.size === 0) return;

  const ledger = readSyncTombstoneLedger();
  const domainUpserts = { ...(ledger.upsertedAtMs[domain] || {}) };
  const domainDeletes = { ...(ledger.deletedAtMs[domain] || {}) };
  let maxObserved = Math.max(sanitizeTimestamp(nowMs), ledger.updatedAtMs, 1);

  for (const id of deleted) {
    const ts = Math.max(sanitizeTimestamp(nowMs), (domainUpserts[id] ?? 0) + 1, (domainDeletes[id] ?? 0) + 1, 1);
    domainDeletes[id] = ts;
    maxObserved = Math.max(maxObserved, ts);
  }

  for (const id of upserted) {
    const ts = Math.max(sanitizeTimestamp(nowMs), (domainUpserts[id] ?? 0) + 1, (domainDeletes[id] ?? 0) + 1, 1);
    domainUpserts[id] = ts;
    maxObserved = Math.max(maxObserved, ts);
  }

  if (Object.keys(domainDeletes).length > 0) {
    ledger.deletedAtMs[domain] = pruneDomainMap(domainDeletes);
  }
  if (Object.keys(domainUpserts).length > 0) {
    ledger.upsertedAtMs[domain] = pruneDomainMap(domainUpserts);
  }
  ledger.updatedAtMs = maxObserved;
  writeSyncTombstoneLedger(ledger);
  notifyLocalSyncMutation();
}

/**
 * Commutative, associative, idempotent merge of two Tombstone Ledgers.
 */
export function mergeSyncTombstoneLedgers(
  local: SyncTombstoneLedgerV1 | undefined | null,
  remote: SyncTombstoneLedgerV1 | undefined | null
): SyncTombstoneLedgerV1 {
  const l = normalizeSyncTombstoneLedger(local);
  const r = normalizeSyncTombstoneLedger(remote);

  const upsertedAtMs: Partial<Record<SyncTombstoneDomain, Record<string, number>>> = {};
  const deletedAtMs: Partial<Record<SyncTombstoneDomain, Record<string, number>>> = {};

  for (const domain of ALL_SYNC_TOMBSTONE_DOMAINS) {
    const lUp = l.upsertedAtMs[domain] || {};
    const rUp = r.upsertedAtMs[domain] || {};
    const upKeys = new Set([...Object.keys(lUp), ...Object.keys(rUp)]);
    if (upKeys.size > 0) {
      const mergedUp: Record<string, number> = {};
      for (const k of upKeys) {
        mergedUp[k] = Math.max(lUp[k] ?? 0, rUp[k] ?? 0);
      }
      upsertedAtMs[domain] = pruneDomainMap(mergedUp);
    }

    const lDel = l.deletedAtMs[domain] || {};
    const rDel = r.deletedAtMs[domain] || {};
    const delKeys = new Set([...Object.keys(lDel), ...Object.keys(rDel)]);
    if (delKeys.size > 0) {
      const mergedDel: Record<string, number> = {};
      for (const k of delKeys) {
        mergedDel[k] = Math.max(lDel[k] ?? 0, rDel[k] ?? 0);
      }
      deletedAtMs[domain] = pruneDomainMap(mergedDel);
    }
  }

  return {
    schemaVersion: 1,
    updatedAtMs: Math.max(l.updatedAtMs, r.updatedAtMs),
    profileUpdatedAtMs: Math.max(l.profileUpdatedAtMs, r.profileUpdatedAtMs),
    upsertedAtMs,
    deletedAtMs,
  };
}

export function getItemUpsertTimestamp(
  ledger: SyncTombstoneLedgerV1,
  domain: SyncTombstoneDomain,
  itemId: string,
  fallbackTimestampMs: number = 0
): number {
  return Math.max(ledger.upsertedAtMs[domain]?.[itemId] ?? 0, sanitizeTimestamp(fallbackTimestampMs));
}

export function getItemDeleteTimestamp(
  ledger: SyncTombstoneLedgerV1,
  domain: SyncTombstoneDomain,
  itemId: string
): number {
  return ledger.deletedAtMs[domain]?.[itemId] ?? 0;
}

/**
 * Returns true if the item has an active tombstone whose deletion timestamp is >= its latest upsert timestamp.
 */
export function isItemDeletedInLedger(
  ledger: SyncTombstoneLedgerV1,
  domain: SyncTombstoneDomain,
  itemId: string,
  fallbackItemTimestampMs: number = 0
): boolean {
  const delTs = getItemDeleteTimestamp(ledger, domain, itemId);
  if (delTs <= 0) return false;
  const upTs = getItemUpsertTimestamp(ledger, domain, itemId, fallbackItemTimestampMs);
  return delTs >= upTs;
}

export function countActiveTombstones(ledger: SyncTombstoneLedgerV1): number {
  let count = 0;
  for (const domain of ALL_SYNC_TOMBSTONE_DOMAINS) {
    const delMap = ledger.deletedAtMs[domain];
    if (!delMap) continue;
    for (const itemId of Object.keys(delMap)) {
      if (isItemDeletedInLedger(ledger, domain, itemId)) {
        count += 1;
      }
    }
  }
  return count;
}
