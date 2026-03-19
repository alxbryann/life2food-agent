// Mirror of Spring Boot backend DTOs and models
// Source: life2food/backend/dto/ and life2food/backend/model/

export interface MonthlyEarningDTO {
  monthLabel: string; // e.g. "Ene", "Feb"
  year: number;
  month: number;
  amount: number;
}

export interface EarningsSummaryDTO {
  balanceAvailable: number;
  inProcess: number;
  totalEarned: number;
  completedOrdersCount: number;
  uniqueClientsCount: number;
  averageOrderValue: number;
  monthlyPercentChange: number; // % vs previous month (+20.0 or -5.0)
  monthlyEarnings: MonthlyEarningDTO[];
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  photo_url: string | null;
  storeLogoUrl: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  business: boolean;
  fcmToken: string | null;
  businessCategory: string | null;
  storeDescription: string | null;
  openingTime: string | null;
  closingTime: string | null;
  workingDays: string | null; // e.g. "0,1,2,3,4" (Mon-Fri)
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  user: User | null;
  category: Category | null;
  name: string;
  description: string | null;
  originalPrice: number | null;
  discountPercentage: number | null;
  price: number;
  amount: number | null;
  expirationDate: string | null; // ISO date string (java.sql.Date)
  imageUrl: string | null;
  createdAt: string | null;
}

export interface OrderItem {
  id: number;
  product: Product | null;
  quantity: number;
  price: number; // price at time of purchase
}

export interface Order {
  id: number;
  user: User | null;
  totalPrice: number;
  status: string; // PENDING | PAID | PREPARING | READY | COMPLETED | CANCELLED
  pickupCode: string | null;
  mpPaymentId: string | null;
  createdAt: string | null;
  items: OrderItem[];
}

export interface OrderForStoreDTO {
  id: number;
  user: User | null;
  totalPrice: number; // subtotal of this store's items only
  status: string; // global order status
  storeStatus: string; // PAID | PENDING | PREPARING | READY | COMPLETED
  pickupCode: string | null;
  createdAt: string | null;
  items: OrderItem[];
}

export interface WithdrawalDTO {
  id: number;
  amount: number;
  bankLast4: string | null;
  status: string; // PENDING | COMPLETED | REJECTED
  createdAt: string | null;
}

// Trimmed versions passed to LLM to avoid excessive token usage

export interface TrimmedOrder {
  id: number;
  userId: number | null;
  customerName: string | null;
  totalPrice: number;
  status: string;
  createdAt: string | null;
  itemCount: number;
  items: Array<{ productName: string; quantity: number; price: number }>;
}

export interface TrimmedProduct {
  id: number;
  name: string;
  price: number;
  expirationDate: string | null;
  amount: number | null;
  storeName: string | null;
  category: string | null;
}

export interface TrimmedMerchant {
  id: number;
  name: string;
  email: string;
  businessCategory: string | null;
  address: string | null;
}

export interface TrimmedWithdrawal {
  id: number;
  amount: number;
  status: string;
  createdAt: string | null;
}

export interface TrimmedOrderForStore {
  id: number;
  customerName: string | null;
  totalPrice: number;
  storeStatus: string;
  createdAt: string | null;
  items: Array<{ productName: string; quantity: number; price: number }>;
}
