import { getAuthToken } from './auth-storage';
import { getItem, setItem } from './storage';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  enterprise_name?: string | null;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  enterprise_name?: string;
  invitation_token?: string;
};

const parseResponse = async (response: Response) => {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error('Le serveur est indisponible. Vérifiez que le backend et sa base de données sont démarrés.');
    }
    if (response.status === 401) {
      throw new Error('Adresse e-mail ou mot de passe incorrect.');
    }
    if (response.status === 403) {
      throw new Error(typeof body?.detail === 'string' ? body.detail : 'Ce compte est désactivé ou ne dispose pas des autorisations nécessaires.');
    }
    throw new Error(typeof body?.detail === 'string' ? body.detail : 'Request failed');
  }
  return body;
};

const API_CACHE_PREFIX = 'api_cache:';

async function cacheKey(path: string) {
  const rawUser = await getItem('user_data');
  let userId = 'anonymous';
  try {
    userId = rawUser ? String(JSON.parse(rawUser).id || userId) : userId;
  } catch {
    // Use the anonymous namespace when local profile data is invalid.
  }
  return `${API_CACHE_PREFIX}${userId}:${path}`;
}

async function readCached<T>(path: string): Promise<T | null> {
  try {
    const raw = await getItem(await cacheKey(path));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeCached(path: string, value: unknown) {
  try {
    await setItem(await cacheKey(path), JSON.stringify(value));
  } catch {
    // A full cache must never prevent the app from using the network.
  }
}

async function request(path: string, init: RequestInit = {}) {
  const token = await getAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const isCacheable = (init.method || 'GET').toUpperCase() === 'GET';

  try {
    const body = await parseResponse(await fetch(`${API_URL}${path}`, { ...init, headers }));
    if (isCacheable) void writeCached(path, body);
    return body;
  } catch (error) {
    if (isCacheable) {
      const cached = await readCached(path);
      if (cached !== null) return cached;
    }
    throw error;
  }
}

export const api = {
  get: async (path: string, init: RequestInit = {}) => ({ data: await request(path, { ...init, method: 'GET' }) }),
  post: async (path: string, body?: unknown, init: RequestInit = {}) => ({
    data: await request(path, {
      ...init,
      method: 'POST',
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      headers: body === undefined ? init.headers : new Headers(init.headers || {}),
    }),
  }),
  patch: async (path: string, body?: unknown, init: RequestInit = {}) => ({
    data: await request(path, {
      ...init,
      method: 'PATCH',
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      headers: body === undefined ? init.headers : new Headers(init.headers || {}),
    }),
  }),
  delete: async (path: string, init: RequestInit = {}) => ({
    data: await request(path, { ...init, method: 'DELETE' }),
  }),
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const body = new URLSearchParams({ username: email.trim().toLowerCase(), password });
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    return parseResponse(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Impossible de joindre le serveur (${API_URL}).`);
    }
    throw error;
  }
}

export async function register(data: RegisterRequest): Promise<User> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, email: data.email.trim().toLowerCase() }),
  });
  return parseResponse(response);
}

export const requestPasswordReset = (email: string): Promise<{ message: string; email: string; reset_requested: boolean }> =>
  request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });

export const resetPassword = (token: string, password: string): Promise<{ message: string }> =>
  request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });

export const verifyEmail = (token: string): Promise<{ message: string }> =>
  request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

export const resendVerificationEmail = (email: string): Promise<{ message: string }> =>
  request('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });

export const updateProfile = (name: string): Promise<User> =>
  request('/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) });

export type Farm = {
  id: number;
  enterprise_id: number;
  name: string;
  location: string | null;
  active: boolean;
  created_at: string;
  food_type: string | null;
  food_quantity: number;
  food_unit: string;
  water_quantity: number;
  water_unit: string;
  egg_stock: number;
  cartons: number;
  alveoli: number;
  mortality: number;
};

export const formatEggStock = (eggStock: number, cartons?: number, alveoli?: number): string => {
  const safeEggs = Math.max(0, Math.floor(eggStock || 0));
  const cartonCount = cartons ?? Math.floor(safeEggs / 360);
  const alveoliCount = alveoli ?? Math.floor((safeEggs % 360) / 30);
  return `${cartonCount}crt${alveoliCount}alv`;
};

export type Flock = {
  id: number;
  farm_id: number;
  name?: string | null;
  bird_count: number;
  initial_bird_count: number;
  breed: string | null;
  start_date: string | null;
  archived: boolean;
  archived_at: string | null;
  updated_at: string;
};

export type DailyReport = {
  id?: number;
  farm_id: number;
  flock_id?: number;
  report_date: string;
  bird_count: number;
  mortality: number;
  eggs_produced: number;
  hen_age?: number;
  egg_stock: number;
  cartons: number;
  alveoli: number;
  remaining_eggs: number;
  feed_used_bags?: number;
  water_used_liters?: number;
  notes?: string;
  created_by?: number | null;
  author_name?: string | null;
  created_by_name?: string | null;
  created_at?: string;
};

export type Notification = {
  id: number;
  title: string;
  message: string;
  scheduled_at: string | null;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type DashboardSummary = {
  farms: number;
  hens: number;
  eggs: number;
  mortality: number;
  stock: number;
  food?: number;
  average_laying_percentage: number | null;
  farms_detail: { farm_id: number; farm_name: string; hens: number; eggs: number; mortality: number; stock: number; food?: number }[];
};

export type Event = {
  id: number;
  farm_id: number;
  flock_id?: number | null;
  type: string;
  title: string;
  event_date: string;
  description: string | null;
  reminder_date: string | null;
  created_by: number | null;
  created_at: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  confirmation_message?: string | null;
  confirmed_by?: number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
};

export type FarmComparison = {
  farm_id: number;
  hens_reported: number;
  eggs: number;
  average_laying_percentage: number | null;
  mortality: number;
  stock: number;
};

export type StockMovement = {
  id?: number;
  farm_id: number;
  flock_id?: number | null;
  stock_type: string;
  movement_type: 'Entrée' | 'Sortie';
  quantity: number;
  unit: string;
  note?: string | null;
  movement_date?: string;
  created_by?: number | null;
  created_at?: string;
  status: 'pending' | 'validated' | 'rejected' | 'cancelled';
  validated_by?: number | null;
  created_by_name?: string | null;
  validated_by_name?: string | null;
  validated_at?: string | null;
  confirmation_message?: string | null;
  product_name?: string | null;
  market_price_id?: number | null;
  unit_price?: number | null;
  total_value?: number | null;
  price_tier?: string | null;
};

export const listStockMovements = (farmId?: number): Promise<StockMovement[]> =>
  request(farmId ? `/stock-movements?farm_id=${farmId}` : '/stock-movements');

export const createStockMovement = (data: Omit<StockMovement, 'id' | 'created_by' | 'created_at' | 'status' | 'validated_by' | 'validated_at' | 'confirmation_message'>): Promise<StockMovement> =>
  request('/stock-movements', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      movement_date: data.movement_date ?? new Date().toISOString(),
    }),
  });

export const validateStockMovement = (movementId: number, confirmationMessage: string): Promise<StockMovement> =>
  request(`/stock-movements/${movementId}/validate`, {
    method: 'PATCH',
    body: JSON.stringify({ confirmation_message: confirmationMessage }),
  });

export const cancelStockMovement = (movementId: number, confirmationMessage: string): Promise<StockMovement> =>
  request(`/stock-movements/${movementId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ confirmation_message: confirmationMessage }),
  });

export const deleteStockMovement = (movementId: number): Promise<void> =>
  request(`/stock-movements/${movementId}`, { method: 'DELETE' }) as Promise<void>;

export type InvitationCreated = {
  id: number;
  enterprise_id: number;
  farm_id: number;
  invited_email: string;
  role: string;
  expires_at: string;
  used_at?: string | null;
  is_active?: boolean;
  created_at?: string;
  invitation_token: string;
};

export const listFarms = (includeInactive = false): Promise<Farm[]> => request(`/farms${includeInactive ? '?include_inactive=true' : ''}`);

export const createFarm = (data: { name: string; location?: string }): Promise<Farm> =>
  request('/farms', { method: 'POST', body: JSON.stringify(data) });

export const updateFarm = (farmId: number, data: { name?: string; location?: string; active?: boolean }): Promise<Farm> =>
  request(`/farms/${farmId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const listFlocks = (includeArchived = false): Promise<Flock[]> => request(`/flocks${includeArchived ? '?include_archived=true' : ''}`);

export const createFlock = (data: { farm_id: number; name?: string; bird_count: number; breed?: string; start_date?: string }): Promise<Flock> =>
  request('/flocks', { method: 'POST', body: JSON.stringify(data) });

export const updateFlock = (flockId: number, data: { name?: string; bird_count?: number; breed?: string; start_date?: string; archived?: boolean }): Promise<Flock> =>
  request(`/flocks/${flockId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const createDailyReport = (data: DailyReport): Promise<DailyReport & { id: number }> =>
  request('/daily-reports', { method: 'POST', body: JSON.stringify(data) });

export const updateDailyReport = (
  reportId: number,
  data: Partial<Omit<DailyReport, 'farm_id' | 'flock_id'>>,
): Promise<DailyReport & { id: number }> =>
  request(`/daily-reports/${reportId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const listNotifications = (): Promise<Notification[]> => request('/notifications');

export const listDailyReports = (farmId?: number): Promise<DailyReport[]> => request(farmId ? `/daily-reports?farm_id=${farmId}` : '/daily-reports');

export const sendFarmNotification = (farmId: number, title: string, message: string) =>
  request('/notifications/farm', { method: 'POST', body: JSON.stringify({ farm_id: farmId, title, message }) });

export const markNotificationRead = (notificationId: number): Promise<Notification> =>
  request(`/notifications/${notificationId}/read`, { method: 'PATCH' });

export const getDashboard = (period: 'today' | '7d' | '30d' | 'custom' = 'today', startDate?: string, endDate?: string): Promise<DashboardSummary> => request(`/analytics/dashboard?period=${period}${startDate ? `&start_date=${startDate}` : ''}${endDate ? `&end_date=${endDate}` : ''}`);

export const compareFarms = (farmIds: number[]): Promise<FarmComparison[]> =>
  request(`/analytics/farm-comparison?${farmIds.map((id) => `farm_ids=${id}`).join('&')}`);

export const createEvent = (data: {
  farm_ids: number[];
  flock_id?: number | null;
  type: string;
  title: string;
  event_date: string;
  description?: string;
  reminder_date?: string;
  financial_type?: 'cost' | 'benefit';
  financial_amount?: number;
}): Promise<Event[]> => request('/events', { method: 'POST', body: JSON.stringify(data) });

export const updateEvent = (eventId: number, data: Partial<Omit<Event, 'id' | 'farm_id' | 'created_by' | 'created_at'>>) =>
  request(`/events/${eventId}`, { method: 'PATCH', body: JSON.stringify(data) }) as Promise<Event>;

export const cancelEvent = (eventId: number, confirmationMessage: string): Promise<Event> =>
  request(`/events/${eventId}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ confirmation_message: confirmationMessage }),
  }) as Promise<Event>;

export const deleteEvent = (eventId: number): Promise<void> =>
  request(`/events/${eventId}`, { method: 'DELETE' }) as Promise<void>;

export const confirmEvent = (eventId: number, confirmationMessage: string): Promise<Event> =>
  request(`/events/${eventId}/confirm`, { 
    method: 'PATCH', 
    body: JSON.stringify({ confirmation_message: confirmationMessage })
  }) as Promise<Event>;

export const listEvents = (): Promise<Event[]> => request('/events');

export type FlockRacePreset = {
  id: number;
  name: string;
  description?: string;
  category?: string;
  created_at: string;
};

export const listFlockRacePresets = (): Promise<FlockRacePreset[]> => request('/flock-races');

export const listFlockRacesByCategory = (category: string): Promise<FlockRacePreset[]> => 
  request(`/flock-races/by-category/${category}`);

export type MarketPrice = { id: number; product: string; product_key?: string | null; region: string; price: number; price_low?: number | null; price_mid?: number | null; price_high?: number | null; note_low?: string | null; note_mid?: string | null; note_high?: string | null; tags?: string | null; unit: string; source: string; price_date: string };
export const listMarketPrices = (): Promise<MarketPrice[]> => request('/market-prices');
export const createMarketPrice = (data: Omit<MarketPrice, 'id'>): Promise<MarketPrice> => request('/market-prices', { method: 'POST', body: JSON.stringify(data) });
export const updateMarketPrice = (priceId: number, data: Partial<Omit<MarketPrice, 'id'>>): Promise<MarketPrice> => request(`/market-prices/${priceId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const refreshMarketPrices = (): Promise<MarketPrice[]> => request('/market-prices/refresh', { method: 'POST' });

export const createInvitation = (data: {
  enterprise_id: number;
  farm_id: number;
  email: string;
  role: 'MANAGER' | 'WORKER';
  expires_in_hours: number;
}): Promise<InvitationCreated> => request('/personnel/invitations', { method: 'POST', body: JSON.stringify(data) });

export type PermissionKey = 'create_flock' | 'create_event' | 'send_notification' | 'confirm_stock_movement' | 'export_daily_reports' | 'export_event_reports' | 'export_movement_reports';
export type PermissionMap = Record<PermissionKey, boolean>;

export type FarmMember = {
  membership_id?: number;
  id: number;
  name: string;
  email: string;
  role: string;
  farm_role: string;
  is_active: boolean;
  permissions?: Record<string, boolean>;
};

export const getCurrentUser = async (): Promise<{ id?: number; role?: string } | null> => {
  try {
    const rawUser = await getItem('user_data');
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
};

export const getFarmPermissionState = async (farmId: number): Promise<PermissionMap> => {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { create_flock: false, create_event: false, send_notification: false, confirm_stock_movement: false, export_daily_reports: false, export_event_reports: false, export_movement_reports: false };
  }
  if (currentUser.role === 'OWNER') {
    return { create_flock: true, create_event: true, send_notification: true, confirm_stock_movement: true, export_daily_reports: true, export_event_reports: true, export_movement_reports: true };
  }

  try {
    const result = await getMyFarmPermissions(farmId);
    const permissions = result.permissions ?? {};
    return {
      create_flock: !!permissions.create_flock,
      create_event: !!permissions.create_event,
      send_notification: !!permissions.send_notification,
      confirm_stock_movement: !!permissions.confirm_stock_movement,
      export_daily_reports: !!permissions.export_daily_reports,
      export_event_reports: !!permissions.export_event_reports,
      export_movement_reports: !!permissions.export_movement_reports,
    };
  } catch {
    return { create_flock: false, create_event: false, send_notification: false, confirm_stock_movement: false, export_daily_reports: false, export_event_reports: false, export_movement_reports: false };
  }
};

export const listFarmMembers = (farmId: number): Promise<FarmMember[]> =>
  request(`/personnel/farms/${farmId}/members`);

export const getMyFarmPermissions = (farmId: number): Promise<{ permissions: Record<string, boolean> }> =>
  request(`/personnel/farms/${farmId}/my-permissions`);

export const listFarmInvitations = (farmId: number): Promise<InvitationCreated[]> =>
  request(`/personnel/farms/${farmId}`);

export const setMemberActive = (membershipId: number, active: boolean) =>
  request(`/personnel/memberships/${membershipId}/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' });

export const updateMemberPermissions = (membershipId: number, permissions: Record<string, boolean>) =>
  request(`/personnel/memberships/${membershipId}/permissions`, { method: 'PATCH', body: JSON.stringify(permissions) });

export const updateMember = (membershipId: number, data: { farm_id: number; role: 'MANAGER' | 'WORKER' }) =>
  request(`/personnel/memberships/${membershipId}`, { method: 'PATCH', body: JSON.stringify(data) });