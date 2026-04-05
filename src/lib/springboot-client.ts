import { env } from '../config/env';
import { getSpringBootFirebaseToken } from './backend-auth-context';
import { getCached, setCached } from './cache';
import type {
  EarningsSummaryDTO,
  OrderForStoreDTO,
  Order,
  Product,
  User,
  WithdrawalDTO,
  TrimmedOrder,
  TrimmedProduct,
  TrimmedMerchant,
  TrimmedWithdrawal,
  TrimmedOrderForStore,
} from '../types/api.types';

const BASE_URL = env.LIFE2FOOD_API_URL;

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(env.INTERNAL_API_KEY ? { 'X-Internal-Key': env.INTERNAL_API_KEY } : {}),
};

async function get<T>(path: string): Promise<T> {
  const token = getSpringBootFirebaseToken();
  const requestHeaders: Record<string, string> = {
    ...headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { headers: requestHeaders });
  if (!res.ok) {
    throw new Error(`Spring Boot API error: ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json() as Promise<T>;
}

// ─── Helpers to trim nested objects ─────────────────────────────────────────

function trimOrder(o: Order): TrimmedOrder {
  return {
    id: o.id,
    userId: o.user?.id ?? null,
    customerName: o.user ? `${o.user.first_name} ${o.user.last_name}` : null,
    totalPrice: o.totalPrice,
    status: o.status,
    createdAt: o.createdAt,
    itemCount: o.items?.length ?? 0,
    items: (o.items ?? []).map((item) => ({
      productName: item.product?.name ?? 'Unknown',
      quantity: item.quantity,
      price: item.price,
    })),
  };
}

function trimOrderForStore(o: OrderForStoreDTO): TrimmedOrderForStore {
  return {
    id: o.id,
    customerName: o.user ? `${o.user.first_name} ${o.user.last_name}` : null,
    totalPrice: o.totalPrice,
    storeStatus: o.storeStatus,
    createdAt: o.createdAt,
    items: (o.items ?? []).map((item) => ({
      productName: item.product?.name ?? 'Unknown',
      quantity: item.quantity,
      price: item.price,
    })),
  };
}

function trimProduct(p: Product): TrimmedProduct {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    expirationDate: p.expirationDate,
    amount: p.amount,
    storeName: p.user ? `${p.user.first_name} ${p.user.last_name}` : null,
    category: p.category?.name ?? null,
    imageUrl: p.imageUrl ?? null,
  };
}

function trimMerchant(u: User): TrimmedMerchant {
  return {
    id: u.id,
    name: `${u.first_name} ${u.last_name}`,
    email: u.email,
    businessCategory: u.businessCategory,
    address: u.address,
  };
}

function trimWithdrawal(w: WithdrawalDTO): TrimmedWithdrawal {
  return {
    id: w.id,
    amount: w.amount,
    status: w.status,
    createdAt: w.createdAt,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function fetchEarnings(storeOwnerId: number): Promise<EarningsSummaryDTO> {
  const cacheKey = `earnings:${storeOwnerId}`;
  const cached = getCached<EarningsSummaryDTO>(cacheKey);
  if (cached) return cached;

  const data = await get<EarningsSummaryDTO>(`/api/earnings/store/${storeOwnerId}`);
  setCached(cacheKey, data, 60);
  return data;
}

export async function fetchStoreOrders(storeOwnerId: number): Promise<TrimmedOrderForStore[]> {
  const cacheKey = `store-orders:${storeOwnerId}`;
  const cached = getCached<TrimmedOrderForStore[]>(cacheKey);
  if (cached) return cached;

  const data = await get<OrderForStoreDTO[]>(`/api/orders/store/${storeOwnerId}`);
  const trimmed = data.map(trimOrderForStore);
  setCached(cacheKey, trimmed, 60);
  return trimmed;
}

export async function fetchAllOrders(limit?: number): Promise<TrimmedOrder[]> {
  const cacheKey = `all-orders:${limit ?? 'all'}`;
  const cached = getCached<TrimmedOrder[]>(cacheKey);
  if (cached) return cached;

  const data = await get<Order[]>('/api/orders/all');
  const trimmed = data.slice(0, limit ?? data.length).map(trimOrder);
  setCached(cacheKey, trimmed, 60);
  return trimmed;
}

export async function fetchProducts(userId?: number): Promise<TrimmedProduct[]> {
  const path = userId ? `/products/user/${userId}` : '/products';
  const cacheKey = `products:${userId ?? 'all'}`;
  const cached = getCached<TrimmedProduct[]>(cacheKey);
  if (cached) return cached;

  const data = await get<Product[]>(path);
  const trimmed = data.map(trimProduct);
  setCached(cacheKey, trimmed, 60);
  return trimmed;
}

export async function fetchMerchants(): Promise<TrimmedMerchant[]> {
  const cacheKey = 'merchants';
  const cached = getCached<TrimmedMerchant[]>(cacheKey);
  if (cached) return cached;

  const data = await get<User[]>('/users');
  const merchants = data.filter((u) => u.business).map(trimMerchant);
  setCached(cacheKey, merchants, 120);
  return merchants;
}

export async function fetchWithdrawals(storeOwnerId: number): Promise<TrimmedWithdrawal[]> {
  const cacheKey = `withdrawals:${storeOwnerId}`;
  const cached = getCached<TrimmedWithdrawal[]>(cacheKey);
  if (cached) return cached;

  const data = await get<WithdrawalDTO[]>(`/api/withdrawals/store/${storeOwnerId}`);
  const trimmed = data.map(trimWithdrawal);
  setCached(cacheKey, trimmed, 60);
  return trimmed;
}

export interface PublicStore {
  id: number;
  name: string;
  businessCategory: string | null;
  address: string | null;
  storeDescription: string | null;
  openingTime: string | null;
  closingTime: string | null;
  workingDays: string | null;
}

export async function fetchMerchantsPublic(): Promise<PublicStore[]> {
  const cacheKey = 'merchants-public';
  const cached = getCached<PublicStore[]>(cacheKey);
  if (cached) return cached;

  const data = await get<User[]>('/users');
  const stores: PublicStore[] = data
    .filter((u) => u.business)
    .map((u) => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`,
      businessCategory: u.businessCategory,
      address: u.address,
      storeDescription: u.storeDescription,
      openingTime: u.openingTime,
      closingTime: u.closingTime,
      workingDays: u.workingDays,
    }));
  setCached(cacheKey, stores, 120);
  return stores;
}
