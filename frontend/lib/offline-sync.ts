import NetInfo from '@react-native-community/netinfo';

import { createDailyReport, createEvent, createFarm, createFlock, createStockMovement } from './api';
import { getItem, setItem } from '@/lib/storage';

export const OFFLINE_QUEUE_KEY = 'sync_queue';
export const LAST_SYNC_KEY = 'last_sync';
export const LOCAL_ID_MAP_KEY = 'offline_local_id_map';

export type DailyReportQueueItem = {
  type: 'daily_report';
  createdAt: number;
  farm_id: number;
  flock_id: number;
  report_date: string;
  bird_count: number;
  mortality: number;
  eggs_produced: number;
  egg_stock?: number;
  cartons?: number;
  alveoli?: number;
  remaining_eggs?: number;
  feed_used_bags?: number;
  water_used_liters?: number;
  notes?: string;
  created_by?: number | null;
};

export type StockMovementQueueItem = {
  type: 'stock_movement';
  createdAt: number;
  farm_id: number;
  flock_id?: number | null;
  movement: 'Entrée' | 'Sortie';
  stockType: string;
  qty: number;
  unit: string;
  motif?: string;
  date: string;
};

export type FarmQueueItem = {
  type: 'farm';
  createdAt: number;
  local_id: number;
  name: string;
  location?: string | null;
};

export type FlockQueueItem = {
  type: 'flock';
  createdAt: number;
  local_id: number;
  farm_id: number;
  name?: string | null;
  bird_count: number;
  breed?: string | null;
  start_date?: string | null;
};

export type EventQueueItem = {
  type: 'event';
  createdAt: number;
  farm_ids: number[];
  flock_id?: number | null;
  event_type: string;
  title: string;
  event_date: string;
  description?: string | null;
  reminder_date?: string | null;
  financial_type?: 'cost' | 'benefit' | null;
  financial_amount?: number | null;
};

export type OfflineQueueItem = DailyReportQueueItem | StockMovementQueueItem | FarmQueueItem | FlockQueueItem | EventQueueItem;

export async function loadOfflineQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveOfflineQueue(items: OfflineQueueItem[]) {
  await setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueOfflineItem(item: OfflineQueueItem) {
  const queue = await loadOfflineQueue();
  queue.push(item);
  await saveOfflineQueue(queue);
  return queue.length;
}

export async function getPendingSyncCount(): Promise<number> {
  const queue = await loadOfflineQueue();
  return queue.length;
}

export function normalizeQueueDate(value: string | undefined | null): string {
  if (!value) return new Date().toISOString();

  const trimmed = value.trim();
  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) {
    return new Date().toISOString();
  }

  const [, day, month, year, hour = '0', minute = '0'] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

export async function isNetworkConnected(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

export type SyncResult = {
  synced: number;
  failed: number;
  kept: number;
  failedItems: OfflineQueueItem[];
};

type LocalIdMap = Map<number, number>;

async function loadLocalIdMap(): Promise<LocalIdMap> {
  try {
    const raw = await getItem(LOCAL_ID_MAP_KEY);
    const entries = raw ? JSON.parse(raw) : [];
    return new Map(Array.isArray(entries) ? entries : []);
  } catch {
    return new Map();
  }
}

async function saveLocalIdMap(ids: LocalIdMap): Promise<void> {
  await setItem(LOCAL_ID_MAP_KEY, JSON.stringify(Array.from(ids.entries())));
}

const resolveId = (id: number | null | undefined, ids: LocalIdMap): number | null | undefined => {
  if (id === null || id === undefined) return id;
  return ids.get(id) ?? id;
};

export async function syncOfflineItem(item: OfflineQueueItem, ids?: LocalIdMap): Promise<void> {
  const localIds = ids ?? await loadLocalIdMap();
  if (item.type === 'daily_report') {
    await createDailyReport({
      farm_id: resolveId(item.farm_id, localIds) as number,
      flock_id: resolveId(item.flock_id, localIds) as number,
      report_date: item.report_date,
      bird_count: item.bird_count,
      mortality: item.mortality,
      eggs_produced: item.eggs_produced,
      egg_stock: item.egg_stock ?? 0,
      cartons: item.cartons ?? 0,
      alveoli: item.alveoli ?? 0,
      remaining_eggs: item.remaining_eggs ?? 0,
      feed_used_bags: item.feed_used_bags ?? 0,
      water_used_liters: item.water_used_liters ?? 0,
      notes: item.notes ?? '',
      created_by: item.created_by ?? null,
    });
    return;
  }

  if (item.type === 'stock_movement') {
    await createStockMovement({
      farm_id: resolveId(item.farm_id, localIds) as number,
      flock_id: resolveId(item.flock_id, localIds) as number | null,
      stock_type: item.stockType,
      movement_type: item.movement,
      quantity: item.qty,
      unit: item.unit,
      note: item.motif ?? null,
      movement_date: normalizeQueueDate(item.date),
    });
    return;
  }

  if (item.type === 'farm') {
    const farm = await createFarm({ name: item.name, location: item.location ?? undefined });
    localIds.set(item.local_id, farm.id);
    if (!ids) await saveLocalIdMap(localIds);
    return;
  }

  if (item.type === 'flock') {
    const flock = await createFlock({
      farm_id: resolveId(item.farm_id, localIds) as number,
      name: item.name ?? undefined,
      bird_count: item.bird_count,
      breed: item.breed ?? undefined,
      start_date: item.start_date ?? undefined,
    });
    localIds.set(item.local_id, flock.id);
    if (!ids) await saveLocalIdMap(localIds);
    return;
  }

  await createEvent({
    farm_ids: item.farm_ids.map((id) => resolveId(id, localIds) as number),
    flock_id: resolveId(item.flock_id, localIds) as number | null,
    type: item.event_type,
    title: item.title,
    event_date: item.event_date,
    description: item.description ?? undefined,
    reminder_date: item.reminder_date ?? undefined,
    financial_type: item.financial_type ?? undefined,
    financial_amount: item.financial_amount ?? undefined,
  });
}

export async function flushOfflineQueue(): Promise<SyncResult> {
  if (!(await isNetworkConnected())) {
    return { synced: 0, failed: 0, kept: 0, failedItems: [] };
  }

  const queue = await loadOfflineQueue();
  if (queue.length === 0) {
    return { synced: 0, failed: 0, kept: 0, failedItems: [] };
  }

  const remaining: OfflineQueueItem[] = [];
  let synced = 0;
  let failed = 0;
  const failedItems: OfflineQueueItem[] = [];
  const localIds = await loadLocalIdMap();

  for (const item of queue) {
    try {
      await syncOfflineItem(item, localIds);
      await saveLocalIdMap(localIds);
      synced += 1;
    } catch {
      remaining.push(item);
      failedItems.push(item);
      failed += 1;
    }
  }

  await saveOfflineQueue(remaining);

  if (synced > 0) {
    await setItem(LAST_SYNC_KEY, String(Date.now()));
  }

  return { synced, failed, kept: remaining.length, failedItems };
}
