import { getItem } from '@/lib/storage';
import type { Notification } from '@/lib/api';

export type NotificationPreferences = {
  critical: boolean;
  stock: boolean;
  production: boolean;
};

export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  const [critical, stock, production] = await Promise.all([
    getItem('pref_notif_crit'),
    getItem('pref_notif_stock'),
    getItem('pref_notif_prod'),
  ]);
  return {
    critical: critical !== '0',
    stock: stock !== '0',
    production: production === '1',
  };
}

export function notificationPreferenceEnabled(notification: Notification, preferences: NotificationPreferences): boolean {
  const title = notification.title.toLowerCase();
  if (title.includes('stock')) return preferences.stock;
  if (title.includes('mortalité') || title.includes('mortality')) return preferences.critical;
  if (title.includes('production') || title.includes('ponte') || title.includes('œuf') || title.includes('egg')) return preferences.production;
  return true;
}
