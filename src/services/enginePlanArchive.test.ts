import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  IndexedDbSyncJournal,
  STORE_ENGINE_PLAN_ARCHIVE_HEADS,
  STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS,
  STORE_ENGINE_PLAN_ARCHIVE_RECORDS
} from './indexedDbSyncJournal';
import {
  commitEnginePlansArchiveRevision,
  initializeEnginePlansArchiveForScope,
  readCommittedEnginePlansArchive,
  rollbackEnginePlansArchiveRevision,
  verifyEnginePlansArchiveRevision
} from './enginePlanArchive';
import { PlanningEngine, type EngineGeneratedPlan } from './planningEngine';
import { STORAGE_KEYS, StorageService } from './storageService';
import { persistEnginePlansSnapshot } from './journaledSnapshotService';

function buildSamplePlan(id: string, title = 'خطة تجريبية', startSurah = 67): EngineGeneratedPlan {
  const plan = PlanningEngine.generatePlan({
    title,
    startSurah,
    startAyah: 1,
    endSurah: startSurah,
    endAyah: Math.min(5, startSurah === 67 ? 30 : 4),
    startDate: '2026-11-10',
    level: 'intermediate',
    dailyAvailableMinutes: 30,
    dailyRevisionMinutes: 20,
    paceType: 'verses_per_day',
    paceQuantity: 2,
    activeDays: [0, 1, 2, 3, 4, 5, 6],
    restDays: [],
    schedulePreference: 'single_session'
  });
  return {
    ...plan,
    id,
    title
  };
}

export async function runEnginePlanArchiveTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let dbCounter = 0;

  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error: any) {
      failed++;
      console.error(`  ❌ ${name}: ${error?.message || error}`);
    }
  };

  const inlineLock = async <T>(_name: string, task: () => Promise<T>): Promise<T> => task();

  const setupScopedJournal = (scope: string) => {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope(scope);
    const factory = new IDBFactory();
    const databaseName = `wird-engine-archive-test-${++dbCounter}`;
    const journal = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });
    return { factory, databaseName, journal };
  };

  await test('Database schema upgrades v9 -> v10 preserving legacy sync stores and adding archive stores', async () => {
    const factory = new IDBFactory();
    const dbName = `wird-v9-upgrade-${++dbCounter}`;

    await new Promise<void>((resolve, reject) => {
      const req = factory.open(dbName, 9);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { keyPath: 'seq', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => {
        const tx = req.result.transaction(['meta'], 'readwrite');
        tx.objectStore('meta').put({ key: 'legacyMarker', value: 'intact-v9' });
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:upgrade-check');
    const journal = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName: dbName });
    const db = await journal.getArchiveDatabase();

    assert(db.version === 10, `Expected DB version 10, got ${db.version}`);
    assert(db.objectStoreNames.contains(STORE_ENGINE_PLAN_ARCHIVE_HEADS), 'Archive heads store missing');
    assert(db.objectStoreNames.contains(STORE_ENGINE_PLAN_ARCHIVE_MANIFESTS), 'Archive manifests store missing');
    assert(db.objectStoreNames.contains(STORE_ENGINE_PLAN_ARCHIVE_RECORDS), 'Archive records store missing');

    const preserved = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(['meta'], 'readonly');
      const r = tx.objectStore('meta').get('legacyMarker');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    assert(preserved?.value === 'intact-v9', 'Existing v9 meta store data must survive v10 upgrade untouched');
    journal.close();
  });

  await test('Lossless legacy localStorage migration verifies SHA-256 and keeps original bytes intact', async () => {
    const { journal } = setupScopedJournal('user:legacy-migrator');
    const legacyPlan = buildSamplePlan('plan-legacy-1', 'خطة الملك القديمة', 67);
    const legacyRaw = JSON.stringify([legacyPlan]);
    StorageService.setRawItem(STORAGE_KEYS.ENGINE_PLANS, legacyRaw);

    const hydrated = await initializeEnginePlansArchiveForScope('user:legacy-migrator', { journal });
    assert(hydrated.migratedFromLegacy === true, 'Must report migration from legacy localStorage');
    assert(hydrated.revision === 1, `Expected revision 1, got ${hydrated.revision}`);
    assert(hydrated.records.length === 1 && hydrated.records[0].id === 'plan-legacy-1', 'Migrated record mismatch');
    assert(
      StorageService.getRawItem(STORAGE_KEYS.ENGINE_PLANS) === legacyRaw,
      'Legacy localStorage bytes must remain untouched as rollback backup'
    );

    const committed = await readCommittedEnginePlansArchive('user:legacy-migrator', { journal });
    assert(committed !== null && committed.records[0].id === 'plan-legacy-1', 'Archive readback must verify SHA-256');
    journal.close();
  });

  await test('Tampered manifest or record fails closed on SHA-256 verification', async () => {
    const { journal } = setupScopedJournal('user:tamper-check');
    const plan = buildSamplePlan('plan-tamper-1');
    const commitRes = await commitEnginePlansArchiveRevision('user:tamper-check', [plan], { journal });

    const db = await journal.getArchiveDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_ENGINE_PLAN_ARCHIVE_RECORDS], 'readwrite');
      const store = tx.objectStore(STORE_ENGINE_PLAN_ARCHIVE_RECORDS);
      const getReq = store.get(['user:tamper-check', commitRes.revision, 'plan-tamper-1']);
      getReq.onsuccess = () => {
        try {
          const row = getReq.result;
          if (!row) throw new Error('Expected archived record row to exist');
          row.record.title = 'تم العبث بالعنوان';
          store.put(row);
        } catch (err) {
          reject(err);
        }
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });

    const verified = await verifyEnginePlansArchiveRevision('user:tamper-check', commitRes.revision, { journal });
    assert(verified.valid === false, 'Tampered archive record must fail SHA-256 verification');

    let readFailed = false;
    try {
      await readCommittedEnginePlansArchive('user:tamper-check', { journal });
    } catch {
      readFailed = true;
    }
    assert(readFailed, 'Reading committed tampered archive must throw fail-closed error');
    journal.close();
  });

  await test('Archive scales past 100 plans cleanly and supports verified backup export + revision rollback', async () => {
    const { journal } = setupScopedJournal('user:large-archive');
    const manyPlans: EngineGeneratedPlan[] = Array.from({ length: 115 }, (_, idx) =>
      buildSamplePlan(`plan-bulk-${idx + 1}`, `خطة رقم ${idx + 1}`, 112)
    );

    const rev1 = await commitEnginePlansArchiveRevision('user:large-archive', manyPlans, { journal });
    assert(rev1.records.length === 115 && StorageService.getEnginePlans().length === 115, 'All 115 plans must be active in hydrated memory');

    const extraPlan = buildSamplePlan('plan-bulk-116', 'خطة إضافية', 67);
    const rev2 = await commitEnginePlansArchiveRevision('user:large-archive', [...manyPlans, extraPlan], { journal });
    assert(rev2.revision === 2 && StorageService.getEnginePlans().length === 116, 'Revision 2 must contain 116 plans');

    const rollback = await rollbackEnginePlansArchiveRevision('user:large-archive', rev1.revision, { journal });
    assert(rollback.revision === 1 && rollback.records.length === 115 && StorageService.getEnginePlans().length === 115,
      'Rollback must restore head pointer to revision 1 with 115 plans');

    // Clear legacy localStorage copy and confirm exportFullBackupVerified reads hydrated v10 archive
    StorageService.setRawItem(STORAGE_KEYS.ENGINE_PLANS, '[]');
    const backupJson = await StorageService.exportFullBackupVerified({ journal });
    const backup = JSON.parse(backupJson) as { enginePlans?: EngineGeneratedPlan[] };
    assert(Array.isArray(backup.enginePlans) && backup.enginePlans.length === 115,
      `Expected 115 exported plans from archive, got ${backup.enginePlans?.length}`);
    journal.close();
  });

  await test('persistEnginePlansSnapshot commits archive revision, journal event, and outbox atomically', async () => {
    const { journal } = setupScopedJournal('user:atomic-commit');
    await initializeEnginePlansArchiveForScope('user:atomic-commit', { journal });

    const plan = buildSamplePlan('plan-atomic-1', 'خطة ذرية');
    const result = await persistEnginePlansSnapshot([plan], { journal, runExclusive: inlineLock });
    assert(result.success === true && result.mode === 'journal', 'Journaled engine plan snapshot must succeed');

    const snapshot = await journal.getSnapshot();
    assert(snapshot.eventCount === 1 && snapshot.pendingCount === 1 && snapshot.projectionCursor === 1,
      'Atomic commit must enqueue 1 journal event + 1 outbox mutation and advance cursor');

    const archive = await readCommittedEnginePlansArchive('user:atomic-commit', { journal });
    assert(archive !== null && archive.records.length === 1 && archive.records[0].id === 'plan-atomic-1',
      'Committed archive must contain the persisted plan');
    journal.close();
  });

  await test('Scope isolation prevents user:beta from hydrating user:alpha plans', async () => {
    const factory = new IDBFactory();
    const databaseName = `wird-scope-iso-${++dbCounter}`;
    const journal = new IndexedDbSyncJournal({ indexedDBFactory: factory, databaseName });

    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:alpha');
    const alphaPlan = buildSamplePlan('alpha-plan-1', 'خطة ألفا');
    await commitEnginePlansArchiveRevision('user:alpha', [alphaPlan], { journal });

    StorageService.setStorageScope('user:beta');
    const betaHydrated = await initializeEnginePlansArchiveForScope('user:beta', { journal });
    assert(betaHydrated.records.length === 0 && StorageService.getEnginePlans().length === 0,
      'User beta must never read or hydrate user alpha engine plans');

    StorageService.setStorageScope('guest');
    const guestHydrated = await initializeEnginePlansArchiveForScope('guest', { journal });
    assert(guestHydrated.records.length === 0, 'Guest scope must remain completely isolated');
    journal.close();
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('enginePlanArchive.test')) {
  runEnginePlanArchiveTests().then(res => {
    console.log(`Engine Plan Archive Tests: ${res.passed} passed, ${res.failed} failed`);
    if (res.failed > 0) process.exit(1);
  });
}
