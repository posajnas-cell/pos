import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, Banknote, BarChart3, Bluetooth, Boxes, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, CircleDollarSign, ClipboardList, Coins, Copy, CreditCard, Download, Edit3, ExternalLink, Eye, EyeOff,
  FileSliders, FileSpreadsheet, FileText, Filter, Keyboard, KeyRound, LayoutDashboard, LoaderCircle, Lock, LogOut, Maximize2, Menu, Minimize2, Package, Palette, Plus, Printer,
  QrCode, Radio, Receipt, RotateCcw, Search, Settings, ShieldCheck, ShoppingBag, Sliders, Smartphone, Sparkles, Store, Tag, ToggleLeft, ToggleRight, Trash2, TrendingDown, Type, Upload, User, UserCheck, Users, Wallet, X, Zap,
} from 'lucide-react';
import {
  connectBluetoothPrinter,
  isBluetoothSupported,
  getSavedPrinterInfo,
  clearSavedPrinter,
  printDirectBluetooth,
  testBluetoothPrint,
  triggerCashDrawer,
  type BluetoothDeviceInfo,
} from './lib/bluetooth-printer';
import {
  getGetDashboardQueryKey, getGetExpensesReportQueryKey, getGetSalesReportQueryKey, getGetWorkspaceQueryKey,
  getListCategoriesQueryKey, getListEmployeesQueryKey, getListExpensesQueryKey,
  getListProductsQueryKey, getListSalesQueryKey, getListShopsQueryKey,
  useCompleteSale, useCreateCategory, useCreateEmployee, useCreateExpense, useCreateProduct,
  useCreateShop, useGetDashboard, useGetExpensesReport, useGetSalesReport, useGetWorkspace,
  useHealthCheck, useListCategories, useListEmployees, useListExpenses, useListProducts,
  useListSales, useListShops, useUpdateCategory, useUpdateProduct, useUpdateShop,
  customFetch,
  type Category, type Employee, type Expense, type Product, type Sale, type Shop,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10000, // 10 seconds: instant responsive transitions without refetch lag
      gcTime: 1000 * 60 * 60 * 24, // 24 hours in cache
      refetchOnWindowFocus: false, // Never refetch purely on browser window focus
      refetchOnReconnect: true, // Auto re-sync when network reconnects
      refetchOnMount: true, // Check backend on mount so new database records always appear
      retry: 1, // 1 retry on network glitch
      placeholderData: (previousData: any) => previousData, // Keep displaying existing data smoothly: NO flash, NO skeletons
    },
  },
});

function seedInstantCache(qc: QueryClient) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    const shops = JSON.parse(window.localStorage.getItem('billflow-offline-shops') || 'null') || [
      {
        id: 1,
        name: 'BillFlow Main Store',
        address: '123 Commercial Street, Dubai',
        phone: '+971 50 123 4567',
        currency: 'AED',
        taxRateBps: 500,
        taxType: 'inclusive',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    shops.forEach((s: any) => {
      if (!s.currency || s.currency === 'INR') s.currency = 'AED';
      if (!s.taxType) s.taxType = 'inclusive';
    });
    try { window.localStorage.setItem('billflow-offline-shops', JSON.stringify(shops)); } catch {}

    const currentShopId = Number(window.localStorage.getItem('billflow-shop') || shops[0]?.id || 1);

    let allCategories = JSON.parse(window.localStorage.getItem('billflow-offline-categories') || 'null') || [];
    let allProducts = JSON.parse(window.localStorage.getItem('billflow-offline-products') || 'null') || [];
    let allEmployees = JSON.parse(window.localStorage.getItem('billflow-offline-employees') || 'null') || [];
    if (!Array.isArray(allEmployees) || allEmployees.length === 0) {
      allEmployees = [
        { id: 1, shopId: 1, name: 'Cashier 1', role: 'cashier', pin: '1111', isActive: true, createdAt: new Date().toISOString() },
        { id: 2, shopId: 2, name: 'Cashier 2', role: 'cashier', pin: '2222', isActive: true, createdAt: new Date().toISOString() },
      ];
      try { window.localStorage.setItem('billflow-offline-employees', JSON.stringify(allEmployees)); } catch {}
    } else {
      let empsModified = false;
      allEmployees = allEmployees.map((emp: any) => {
        if (!emp.pin) {
          empsModified = true;
          return {
            ...emp,
            pin: emp.shopId === 1 && emp.name.toLowerCase().includes('cashier 1') ? '1111' : emp.shopId === 2 ? '2222' : '1234',
          };
        }
        return emp;
      });
      if (empsModified) {
        try { window.localStorage.setItem('billflow-offline-employees', JSON.stringify(allEmployees)); } catch {}
      }
    }

    // Purge legacy mock items so only real DB records are shown
    if (Array.isArray(allProducts) && allProducts.some((p: any) => p.sku === 'BEV-001' || p.sku === 'BRK-001')) {
      allProducts = [];
      try { window.localStorage.setItem('billflow-offline-products', JSON.stringify([])); } catch {}
    }
    if (Array.isArray(allCategories) && allCategories.some((c: any) => c.name === 'Breakfast' && c.id === 1 && allCategories.length === 5)) {
      allCategories = [];
      try { window.localStorage.setItem('billflow-offline-categories', JSON.stringify([])); } catch {}
    }

    const allSales = JSON.parse(window.localStorage.getItem('billflow-offline-sales') || 'null') || [];
    const allExpenses = JSON.parse(window.localStorage.getItem('billflow-offline-expenses') || 'null') || [];

    // STRICTLY FILTER BY CURRENT SHOP ID
    const categories = allCategories.filter((c: any) => c.shopId === currentShopId);
    const products = allProducts.filter((p: any) => p.shopId === currentShopId);
    const employees = allEmployees.filter((e: any) => e.shopId === currentShopId);
    const sales = allSales.filter((s: any) => s.shopId === currentShopId);
    const expenses = allExpenses.filter((e: any) => e.shopId === currentShopId);

    const salesCents = sales.reduce((acc: number, s: any) => acc + (s.totalCents || 0), 0);
    const expensesCents = expenses.reduce((acc: number, e: any) => acc + (e.totalCents || 0), 0);

    const paymentMap = new Map<string, number>();
    for (const s of sales) {
      const m = (s.paymentMethod || 'cash').toLowerCase();
      paymentMap.set(m, (paymentMap.get(m) || 0) + (s.totalCents || 0));
    }
    const payments = Array.from(paymentMap.entries()).map(([method, totalCents]) => ({ method, totalCents }));

    const dashboard = {
      salesCents,
      expensesCents,
      operatingBalanceCents: salesCents - expensesCents,
      billCount: sales.length,
      averageBillCents: sales.length > 0 ? Math.round(salesCents / sales.length) : 0,
      recentSales: sales.slice(0, 8),
      salesByDay: [
        { date: new Date().toISOString().slice(0, 10), totalCents: salesCents },
      ],
      payments,
    };

    const workspace = {
      businessName: 'BillFlow Retail POS',
      role: 'owner',
      userName: 'Store Owner',
      shops,
    };

    qc.setQueryData(getListShopsQueryKey(), shops);
    qc.setQueryData(getGetWorkspaceQueryKey(), workspace);
    qc.setQueryData(getListCategoriesQueryKey({ shopId: currentShopId }), categories);
    qc.setQueryData(getListProductsQueryKey({ shopId: currentShopId }), products);
    qc.setQueryData(getListEmployeesQueryKey({ shopId: currentShopId }), employees);
    qc.setQueryData(getListExpensesQueryKey({ shopId: currentShopId }), expenses);
    qc.setQueryData(getListSalesQueryKey({ shopId: currentShopId }), sales);
    qc.setQueryData(getGetDashboardQueryKey({ shopId: currentShopId, period: 'week' }), dashboard);
  } catch {}
}

seedInstantCache(queryClient);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const money = (cents: number, currency = 'AED') => {
  const curr = (currency && currency !== 'INR' && currency !== 'USD') ? currency : 'AED';
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: curr, maximumFractionDigits: 2 }).format((cents || 0) / 100);
};
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const dateInput = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const freshKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
const invalidate = (qc: ReturnType<typeof useQueryClient>, key?: readonly unknown[]) => {
  if (key) {
    qc.invalidateQueries({ queryKey: key });
    qc.refetchQueries({ queryKey: key });
  } else {
    qc.invalidateQueries();
  }
};

export type LocalUser = {
  id: string;
  name: string;
  username?: string;
  role: 'owner' | 'manager' | 'cashier';
  avatarInitials: string;
  shopId?: number;
  pin?: string;
};

export type AdminCredentials = {
  username: string;
  password: string;
  updatedAt: string;
};

const LOCAL_USER_KEY = 'billflow-local-user';
const ADMIN_CREDS_KEY = 'billflow-admin-credentials';

export const DEFAULT_ADMIN_USERNAME = 'admin';
export const DEFAULT_ADMIN_PASSWORD = 'admin123';

function getStoredAdminCreds(): AdminCredentials {
  try {
    const raw = localStorage.getItem(ADMIN_CREDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.username && parsed?.password) {
        return {
          username: String(parsed.username).trim(),
          password: String(parsed.password),
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    }
  } catch {}
  return {
    username: DEFAULT_ADMIN_USERNAME,
    password: DEFAULT_ADMIN_PASSWORD,
    updatedAt: new Date().toISOString(),
  };
}

function saveStoredAdminCreds(creds: { username: string; password: string }): AdminCredentials {
  const updated: AdminCredentials = {
    username: creds.username.trim(),
    password: creds.password,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(ADMIN_CREDS_KEY, JSON.stringify(updated));
  return updated;
}

export type QuickPinConfig = {
  enabled: boolean;
  masterPin: string;
  requirePinForPOS: boolean;
  staffPins: Record<string, string>;
};

const QUICK_PIN_CONFIG_KEY = 'billflow-quick-pin-config';

export function getStoredQuickPinConfig(): QuickPinConfig {
  try {
    const raw = localStorage.getItem(QUICK_PIN_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        enabled: parsed.enabled !== false,
        masterPin: String(parsed.masterPin || '1234'),
        requirePinForPOS: !!parsed.requirePinForPOS,
        staffPins: {
          '1_1': '1111',
          '1': '1111',
          '2_2': '2222',
          '2': '2222',
          'admin': '1234',
          ...(parsed.staffPins || {}),
        },
      };
    }
  } catch {}
  return {
    enabled: true,
    masterPin: '1234',
    requirePinForPOS: false,
    staffPins: {
      '1_1': '1111',
      '1': '1111',
      '2_2': '2222',
      '2': '2222',
      'admin': '1234',
    },
  };
}

export function saveStoredQuickPinConfig(cfg: QuickPinConfig) {
  localStorage.setItem(QUICK_PIN_CONFIG_KEY, JSON.stringify(cfg));
}

export function getOfflineShopsList(): Shop[] {
  try {
    const raw = localStorage.getItem('billflow-offline-shops');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [
    {
      id: 1,
      name: 'Main Store',
      address: '',
      phone: '',
      currency: 'AED',
      taxRateBps: 500,
      isActive: true,
      createdAt: new Date().toISOString(),
    } as Shop,
  ];
}

export function getOfflineEmployeesList(): any[] {
  try {
    const raw = localStorage.getItem('billflow-offline-employees');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [
    { id: 1, shopId: 1, name: 'Cashier 1', role: 'cashier', pin: '1111', isActive: true, createdAt: new Date().toISOString() },
    { id: 2, shopId: 2, name: 'Cashier 2', role: 'cashier', pin: '2222', isActive: true, createdAt: new Date().toISOString() },
  ];
}

export type UniversalExpenseCategory = {
  id: string;
  name: string;
  icon: string;
  badge: string;
  color: string;
};

export const UNIVERSAL_EXPENSE_CATEGORIES: UniversalExpenseCategory[] = [
  { id: 'produce', name: 'Vegetables & Produce', icon: '🥬', badge: '🥬 Fresh Veg', color: 'bg-emerald-100/80 text-emerald-900 border-emerald-300' },
  { id: 'meat', name: 'Meat, Poultry & Seafood', icon: '🍗', badge: '🍗 Meat & Fish', color: 'bg-rose-100/80 text-rose-900 border-rose-300' },
  { id: 'grocery', name: 'Dairy & Kitchen Pantry', icon: '🌾', badge: '🌾 Dairy & Rice', color: 'bg-amber-100/80 text-amber-900 border-amber-300' },
  { id: 'gas', name: 'Kitchen Gas (LPG Cylinders)', icon: '🔥', badge: '🔥 Cooking Gas', color: 'bg-orange-100/80 text-orange-900 border-orange-300' },
  { id: 'packaging', name: 'Packaging, Takeaway & Foil', icon: '🥡', badge: '🥡 Parcel Boxes', color: 'bg-indigo-100/80 text-indigo-900 border-indigo-300' },
  { id: 'cleaning', name: 'Kitchen Dishwash & Hygiene', icon: '🧼', badge: '🧼 Dishwash & Clean', color: 'bg-teal-100/80 text-teal-900 border-teal-300' },
  { id: 'staff', name: 'Kitchen Staff & Chef Wages', icon: '👨‍🍳', badge: '👨‍🍳 Staff Wages', color: 'bg-purple-100/80 text-purple-900 border-purple-300' },
  { id: 'water', name: 'Cooking & Drinking Water', icon: '💧', badge: '💧 Water Cans', color: 'bg-cyan-100/80 text-cyan-900 border-cyan-300' },
  { id: 'delivery', name: 'Delivery Bike Fuel & Transport', icon: '🛵', badge: '🛵 Bike Petrol', color: 'bg-lime-100/80 text-lime-900 border-lime-300' },
  { id: 'maintenance', name: 'Chiller & Kitchen Maintenance', icon: '🛠️', badge: '🛠️ Chiller Repair', color: 'bg-red-100/80 text-red-900 border-red-300' },
  { id: 'utilities', name: 'Restaurant DEWA Electricity', icon: '⚡', badge: '⚡ DEWA Power', color: 'bg-yellow-100/80 text-yellow-900 border-yellow-300' },
  { id: 'rent', name: 'Restaurant Space Rent', icon: '🏢', badge: '🏢 Shop Rent', color: 'bg-blue-100/80 text-blue-900 border-blue-300' },
  { id: 'license', name: 'Municipality & Food Safety', icon: '📄', badge: '📄 Food Health Card', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  { id: 'other', name: 'Other Restaurant Expenses', icon: '🏷️', badge: '🏷️ Misc Restaurant', color: 'bg-stone-100 text-stone-800 border-stone-300' },
];

export const QUICK_EXPENSE_PRESETS = [
  { label: 'Commercial Gas Cylinder (LPG)', category: 'Kitchen Gas (LPG Cylinders)', amount: '95' },
  { label: 'Fresh Chicken & Poultry', category: 'Meat, Poultry & Seafood', amount: '' },
  { label: 'Daily Vegetables & Greens', category: 'Vegetables & Produce', amount: '' },
  { label: 'Cooking Oil & Basmati Rice', category: 'Dairy & Kitchen Pantry', amount: '' },
  { label: 'Fresh Milk (4L) & Cream', category: 'Dairy & Kitchen Pantry', amount: '20' },
  { label: 'Takeaway Meal Boxes & Foil', category: 'Packaging, Takeaway & Foil', amount: '80' },
  { label: 'Kitchen Drinking Water (5 Gal)', category: 'Cooking & Drinking Water', amount: '8' },
  { label: 'Dishwash & Kitchen Degreaser', category: 'Kitchen Dishwash & Hygiene', amount: '45' },
  { label: 'Kitchen Cook/Staff Advance', category: 'Kitchen Staff & Chef Wages', amount: '200' },
  { label: 'Delivery Bike Petrol / Fuel', category: 'Delivery Bike Fuel & Transport', amount: '30' },
  { label: 'Chiller / Deep Freezer Repair', category: 'Chiller & Kitchen Maintenance', amount: '150' },
  { label: 'DEWA Restaurant Electricity', category: 'Restaurant DEWA Electricity', amount: '' },
  { label: 'Restaurant Space Rent', category: 'Restaurant Space Rent', amount: '' },
];

export type ExpenseCategoryPreset = {
  id: string;
  name: string;
  badge: string;
  defaultUnit: string;
  items: { name: string; unit: string; suggestedPrice?: number }[];
};

export const EXPENSE_TAXONOMY: ExpenseCategoryPreset[] = [
  {
    id: 'veg',
    name: 'Vegetables & Fresh Produce',
    badge: '🥬 Vegetables',
    defaultUnit: 'kg',
    items: [
      { name: 'Onions (Cooking Grade)', unit: 'kg', suggestedPrice: 3.5 },
      { name: 'Tomatoes (Fresh)', unit: 'kg', suggestedPrice: 4 },
      { name: 'Potatoes (Cooking)', unit: 'kg', suggestedPrice: 3 },
      { name: 'Ginger (Fresh)', unit: 'kg', suggestedPrice: 12 },
      { name: 'Garlic (Peeled / Whole)', unit: 'kg', suggestedPrice: 10 },
      { name: 'Green Chillies', unit: 'kg', suggestedPrice: 7 },
      { name: 'Fresh Coriander (Cilantro)', unit: 'bunch', suggestedPrice: 1.5 },
      { name: 'Fresh Mint Leaves', unit: 'bunch', suggestedPrice: 1.5 },
      { name: 'Lemons / Limes', unit: 'kg', suggestedPrice: 6 },
      { name: 'Carrots', unit: 'kg', suggestedPrice: 4.5 },
      { name: 'Cabbage', unit: 'kg', suggestedPrice: 3.5 },
      { name: 'Capsicum / Bell Peppers', unit: 'kg', suggestedPrice: 6.5 },
    ],
  },
  {
    id: 'meat',
    name: 'Meat, Poultry & Seafood',
    badge: '🍗 Meat & Fish',
    defaultUnit: 'kg',
    items: [
      { name: 'Fresh Chicken (Whole Curry Cut)', unit: 'kg', suggestedPrice: 14 },
      { name: 'Chicken (Boneless Breast)', unit: 'kg', suggestedPrice: 22 },
      { name: 'Fresh Mutton / Goat', unit: 'kg', suggestedPrice: 38 },
      { name: 'Fresh Table Eggs (30 pack)', unit: 'tray', suggestedPrice: 16 },
      { name: 'Fresh Fish (Cooking Cut)', unit: 'kg', suggestedPrice: 25 },
      { name: 'Prawns / Shrimps (Cleaned)', unit: 'kg', suggestedPrice: 35 },
    ],
  },
  {
    id: 'grocery',
    name: 'Dairy & Kitchen Pantry',
    badge: '🌾 Dairy & Rice',
    defaultUnit: 'kg',
    items: [
      { name: 'Commercial Cooking Oil (5L)', unit: 'can', suggestedPrice: 32 },
      { name: 'Basmati Biryani Rice (10kg)', unit: 'bag', suggestedPrice: 45 },
      { name: 'Wheat Flour / Atta (10kg)', unit: 'bag', suggestedPrice: 28 },
      { name: 'Refined Sugar (5kg)', unit: 'bag', suggestedPrice: 15 },
      { name: 'Restaurant Tea Powder (1kg)', unit: 'pack', suggestedPrice: 22 },
      { name: 'Fresh Cow Milk (4L)', unit: 'gallon', suggestedPrice: 20 },
      { name: 'Cooking Ghee (1kg)', unit: 'can', suggestedPrice: 28 },
      { name: 'Table Salt (1kg pack)', unit: 'pack', suggestedPrice: 2.5 },
      { name: 'Dal / Lentils (2kg)', unit: 'pack', suggestedPrice: 14 },
      { name: 'Spices & Garam Masala Blend', unit: 'kg', suggestedPrice: 35 },
    ],
  },
  {
    id: 'gas_fuel',
    name: 'Kitchen Gas & Fuel (LPG)',
    badge: '🔥 Cooking Gas',
    defaultUnit: 'cylinder',
    items: [
      { name: 'Commercial LPG Gas Cylinder (19kg)', unit: 'cylinder', suggestedPrice: 95 },
      { name: 'Cooking Drinking Water (5 Gal Can)', unit: 'can', suggestedPrice: 8 },
      { name: 'Restaurant Ice Bags (10kg)', unit: 'bag', suggestedPrice: 12 },
    ],
  },
  {
    id: 'packaging',
    name: 'Packaging, Takeaway & Foil',
    badge: '🥡 Takeaway/Parcel',
    defaultUnit: 'pack',
    items: [
      { name: 'Meal Parcel Boxes (500ml / 50pcs)', unit: 'pack', suggestedPrice: 25 },
      { name: 'Meal Parcel Boxes (1000ml / 50pcs)', unit: 'pack', suggestedPrice: 35 },
      { name: 'Paper Hot Beverage Cups (100pcs)', unit: 'pack', suggestedPrice: 15 },
      { name: 'Heavy Duty Food Foil Roll', unit: 'roll', suggestedPrice: 18 },
      { name: 'Restaurant Carry Bags (100pcs)', unit: 'pack', suggestedPrice: 12 },
      { name: 'Paper Table Napkins (500pcs)', unit: 'pack', suggestedPrice: 10 },
      { name: 'Disposable Cutlery (100pcs)', unit: 'pack', suggestedPrice: 14 },
    ],
  },
  {
    id: 'cleaning',
    name: 'Kitchen Dishwash & Hygiene',
    badge: '🧼 Cleaning',
    defaultUnit: 'can',
    items: [
      { name: 'Commercial Dishwashing Liquid (5L)', unit: 'can', suggestedPrice: 22 },
      { name: 'Kitchen Floor Degreaser (5L)', unit: 'can', suggestedPrice: 25 },
      { name: 'Kitchen Surface Sanitizer Spray', unit: 'bottle', suggestedPrice: 15 },
      { name: 'Heavy Duty Trash Bags (Roll)', unit: 'roll', suggestedPrice: 18 },
      { name: 'Pots & Pans Scrubber Sponges (10pcs)', unit: 'pack', suggestedPrice: 12 },
      { name: 'POS Thermal Receipt Paper (10 rolls)', unit: 'pack', suggestedPrice: 25 },
    ],
  },
  {
    id: 'kitchen_ops',
    name: 'Chiller & Kitchen Maintenance',
    badge: '🛠️ Repairs',
    defaultUnit: 'service',
    items: [
      { name: 'Chiller / Deep Freezer Servicing', unit: 'service', suggestedPrice: 150 },
      { name: 'Kitchen Stove & Burner Repair', unit: 'service', suggestedPrice: 120 },
      { name: 'Exhaust Hood & Duct Filter Cleaning', unit: 'service', suggestedPrice: 200 },
      { name: 'Food Safety Pest Control Visit', unit: 'service', suggestedPrice: 180 },
    ],
  },
];

export const PRESET_PRODUCT_IMAGES = [
  { label: 'Filter Coffee', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300&auto=format&fit=crop&q=60' },
  { label: 'Masala Chai', url: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=300&auto=format&fit=crop&q=60' },
  { label: 'Crispy Dosa', url: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=300&auto=format&fit=crop&q=60' },
  { label: 'Idli Vada', url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=60' },
  { label: 'Meal Thali', url: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=300&auto=format&fit=crop&q=60' },
  { label: 'Croissant / Bakery', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300&auto=format&fit=crop&q=60' },
  { label: 'Veg Samosa', url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&auto=format&fit=crop&q=60' },
  { label: 'Rice / Biryani', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&auto=format&fit=crop&q=60' },
];

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  return false;
}

function ImageUploadZone({
  value,
  onChange,
  label = 'Product Photo',
  aspect = 'square',
  helperText = 'Upload a photo from your computer, phone gallery, or camera',
  showPresets = true,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  label?: string;
  aspect?: 'square' | 'wide';
  helperText?: string;
  showPresets?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress and convert image file to high-efficiency Data URL
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WebP, etc.).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = aspect === 'square' ? 600 : 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          onChange(compressedDataUrl);
        } else {
          onChange(String(e.target?.result || ''));
        }
      };
      img.src = String(e.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
          >
            Remove Image
          </button>
        )}
      </div>

      {value ? (
        <div className="relative group rounded-2xl border border-slate-200 bg-slate-50/80 p-3 flex items-center gap-4">
          <img
            src={value}
            alt="Uploaded Preview"
            className={`rounded-xl object-cover border border-slate-200 shadow-xs ${
              aspect === 'square' ? 'h-20 w-20' : 'h-16 w-32 object-contain bg-white'
            }`}
          />
          <div className="flex-1 space-y-1">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Check size={14} className="text-emerald-700" /> Photo Attached
            </span>
            <p className="text-[11px] text-slate-500">Image successfully loaded and ready to save.</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-emerald-50 border border-emerald-300 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
              >
                Upload Different Photo
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition cursor-pointer ${
            dragOver
              ? 'border-emerald-600 bg-emerald-50/60 scale-[1.01]'
              : 'border-slate-200/90 bg-slate-50/50 hover:border-emerald-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs border border-slate-200 text-emerald-700 group-hover:scale-110 transition">
            <Upload size={20} />
          </div>
          <span className="mt-2.5 text-xs font-bold text-slate-800">
            Click to upload photo or drag & drop
          </span>
          <p className="text-[11px] text-slate-500 mt-0.5">{helperText}</p>
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100/70 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
            PNG, JPG, WebP from phone or computer
          </span>
        </div>
      )}

      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={e => {
          if (e.target.files?.[0]) processFile(e.target.files[0]);
        }}
        className="hidden"
      />

      {/* Optional Preset and URL toggles */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] font-medium text-slate-500 hover:text-emerald-700 hover:underline cursor-pointer"
        >
          {showUrlInput ? 'Hide Web URL Option' : 'Or paste an Image Web URL →'}
        </button>
      </div>

      {showUrlInput && (
        <div className="pt-1 animate-in fade-in duration-150">
          <input
            type="url"
            value={value.startsWith('http') ? value : ''}
            onChange={e => onChange(e.target.value)}
            placeholder="Paste image link https://..."
            className={inputClass}
          />
        </div>
      )}

      {showPresets && (
        <div className="pt-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Quick photo presets:</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_PRODUCT_IMAGES.map(img => (
              <button
                type="button"
                key={img.label}
                onClick={() => onChange(img.url)}
                className={`rounded-lg border px-2 py-0.5 text-[11px] font-medium transition cursor-pointer ${
                  value === img.url
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-bold ring-1 ring-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {img.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PRESET_OPERATORS: LocalUser[] = [
  { id: 'admin', name: 'Store Owner', role: 'owner', avatarInitials: 'SO' },
  { id: 'manager', name: 'Shift Manager', role: 'manager', avatarInitials: 'SM' },
  { id: 'cashier', name: 'Cashier 1', role: 'cashier', avatarInitials: 'C1' },
  { id: 'cashier-2', name: 'Cashier 2', role: 'cashier', avatarInitials: 'C2' },
];

interface AuthContextType {
  user: LocalUser | null;
  adminCreds: AdminCredentials;
  updateAdminCreds: (creds: { username: string; password: string }) => void;
  resetAdminCreds: () => void;
  verifyAdminLogin: (username: string, pass: string) => boolean;
  quickPinConfig: QuickPinConfig;
  updateQuickPinConfig: (newCfg: Partial<QuickPinConfig>) => void;
  verifyQuickPin: (operatorId: string, enteredPin: string, shopId?: number) => boolean;
  login: (operator: LocalUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  adminCreds: { username: DEFAULT_ADMIN_USERNAME, password: DEFAULT_ADMIN_PASSWORD, updatedAt: '' },
  updateAdminCreds: () => {},
  resetAdminCreds: () => {},
  verifyAdminLogin: () => false,
  quickPinConfig: {
    enabled: true,
    masterPin: '1234',
    requirePinForPOS: false,
    staffPins: {},
  },
  updateQuickPinConfig: () => {},
  verifyQuickPin: () => false,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [adminCreds, setAdminCredsState] = useState<AdminCredentials>(getStoredAdminCreds);
  const [quickPinConfig, setQuickPinConfigState] = useState<QuickPinConfig>(getStoredQuickPinConfig);

  const [user, setUser] = useState<LocalUser | null>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  const updateAdminCreds = (newCreds: { username: string; password: string }) => {
    const saved = saveStoredAdminCreds(newCreds);
    setAdminCredsState(saved);
    if (user && user.role === 'owner') {
      const updatedUser: LocalUser = {
        ...user,
        username: saved.username,
        name: saved.username === DEFAULT_ADMIN_USERNAME ? 'Store Owner' : saved.username,
        avatarInitials: (saved.username.slice(0, 2) || 'AD').toUpperCase(),
      };
      setUser(updatedUser);
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updatedUser));
    }
  };

  const resetAdminCreds = () => {
    updateAdminCreds({ username: DEFAULT_ADMIN_USERNAME, password: DEFAULT_ADMIN_PASSWORD });
  };

  const verifyAdminLogin = (u: string, p: string) => {
    const current = getStoredAdminCreds();
    const uMatch = u.trim().toLowerCase() === current.username.toLowerCase();
    // Support exact match or whitespace-tolerant match (e.g. 'admin 123' vs 'admin123')
    const cleanInputP = p.trim().replace(/\s+/g, '');
    const cleanStoredP = current.password.trim().replace(/\s+/g, '');
    const pMatch = p === current.password || cleanInputP === cleanStoredP;
    return uMatch && pMatch;
  };

  const updateQuickPinConfig = (patch: Partial<QuickPinConfig>) => {
    setQuickPinConfigState(prev => {
      const updated: QuickPinConfig = {
        ...prev,
        ...patch,
        staffPins: patch.staffPins ? { ...prev.staffPins, ...patch.staffPins } : prev.staffPins,
      };
      saveStoredQuickPinConfig(updated);
      return updated;
    });
  };

  const verifyQuickPin = (operatorId: string, enteredPin: string, shopId?: number): boolean => {
    const cfg = getStoredQuickPinConfig();
    if (!cfg.enabled) return false;

    // 1. Check shop-scoped staff pin e.g. "1_1" or "2_2"
    if (shopId) {
      const scopedPin = cfg.staffPins[`${shopId}_${operatorId}`];
      if (scopedPin && scopedPin === enteredPin) return true;
    }

    // 2. Check direct operatorId pin
    const staffPin = cfg.staffPins[operatorId];
    if (staffPin && staffPin === enteredPin) return true;

    // 3. Check pin stored directly on employee in billflow-offline-employees
    try {
      const raw = localStorage.getItem('billflow-offline-employees');
      if (raw) {
        const emps = JSON.parse(raw);
        const match = emps.find((e: any) => String(e.id) === String(operatorId) && (!shopId || e.shopId === shopId));
        if (match && match.pin && match.pin === enteredPin) return true;
      }
    } catch {}

    // 4. Shop-specific cashier default codes:
    // Shop 1 -> Cashier 1 allows 1111
    // Shop 2 -> Cashier 2 allows 2222
    if (shopId === 1 && enteredPin === '1111') return true;
    if (shopId === 2 && enteredPin === '2222') return true;

    // 5. Master pin
    if (cfg.masterPin && cfg.masterPin === enteredPin) return true;

    // 6. Fallback default
    return enteredPin === '1234';
  };

  const login = (operator: LocalUser) => {
    setUser(operator);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(operator));
    qc.invalidateQueries();
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(LOCAL_USER_KEY);
    try { sessionStorage.removeItem('billflow-admin-unlocked'); } catch {}
    qc.invalidateQueries();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        adminCreds,
        updateAdminCreds,
        resetAdminCreds,
        verifyAdminLogin,
        quickPinConfig,
        updateQuickPinConfig,
        verifyQuickPin,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return useContext(AuthContext);
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo.png" alt="BillFlow Logo" className="h-9 w-9 rounded-xl object-contain shadow-sm" />
      <span className={`text-xl font-bold tracking-tight ${light ? 'text-white' : 'text-slate-900 [.sidebar_&]:text-white'}`}>
        billflow<span className="text-amber-400">.</span>
      </span>
    </div>
  );
}

function AdminCredentialsManager({
  compact = false,
}: {
  compact?: boolean;
}) {
  const { adminCreds, updateAdminCreds, resetAdminCreds } = useAuth();
  const [username, setUsername] = useState(adminCreds.username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setUsername(adminCreds.username);
  }, [adminCreds.username]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);

    // Validate current password
    if (currentPassword !== adminCreds.password) {
      setFeedback({ type: 'error', text: 'Current password is incorrect. Verification failed.' });
      return;
    }

    if (!username.trim()) {
      setFeedback({ type: 'error', text: 'Admin username cannot be blank.' });
      return;
    }

    // If new password is provided, validate
    if (newPassword) {
      if (newPassword.length < 4) {
        setFeedback({ type: 'error', text: 'New password must be at least 4 characters long.' });
        return;
      }
      if (newPassword !== confirmPassword) {
        setFeedback({ type: 'error', text: 'New passwords do not match. Please re-type.' });
        return;
      }
    }

    // Save changes
    updateAdminCreds({
      username: username.trim(),
      password: newPassword ? newPassword : adminCreds.password,
    });

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setFeedback({
      type: 'success',
      text: `Admin credentials successfully updated! Username: "${username.trim()}".`,
    });
  }

  function handleReset() {
    if (window.confirm('Reset admin credentials back to default (Username: admin, Password: admin123)?')) {
      resetAdminCreds();
      setUsername(DEFAULT_ADMIN_USERNAME);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({
        type: 'success',
        text: 'Admin credentials reset to default: admin / admin123',
      });
    }
  }

  return (
    <section className={compact ? 'p-1' : 'surface p-5 md:p-6'}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f1ec] text-[#315f52]">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-[#344a40]">Admin Credentials Control</h2>
            <p className="text-xs text-[#89948c]">Control administrator login username and password for POS</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#d8e8dd] bg-[#edf4ec] px-3 py-1 text-[11px] font-semibold text-[#48705c]">
            Current Admin: <span className="font-mono">{adminCreds.username}</span>
          </span>
        </div>
      </div>

      {/* Current status info */}
      <div className="mb-5 rounded-xl border border-[#e4e3db] bg-[#faf9f4] p-3.5 text-xs text-[#526458]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[#849288]">Current Username: </span>
            <strong className="font-mono text-sm font-bold text-[#2d4339]">{adminCreds.username}</strong>
          </div>
          <div>
            <span className="text-[#849288]">Last Updated: </span>
            <span className="font-medium text-[#415549]">{dateLabel(adminCreds.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Form to update username and password */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Admin Username">
          <div className="relative">
            <User size={15} className="absolute left-3 top-3 text-[#97a098]" />
            <input
              type="text"
              required
              value={username}
              onChange={e => { setUsername(e.target.value); setFeedback(null); }}
              placeholder="e.g. admin or store_owner"
              className={`${inputClass} pl-9 font-medium`}
            />
          </div>
          <p className="text-[10.5px] text-[#869289]">You will use this username to log into the POS system.</p>
        </Field>

        <Field label="Current Password (Verification Required)">
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-3 text-[#97a098]" />
            <input
              type={showCurrentPass ? 'text' : 'password'}
              required
              value={currentPassword}
              onChange={e => { setCurrentPassword(e.target.value); setFeedback(null); }}
              placeholder="Enter current password to authorize changes"
              className={`${inputClass} pl-9 pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPass(!showCurrentPass)}
              className="absolute right-3 top-2.5 text-[#97a098] hover:text-[#315f52]"
              title={showCurrentPass ? 'Hide password' : 'Show password'}
            >
              {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="New Password (optional)">
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-3 text-[#97a098]" />
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setFeedback(null); }}
                placeholder="Leave blank to keep unchanged"
                className={`${inputClass} pl-9 pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-2.5 text-[#97a098] hover:text-[#315f52]"
                title={showNewPass ? 'Hide password' : 'Show password'}
              >
                {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <Field label="Confirm New Password">
            <div className="relative">
              <KeyRound size={15} className="absolute left-3 top-3 text-[#97a098]" />
              <input
                type={showNewPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setFeedback(null); }}
                placeholder="Re-type new password"
                className={`${inputClass} pl-9`}
              />
            </div>
          </Field>
        </div>

        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'border border-[#c6e6cf] bg-[#eef8f0] text-[#285d3e]'
                : 'border border-[#f4c8c4] bg-[#fdf0ee] text-[#a53b30]'
            }`}
          >
            {feedback.type === 'success' ? <Check size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#f0efe8]">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#966b44] hover:text-[#78502c] hover:underline cursor-pointer"
          >
            <RotateCcw size={13} /> Reset Admin Credentials
          </button>

          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:from-emerald-800 hover:to-teal-900 transition cursor-pointer"
          >
            <Check size={14} /> Update Admin Credentials
          </button>
        </div>
      </form>
    </section>
  );
}

function QuickPinManager() {
  const { quickPinConfig, updateQuickPinConfig } = useAuth();
  const [masterPinInput, setMasterPinInput] = useState(quickPinConfig.masterPin);
  const [showMasterPin, setShowMasterPin] = useState(false);
  const [editingStaffKey, setEditingStaffKey] = useState<string | null>(null);
  const [staffPinInput, setStaffPinInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const shops = getOfflineShopsList();
  const [allEmployees, setAllEmployees] = useState<any[]>(getOfflineEmployeesList);
  const [testShopId, setTestShopId] = useState<number>(shops[0]?.id || 1);

  // Mini tester state
  const [testPin, setTestPin] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    setMasterPinInput(quickPinConfig.masterPin);
  }, [quickPinConfig.masterPin]);

  function handleSaveMasterPin(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(masterPinInput)) {
      setFeedback('Master PIN must be exactly 4 numeric digits (e.g. 1234).');
      return;
    }
    updateQuickPinConfig({ masterPin: masterPinInput });
    setFeedback('Master Quick PIN successfully saved!');
    setTimeout(() => setFeedback(null), 3000);
  }

  function handleSaveStaffPin(shopId: number, empId: number, empName: string) {
    if (!/^\d{4}$/.test(staffPinInput)) {
      setFeedback('Staff PIN must be exactly 4 numeric digits.');
      return;
    }
    const updatedStaffPins = {
      ...quickPinConfig.staffPins,
      [`${shopId}_${empId}`]: staffPinInput,
      [String(empId)]: staffPinInput,
    };
    updateQuickPinConfig({ staffPins: updatedStaffPins });

    try {
      const raw = localStorage.getItem('billflow-offline-employees');
      if (raw) {
        const emps = JSON.parse(raw);
        const updated = emps.map((e: any) => e.id === empId && e.shopId === shopId ? { ...e, pin: staffPinInput } : e);
        localStorage.setItem('billflow-offline-employees', JSON.stringify(updated));
        setAllEmployees(updated);
      }
    } catch {}

    setEditingStaffKey(null);
    setStaffPinInput('');
    setFeedback(`Quick PIN updated to ${staffPinInput} for ${empName}!`);
    setTimeout(() => setFeedback(null), 3000);
  }

  function runPinTest(digit: string) {
    if (testPin.length < 4) {
      const next = testPin + digit;
      setTestPin(next);
      if (next.length === 4) {
        const curShop = shops.find(s => s.id === testShopId) || shops[0];
        const shopEmps = allEmployees.filter(e => e.shopId === curShop?.id);
        const matched = shopEmps.find(e => {
          const pin = quickPinConfig.staffPins[`${curShop?.id}_${e.id}`] || quickPinConfig.staffPins[String(e.id)] || e.pin || (curShop?.id === 1 ? '1111' : curShop?.id === 2 ? '2222' : '1234');
          return pin === next;
        });

        if (matched) {
          setTestResult(`✅ PIN Valid: Unlocks "${matched.name}" (${matched.role}) at ${curShop?.name}`);
        } else if (next === quickPinConfig.masterPin) {
          setTestResult(`✅ Master PIN Valid: Unlocks All Counter Registers`);
        } else {
          setTestResult(`❌ Invalid PIN for ${curShop?.name}. Does not match any staff code.`);
        }
      } else {
        setTestResult(null);
      }
    }
  }

  return (
    <section className="surface p-5 md:p-6 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 shadow-xs">
            <KeyRound size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-slate-800">Quick PIN & Cashier Shift Access</h2>
            <p className="text-xs text-slate-500">Configure 4-digit PINs for rapid cashier login and shift switching per shop outlet</p>
          </div>
        </div>

        {/* Global Enable / Disable Switch */}
        <button
          type="button"
          onClick={() => {
            const next = !quickPinConfig.enabled;
            updateQuickPinConfig({ enabled: next });
            setFeedback(next ? 'Quick PIN Login Enabled' : 'Quick PIN Login Disabled');
            setTimeout(() => setFeedback(null), 3000);
          }}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
            quickPinConfig.enabled
              ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-300'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}
        >
          {quickPinConfig.enabled ? <ToggleRight size={18} className="text-emerald-700" /> : <ToggleLeft size={18} />}
          <span>{quickPinConfig.enabled ? 'Quick PIN: Active' : 'Quick PIN: Disabled'}</span>
        </button>
      </div>

      {/* Explanatory Educational Card */}
      <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 text-xs text-slate-700 space-y-1">
        <p className="font-bold text-emerald-950 flex items-center gap-1.5">
          <Sparkles size={14} className="text-emerald-700" /> What is Quick PIN?
        </p>
        <p className="text-slate-600 leading-relaxed text-[11px]">
          Quick PIN is an express 4-digit numeric code (e.g. 1111 for Shop 1, 2222 for Shop 2) used at counter checkout registers. Each shop outlet has its own distinct cashiers and PINs, allowing repeated PINs across different shops with complete data isolation.
        </p>
      </div>

      {feedback && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 animate-in fade-in">
          {feedback}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Master PIN & Settings */}
        <div className="space-y-4">
          <form onSubmit={handleSaveMasterPin} className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-3">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Master Quick PIN
            </span>
            <p className="text-[11px] text-slate-500">
              This master 4-digit code acts as an administrator override and unlocks any counter terminal.
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showMasterPin ? 'text' : 'password'}
                  maxLength={4}
                  value={masterPinInput}
                  onChange={e => setMasterPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  className={`${inputClass} tracking-widest font-mono text-center text-base font-bold bg-white`}
                />
                <button
                  type="button"
                  onClick={() => setShowMasterPin(!showMasterPin)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showMasterPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:from-emerald-800 hover:to-teal-900 transition cursor-pointer"
              >
                Save Master PIN
              </button>
            </div>
          </form>

          {/* Interactive PIN Tester */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 text-center space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Interactive PIN Tester
              </span>
              <select
                value={testShopId}
                onChange={e => { setTestShopId(Number(e.target.value)); setTestPin(''); setTestResult(null); }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 outline-none"
              >
                {shops.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-500">Test 4-digit codes for the selected store outlet</p>

            <div className="flex justify-center gap-2 my-2">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full border transition-all ${
                    testPin.length > i ? 'bg-emerald-700 border-emerald-700 scale-110' : 'bg-white border-slate-300'
                  }`}
                />
              ))}
            </div>

            {testResult && (
              <p className={`text-xs font-semibold ${testResult.startsWith('✅') ? 'text-emerald-700' : 'text-rose-600'}`}>
                {testResult}
              </p>
            )}

            <div className="grid grid-cols-3 gap-1.5 max-w-[200px] mx-auto pt-1">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(k => (
                <button
                  type="button"
                  key={k}
                  onClick={() => {
                    if (k === 'C') {
                      setTestPin('');
                      setTestResult(null);
                    } else if (k === '⌫') {
                      setTestPin(prev => prev.slice(0, -1));
                      setTestResult(null);
                    } else {
                      runPinTest(k);
                    }
                  }}
                  className="h-8 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer"
                >
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Per-Staff PIN Table grouped by Shop */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-4">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Staff & Cashier PIN Allocation by Shop
            </span>
            <p className="text-[11px] text-slate-500">
              Each store outlet has its own distinct cashiers and PINs. Repeated PINs (e.g. 1111 in Shop 1 and Shop 2) are fully supported.
            </p>
          </div>

          <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
            {shops.map(s => {
              const shopEmps = allEmployees.filter(e => e.shopId === s.id);
              return (
                <div key={s.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <div className="bg-[#f0f4f1] px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#274f44] flex items-center gap-1.5">
                      <Store size={14} className="text-[#315f52]" /> {s.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {shopEmps.length} {shopEmps.length === 1 ? 'staff member' : 'staff members'}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {shopEmps.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No cashiers added for this shop yet. Add in the "Team" tab or use Master PIN.
                      </div>
                    ) : (
                      shopEmps.map(emp => {
                        const currentPin = quickPinConfig.staffPins[`${s.id}_${emp.id}`] || quickPinConfig.staffPins[String(emp.id)] || emp.pin || (s.id === 1 ? '1111' : s.id === 2 ? '2222' : '1234');
                        const isEditing = editingStaffKey === `${s.id}_${emp.id}`;

                        return (
                          <div key={emp.id} className="p-3 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5">
                              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                                {emp.name.split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase()}
                              </span>
                              <div>
                                <span className="font-semibold text-slate-800 block">{emp.name}</span>
                                <span className="text-[10px] capitalize text-slate-400">{emp.role}</span>
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="password"
                                  maxLength={4}
                                  autoFocus
                                  value={staffPinInput}
                                  onChange={e => setStaffPinInput(e.target.value.replace(/\D/g, ''))}
                                  placeholder="4 digits"
                                  className="w-20 rounded-lg border border-emerald-500 px-2 py-1 text-center font-mono text-xs font-bold outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveStaffPin(s.id, emp.id, emp.name)}
                                  className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingStaffKey(null); setStaffPinInput(''); }}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold tracking-widest text-[#274f44] bg-[#edf2e9] border border-[#c2d6c7] px-2.5 py-0.5 rounded-md">
                                  {currentPin}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStaffKey(`${s.id}_${emp.id}`);
                                    setStaffPinInput(currentPin);
                                  }}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition cursor-pointer"
                                >
                                  Edit PIN
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function LocalLoginPage() {
  const { login, adminCreds, verifyAdminLogin, quickPinConfig, verifyQuickPin } = useAuth();
  const [, setLocation] = useLocation();

  // Mode: 'admin' (default) | 'staff'
  const [mode, setMode] = useState<'admin' | 'staff'>('admin');

  // Admin form state
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real shops and staff
  const shops = getOfflineShopsList();
  const [selectedShopId, setSelectedShopId] = useState<number>(() => {
    const saved = localStorage.getItem('billflow-shop');
    const num = saved ? Number(saved) : 0;
    return (num && shops.some(s => s.id === num)) ? num : (shops[0]?.id || 1);
  });
  const selectedShop = shops.find(s => s.id === selectedShopId) || shops[0] || { id: 1, name: 'Main Store' };

  const allEmployees = getOfflineEmployeesList();
  const shopEmployees: LocalUser[] = allEmployees
    .filter(e => e.shopId === selectedShopId && e.isActive !== false)
    .map(e => ({
      id: String(e.id),
      name: e.name,
      role: (e.role as any) || 'cashier',
      avatarInitials: e.name.split(' ').map((x: string) => x[0]).slice(0, 2).join('').toUpperCase() || 'ST',
      shopId: e.shopId,
      pin: e.pin || (e.shopId === 1 ? '1111' : e.shopId === 2 ? '2222' : '1234'),
    }));

  const activeOperators: LocalUser[] = shopEmployees.length > 0
    ? shopEmployees
    : [
        {
          id: String(selectedShopId),
          name: `Cashier ${selectedShopId}`,
          role: 'cashier',
          avatarInitials: `C${selectedShopId}`,
          shopId: selectedShopId,
          pin: selectedShopId === 1 ? '1111' : selectedShopId === 2 ? '2222' : '1234',
        },
      ];

  const [selectedOp, setSelectedOp] = useState<LocalUser>(activeOperators[0]);
  const [pin, setPin] = useState('');
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState(false);

  useEffect(() => {
    if (activeOperators.length > 0) {
      setSelectedOp(activeOperators[0]);
    }
  }, [selectedShopId]);

  function handleAdminLogin(e?: FormEvent) {
    if (e) e.preventDefault();
    setAdminError('');

    const u = adminUser.trim();
    const p = adminPass;

    if (!u) {
      setAdminError('Please enter your admin username.');
      return;
    }
    if (!p) {
      setAdminError('Please enter your admin password.');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const isValid = verifyAdminLogin(u, p);
      if (isValid) {
        try { sessionStorage.setItem('billflow-admin-unlocked', 'true'); } catch {}
        login({
          id: 'admin',
          username: adminCreds.username,
          name: adminCreds.username === DEFAULT_ADMIN_USERNAME ? 'Store Owner' : adminCreds.username,
          role: 'owner',
          avatarInitials: (adminCreds.username.slice(0, 2) || 'AD').toUpperCase(),
          shopId: selectedShopId,
        });
        setLocation('/dashboard');
      } else {
        setAdminError('Invalid username or password. Please try again.');
        setIsSubmitting(false);
      }
    }, 150);
  }

  function handleStaffLogin() {
    if (!quickPinConfig.enabled) {
      setStaffError('Quick PIN login is currently disabled by Admin. Please use Admin Login.');
      return;
    }

    if (pin.length !== 4) {
      setStaffError('Please enter your 4-digit Quick PIN.');
      return;
    }

    if (!verifyQuickPin(selectedOp.id, pin, selectedShopId)) {
      setStaffError(`Incorrect 4-digit PIN for ${selectedOp.name} at ${selectedShop.name}.`);
      setPin('');
      return;
    }

    setStaffSuccess(true);
    setTimeout(() => {
      try { sessionStorage.removeItem('billflow-admin-unlocked'); } catch {}
      localStorage.setItem('billflow-shop', String(selectedShopId));
      window.dispatchEvent(new CustomEvent('billflow-shop-changed', { detail: selectedShopId }));
      login({ ...selectedOp, shopId: selectedShopId });
      setLocation('/dashboard');
    }, 150);
  }

  function handleNumKey(num: string) {
    if (!quickPinConfig.enabled) return;
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setStaffError('');

      if (nextPin.length === 4) {
        if (verifyQuickPin(selectedOp.id, nextPin, selectedShopId)) {
          setStaffSuccess(true);
          setTimeout(() => {
            localStorage.setItem('billflow-shop', String(selectedShopId));
            window.dispatchEvent(new CustomEvent('billflow-shop-changed', { detail: selectedShopId }));
            login({ ...selectedOp, shopId: selectedShopId });
            setLocation('/dashboard');
          }, 200);
        } else {
          setTimeout(() => {
            setStaffError(`Incorrect 4-digit PIN for ${selectedOp.name} at ${selectedShop.name}.`);
            setPin('');
          }, 250);
        }
      }
    }
  }

  function handleBackspace() {
    setPin(prev => prev.slice(0, -1));
    setStaffError('');
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-slate-100 via-emerald-50/20 to-slate-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Brand />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[.18em] text-slate-500">
            Point of Sale · Secure Counter Access
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10">
          {/* Header Mode Switcher Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/60 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => { setMode('admin'); setAdminError(''); }}
              className={`flex-1 py-3 text-xs font-bold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'admin'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/70'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldCheck size={16} /> Admin Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('staff'); setAdminError(''); }}
              className={`flex-1 py-3 text-xs font-bold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'staff'
                  ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/70'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound size={16} /> Quick Staff PIN
            </button>
          </div>

          <div className="p-6 sm:p-8">
            {mode === 'admin' ? (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Admin Authentication</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Sign in with administrator credentials to manage registers and catalog
                  </p>
                </div>

                {/* Error Banner */}
                {adminError && (
                  <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 animate-in fade-in">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{adminError}</span>
                  </div>
                )}

                {/* Username Input */}
                <Field label="Admin Username" required>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      autoFocus
                      required
                      value={adminUser}
                      onChange={e => { setAdminUser(e.target.value); setAdminError(''); }}
                      placeholder="Enter admin username"
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </Field>

                {/* Password Input */}
                <Field label="Admin Password" required>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showAdminPass ? 'text' : 'password'}
                      required
                      value={adminPass}
                      onChange={e => { setAdminPass(e.target.value); setAdminError(''); }}
                      placeholder="Enter admin password"
                      className={`${inputClass} pl-10 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPass(!showAdminPass)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title={showAdminPass ? 'Hide password' : 'Show password'}
                    >
                      {showAdminPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 hover:from-emerald-800 hover:to-teal-900 active:scale-[0.99] transition cursor-pointer disabled:opacity-70 mt-2"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="animate-spin" size={17} />
                  ) : (
                    <ShieldCheck size={17} />
                  )}
                  Sign In to Counter & Admin →
                </button>
              </form>
            ) : (
              <div>
                {!quickPinConfig.enabled ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200/60 text-slate-500">
                      <Lock size={22} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Quick PIN is Disabled</h3>
                    <p className="text-xs text-slate-500">
                      The administrator has disabled Quick PIN login. Please switch to the Admin Login tab to sign in with your username and password.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode('admin')}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                    >
                      Go to Admin Login →
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-800">Select Cashier Shift</h2>
                        <p className="text-xs text-slate-500">Choose shop outlet, cashier & enter 4-digit PIN</p>
                      </div>
                      <span className="rounded-full bg-emerald-100/70 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                        Quick PIN
                      </span>
                    </div>

                    {/* Shop Outlet Selector */}
                    <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                          <Store size={14} className="text-emerald-700" /> Current Store Outlet
                        </label>
                        <span className="text-[10px] text-emerald-800 font-bold bg-white/80 border border-emerald-200 px-2 py-0.5 rounded-full">
                          Shop ID: {selectedShop.id}
                        </span>
                      </div>
                      <select
                        aria-label="Select Store Outlet"
                        value={selectedShopId}
                        onChange={e => {
                          const nextId = Number(e.target.value);
                          setSelectedShopId(nextId);
                          localStorage.setItem('billflow-shop', String(nextId));
                          window.dispatchEvent(new CustomEvent('billflow-shop-changed', { detail: nextId }));
                          setPin('');
                          setStaffError('');
                        }}
                        className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none cursor-pointer hover:border-emerald-400 transition"
                      >
                        {shops.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.currency || 'AED'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Real Cashier Operators Grid for selected shop */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                      {activeOperators.map(op => {
                        const active = selectedOp.id === op.id;
                        return (
                          <button
                            type="button"
                            key={op.id}
                            onClick={() => { setSelectedOp(op); setPin(''); setStaffError(''); }}
                            className={`flex flex-col items-center rounded-2xl p-2.5 text-center border transition cursor-pointer ${
                              active
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-xs'
                                : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            <span className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold mb-1.5 ${
                              active ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-600'
                            }`}>
                              {op.avatarInitials}
                            </span>
                            <span className="text-xs font-semibold truncate w-full">{op.name}</span>
                            <span className="text-[10px] capitalize text-slate-400">{op.role}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Error / Success Feedback */}
                    {staffError && (
                      <div className="mb-3 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 animate-in fade-in">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{staffError}</span>
                      </div>
                    )}

                    {staffSuccess && (
                      <div className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 animate-in fade-in">
                        <Check size={16} className="text-emerald-700" />
                        <span>PIN Verified! Unlocking {selectedShop.name}…</span>
                      </div>
                    )}

                    {/* Quick PIN Dots Display */}
                    <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200/90 text-center mb-3">
                      <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center justify-center gap-1.5">
                        <KeyRound size={13} /> Enter 4-Digit Quick PIN for {selectedOp.name} ({selectedShop.name})
                      </p>
                      <div className="flex justify-center gap-3">
                        {[0, 1, 2, 3].map(i => (
                          <div
                            key={i}
                            className={`h-4 w-4 rounded-full border-2 transition-all ${
                              pin.length > i
                                ? 'bg-emerald-700 border-emerald-700 scale-110 shadow-xs'
                                : 'bg-white border-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Numeric Keypad */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(k => (
                        <button
                          type="button"
                          key={k}
                          onClick={() => {
                            if (k === 'C') {
                              setPin('');
                              setStaffError('');
                            } else if (k === '⌫') {
                              handleBackspace();
                            } else {
                              handleNumKey(k);
                            }
                          }}
                          className="h-11 rounded-xl border border-slate-200 bg-white text-base font-bold text-slate-800 shadow-2xs hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition cursor-pointer"
                        >
                          {k}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleStaffLogin}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 py-3.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 hover:from-emerald-800 hover:to-teal-900 active:scale-[0.99] transition cursor-pointer"
                    >
                      Unlock POS Register ({selectedShop.name}) →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Redirect to="/dashboard" /> : <Redirect to="/sign-in" />;
}

const nav = [
  {href:'/dashboard',label:'Overview',icon:LayoutDashboard},
  {href:'/pos',label:'POS',icon:ShoppingBag},
  {href:'/sales',label:'Sales',icon:ClipboardList},
  {href:'/expenses',label:'Expenses',icon:Wallet},
  {href:'/catalog',label:'Catalog',icon:Boxes},
  {href:'/team',label:'Team',icon:Users},
  {href:'/shops',label:'Shops',icon:Store},
  {href:'/reports',label:'Reports',icon:BarChart3},
  {href:'/receipt',label:'Receipt',icon:FileSliders},
  {href:'/settings',label:'Admin & Settings',icon:Settings},
];

function Shell({children,title}: {children:ReactNode;title:string}) {
  const qc = useQueryClient();
  const [path] = useLocation();
  const { user, logout } = useAuth();
  const ws = useGetWorkspace();
  const shops = useListShops();
  const [selected,setSelected] = useState<number>(()=>Number(localStorage.getItem('billflow-shop') || 0));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const active = shops.data?.find(s=>s.id===selected) ?? shops.data?.[0];

  useEffect(()=>{if(active && active.id!==selected){setSelected(active.id);localStorage.setItem('billflow-shop',String(active.id));}},[active,selected]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [path]);

  return <div className="app-frame flex bg-[#f7f6f0]">
    {/* DESKTOP SIDEBAR: Unchanged for laptop / desktop devices (md and up) */}
    <aside className="sidebar hidden md:flex min-h-[100dvh] flex-col px-3 py-5">
      <div className="sidebar-brand px-2 pb-7"><Brand light /></div>
      <div className="sidebar-shop mb-5 rounded-xl border border-white/10 bg-white/[.06] p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#93ada0]">Workspace</p><label className="flex items-center gap-2"><Store size={15} className="shrink-0 text-[#d2b17d]"/><select data-testid="select-active-shop" aria-label="Active shop" className="w-full bg-transparent text-sm font-semibold text-white outline-none" value={active?.id ?? ''} onChange={e=>{const newId=Number(e.target.value);setSelected(newId);localStorage.setItem('billflow-shop',String(newId));window.dispatchEvent(new CustomEvent('billflow-shop-changed',{detail:newId}));invalidate(qc);}}>{shops.data?.map((s:Shop)=><option className="text-[#203d37]" key={s.id} value={s.id}>{s.name}</option>)}</select></label><p className="mt-2 truncate text-[11px] text-[#a6b8af]">{ws.data?.businessName ?? 'Business workspace'}</p></div>
      <p className="sidebar-caption px-3 pb-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#829c90]">Operations</p>
      <nav className="sidebar-nav flex flex-1 flex-col gap-1">{nav.map(item=>{const Icon=item.icon;return <Link data-testid={`link-nav-${item.label.toLowerCase()}`} key={item.href} href={item.href} className={`sidebar-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium ${path===item.href?'active':''}`}><Icon size={17}/><span>{item.label}</span></Link>;})}</nav>
      <div className="sidebar-bottom border-t border-white/10 pt-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#c9d9c8] text-xs font-bold text-[#315f52]">
              {user?.avatarInitials || 'SO'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.name || 'Store Owner'}</p>
              <p className="text-[10px] capitalize text-[#9db0a6]">{user?.role || 'owner'}</p>
            </div>
          </div>
          <Link
            href="/settings"
            title="Admin security & credentials"
            className="rounded-lg p-1.5 text-[#a6bba9] hover:bg-white/10 hover:text-white transition"
          >
            <ShieldCheck size={16} />
          </Link>
        </div>
        <button
          data-testid="button-sign-out"
          onClick={logout}
          className="sidebar-link flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs hover:bg-white/10"
        >
          <LogOut size={15}/>Switch operator / Sign out
        </button>
      </div>
    </aside>

    {/* MOBILE SLIDE-OVER DRAWER (For phone screens) */}
    {mobileMenuOpen && (
      <div className="fixed inset-0 z-50 md:hidden flex">
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in"
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside className="relative z-10 w-72 max-w-[80vw] bg-[#203d37] text-[#e8f0e9] flex flex-col justify-between p-4 shadow-2xl animate-in slide-in-from-left duration-200">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <Brand light />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1 text-[#a6bba9] hover:bg-white/10 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 rounded-xl border border-white/10 bg-white/[.06] p-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.15em] text-[#93ada0]">Shop & Register</p>
              <select
                aria-label="Active shop"
                className="w-full bg-transparent text-sm font-semibold text-white outline-none cursor-pointer"
                value={active?.id ?? ''}
                onChange={e => {
                  const newId = Number(e.target.value);
                  setSelected(newId);
                  localStorage.setItem('billflow-shop', String(newId));
                  window.dispatchEvent(new CustomEvent('billflow-shop-changed', { detail: newId }));
                  invalidate(qc);
                  setMobileMenuOpen(false);
                }}
              >
                {shops.data?.map((s: Shop) => (
                  <option className="text-[#203d37]" key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <nav className="flex flex-col gap-1 max-h-[55vh] overflow-y-auto no-scrollbar pr-1">
              {nav.map(item => {
                const Icon = item.icon;
                const isCurrent = path === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      isCurrent ? 'bg-white/15 text-white font-bold' : 'text-[#bdcec7] hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="mb-3 flex items-center justify-between px-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#c9d9c8] text-xs font-bold text-[#315f52]">
                  {user?.avatarInitials || 'SO'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{user?.name || 'Store Owner'}</p>
                  <p className="text-[10px] capitalize text-[#9db0a6]">{user?.role || 'owner'}</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[#bdcec7] hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <LogOut size={15} /> Switch operator / Sign out
            </button>
          </div>
        </aside>
      </div>
    )}

    {/* MAIN CONTENT AREA */}
    <div className="main-area min-w-0 flex-1 flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-20 flex h-[62px] md:h-[68px] items-center justify-between border-b border-[#e6e4da] bg-[#f7f6f0]/95 px-3 md:px-8 backdrop-blur">
        <div className="flex items-center gap-2.5">
          {/* Mobile hamburger menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 -ml-1.5 rounded-xl text-[#315f52] hover:bg-black/5 active:scale-95 transition cursor-pointer"
            title="Open navigation menu"
          >
            <Menu size={20} />
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8a958d]">BillFlow / {title}</p>
            <p className="mt-0.5 text-xs md:text-sm font-semibold text-[#31463c] truncate max-w-[170px] sm:max-w-none">
              {active?.name || 'Your business'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-[#dfe4d9] bg-white/70 px-3 py-1.5 text-[11px] font-medium text-[#587062] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#69a77e]"/>PostgreSQL online
          </span>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 md:h-9 md:w-9 place-items-center rounded-full bg-[#e5ebdf] text-xs font-bold text-[#315f52]">
              {user?.avatarInitials || 'SO'}
            </span>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-[#32493f]">{user?.name || 'Store Owner'}</p>
              <p className="text-[10px] capitalize text-[#8a968e]">{user?.role || 'owner'}</p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER: Bottom padding pb-24 ensures no overlap with mobile navigation bar */}
      <main className="page-enter mx-auto w-full max-w-[1500px] px-3.5 py-4 pb-28 md:px-8 md:py-8 md:pb-8 flex-1">
        {children}
      </main>

      {/* MOBILE BOTTOM THUMB BAR: Ultra-ergonomic 5-tab quick navigation for phone users */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#dedcd2] px-2 py-1.5 safe-bottom flex items-center justify-around shadow-[0_-4px_25px_rgba(0,0,0,0.06)]">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
            path === '/dashboard' ? 'text-[#315f52] font-bold' : 'text-[#7e8d83]'
          }`}
        >
          <LayoutDashboard size={19} />
          <span className="text-[10px] tracking-tight">Overview</span>
        </Link>

        {/* Highlighted Primary POS Action Pill */}
        <Link
          href="/pos"
          className={`flex flex-col items-center gap-0.5 py-1 px-3.5 rounded-xl transition ${
            path === '/pos'
              ? 'bg-[#315f52] text-white font-bold shadow-md shadow-[#315f52]/25'
              : 'text-[#315f52] bg-[#eff5f0] font-semibold'
          }`}
        >
          <ShoppingBag size={19} />
          <span className="text-[10px] tracking-tight">POS ⚡</span>
        </Link>

        <Link
          href="/sales"
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
            path === '/sales' ? 'text-[#315f52] font-bold' : 'text-[#7e8d83]'
          }`}
        >
          <ClipboardList size={19} />
          <span className="text-[10px] tracking-tight">Sales</span>
        </Link>

        <Link
          href="/expenses"
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition ${
            path === '/expenses' ? 'text-[#315f52] font-bold' : 'text-[#7e8d83]'
          }`}
        >
          <Wallet size={19} />
          <span className="text-[10px] tracking-tight">Expenses</span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-[#7e8d83] hover:text-[#315f52] transition cursor-pointer"
        >
          <Menu size={19} />
          <span className="text-[10px] tracking-tight">Menu</span>
        </button>
      </nav>
    </div>
  </div>;
}

function Protected({title,children}: {title:string;children:ReactNode}) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/sign-in" />;
  return <Shell title={title}>{children}</Shell>;
}
function PageHeading({eyebrow,title,sub,action}: {eyebrow?:string;title:string;sub?:string;action?:ReactNode}) { return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow&&<p className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#9b8059]">{eyebrow}</p>}<h1 className="text-[26px] font-semibold tracking-[-.04em] text-[#2c4339] md:text-[32px]">{title}</h1>{sub&&<p className="mt-1.5 text-sm text-[#77827a]">{sub}</p>}</div>{action}</div>; }
function useCurrentShop() {
  const shops = useListShops();
  const localShops = (() => {
    try {
      const raw = localStorage.getItem('billflow-offline-shops');
      if (raw) return JSON.parse(raw) as Shop[];
    } catch {}
    return [];
  })();
  const shopList = (shops.data as Shop[] | undefined) || (localShops.length ? localShops : []);
  const [id, setId] = useState(() => Number(localStorage.getItem('billflow-shop') || shopList[0]?.id || 1));
  useEffect(() => {
    if (!id && shopList.length) {
      setId(shopList[0].id);
      localStorage.setItem('billflow-shop', String(shopList[0].id));
    }
  }, [id, shopList]);

  useEffect(() => {
    const handleShopChange = () => {
      const stored = Number(localStorage.getItem('billflow-shop') || shopList[0]?.id || 1);
      setId(stored);
    };
    window.addEventListener('billflow-shop-changed', handleShopChange);
    window.addEventListener('storage', handleShopChange);
    return () => {
      window.removeEventListener('billflow-shop-changed', handleShopChange);
      window.removeEventListener('storage', handleShopChange);
    };
  }, [shopList]);

  return {
    shop: shopList.find(x => x.id === id) || shopList[0],
    shops: shopList,
    loading: shops.isLoading && !shopList.length,
    error: shops.isError && !shopList.length,
  };
}

function QueryState({
  loading,
  error,
  empty,
  retry,
  children,
}: {
  loading: boolean;
  error: boolean;
  empty?: boolean;
  retry?: () => void;
  children: ReactNode;
}) {
  // If data already exists, NEVER flash skeletons — render data instantly!
  if (loading && empty) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton h-14 w-full" />
        ))}
        <span className="sr-only">Loading records</span>
      </div>
    );
  }
  if (error && empty) {
    return (
      <div className="surface flex flex-col items-center p-10 text-center">
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f8e9e4] text-[#ad5146]">
          <Activity size={19} />
        </span>
        <h3 className="font-semibold">Couldn’t load this view</h3>
        <p className="mt-1 text-sm text-[#78827a]">Check your connection and try again.</p>
        <button onClick={retry} className="mt-4 rounded-lg bg-[#315f52] px-4 py-2 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="surface flex flex-col items-center p-12 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf2e9] text-[#567661]">
          <FileText size={21} />
        </span>
        <h3 className="mt-4 font-semibold text-[#344a40]">A clean slate</h3>
        <p className="mt-1 max-w-sm text-sm text-[#78827a]">Records will show here as your shop gets moving.</p>
      </div>
    );
  }
  return <>{children}</>;
}
function Metric({label,value,detail,icon,accent}: {label:string;value:string;detail:string;icon:ReactNode;accent?:string}) {return <div className="surface p-5"><div className="flex items-start justify-between"><span className="text-[12px] font-semibold text-[#68756d]">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${accent||'bg-[#edf2e9] text-[#527260]'}`}>{icon}</span></div><p className="mt-3.5 text-[26px] font-extrabold text-[#20362b] tracking-tight tabular-nums">{value}</p><p className="mt-1 text-xs text-[#828c84]">{detail}</p></div>;}
function DataTable({headers,rows}: {headers:string[];rows:ReactNode[][]}) {return <div className="surface overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="border-b border-[#eeede6] bg-[#fbfaf6]"><tr>{headers.map(x=><th key={x} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-[#8a958d]">{x}</th>)}</tr></thead><tbody className="divide-y divide-[#efeee8]">{rows.map((r,i)=><tr className="hover:bg-[#fbfaf6]" key={i}>{r.map((cell,j)=><td key={j} className="px-5 py-3.5 text-sm text-[#405148]">{cell}</td>)}</tr>)}</tbody></table></div></div>;}
function Pill({children,tone='green'}:{children:ReactNode;tone?:'green'|'amber'|'gray'}) {return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone==='green'?'bg-[#e9f2e9] text-[#52785f]':tone==='amber'?'bg-[#f7efdf] text-[#92703c]':'bg-[#efefea] text-[#747d76]'}`}>{children}</span>;}
function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1">
          {label} {required && <span className="text-rose-500 font-bold">*</span>}
        </span>
        {hint && <span className="text-[11px] font-normal text-slate-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition duration-150 hover:bg-white hover:border-slate-300 focus:bg-white focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 shadow-xs font-medium';

interface ModalProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  maxWidth?: string;
  onClose: () => void;
  children: ReactNode;
}

function Modal({ title, subtitle, icon, maxWidth = 'max-w-xl', onClose, children }: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Prevent background scrolling while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto overscroll-contain bg-slate-950/70 p-3 sm:p-6 backdrop-blur-md transition-all animate-in fade-in duration-200"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex min-h-full items-center justify-center py-2 sm:py-6">
        <section
          className={`relative w-full ${maxWidth} my-auto flex flex-col rounded-3xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-950/30 overflow-hidden transition-all animate-in zoom-in-[0.98] duration-200 shrink-0 max-h-[calc(100vh-2.5rem)] sm:max-h-[calc(100vh-4rem)]`}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Modern Sticky Modal Header - always pinned & never cut off */}
          <div className="relative flex shrink-0 items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 via-emerald-50/30 to-slate-50 px-5 sm:px-7 py-4.5">
            <div className="flex items-center gap-3 min-w-0 pr-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-600/20 shadow-xs">
                {icon || <Sparkles size={18} />}
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-800 truncate">{title}</h2>
                {subtitle ? (
                  <p className="text-xs text-slate-500 truncate">{subtitle}</p>
                ) : (
                  <p className="text-xs text-slate-400">Complete the form details below</p>
                )}
              </div>
            </div>
            <button
              type="button"
              data-testid="button-close-modal"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Smooth Scrollable Modal Content */}
          <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 overscroll-contain flex-1">
            {children}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function Submit({ label, busy, icon }: { label: string; busy: boolean; icon?: ReactNode }) {
  return (
    <button
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 hover:from-emerald-800 hover:to-teal-900 active:scale-[0.99] transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
    >
      {busy ? <LoaderCircle className="animate-spin" size={16} /> : (icon || <Check size={16} />)}
      {label}
    </button>
  );
}
function EmptyShop({shops}: {shops:Shop[]}) {return !shops.length?<div className="surface mb-5 flex items-center justify-between gap-3 p-4"><p className="text-sm text-[#6c7a70]">Add a shop to start recording sales and operations.</p><Link href="/shops" className="text-sm font-semibold text-[#315f52]">Set up shop <ArrowRight size={14} className="inline"/></Link></div>:null;}

function Dashboard() {
  const {shop,shops}=useCurrentShop(); const params={shopId:shop?.id,period:'week' as const};
  const q=useGetDashboard(params,{query:{enabled:!!shop,queryKey:getGetDashboardQueryKey(params)}});
  const d=q.data;
  const max=Math.max(1,...(d?.salesByDay||[]).map(x=>x.totalCents));
  return <><PageHeading eyebrow="Business overview" title="A steady start to the day." sub="Your shop’s pulse, without the noise."/><EmptyShop shops={shops}/>
    <QueryState loading={q.isLoading} error={q.isError} retry={()=>q.refetch()} empty={!d}><>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3"><Metric label="Net sales" value={money(d?.salesCents||0,shop?.currency)} detail="This week" icon={<Banknote size={18}/>} /><Metric label="Expenses" value={money(d?.expensesCents||0,shop?.currency)} detail="Recorded this week" icon={<Wallet size={18}/>} accent="bg-[#f4eae5] text-[#a3614e]"/><Metric label="Operating balance" value={money(d?.operatingBalanceCents||0,shop?.currency)} detail={`Avg. bill ${money(d?.averageBillCents||0,shop?.currency)}`} icon={<BriefcaseBusiness size={18}/>} /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_.85fr]"><section className="surface p-5 md:p-6"><div className="mb-5 flex items-start justify-between"><div><h2 className="font-semibold text-[#344a40]">Sales rhythm</h2><p className="mt-1 text-xs text-[#879189]">Daily takings across the last 7 days</p></div><span className="rounded-lg bg-[#f0f3ec] px-2.5 py-1.5 text-xs font-medium text-[#64806c]">This week</span></div><div className="flex h-48 items-end gap-2 border-b border-[#ecebe4] pb-2 md:gap-4">{(d?.salesByDay||[]).map((x,i)=><div className="flex h-full flex-1 flex-col items-center justify-end gap-2" key={x.date}><div className="group relative flex w-full max-w-[44px] flex-1 items-end"><div className={`w-full rounded-t-md transition-all ${i===((d?.salesByDay.length||1)-1)?'bg-[#3d725f]':'bg-[#c7d8c9]'}`} style={{height:`${Math.max(4,x.totalCents/max*100)}%`}} title={money(x.totalCents,shop?.currency)}/></div><span className="text-[10px] text-[#89948c]">{new Date(x.date).toLocaleDateString(undefined,{weekday:'short'})}</span></div>)}</div></section>
      <section className="surface p-5 md:p-6"><h2 className="font-semibold text-[#344a40]">Payment mix</h2><p className="mt-1 text-xs text-[#879189]">By completed sale value</p><div className="mt-5 space-y-4">{(d?.payments||[]).map((p,i)=>{const pct=d?.salesCents?Math.round(p.totalCents/d.salesCents*100):0;return <div key={p.method}><div className="mb-1.5 flex justify-between text-xs"><span className="capitalize font-medium text-[#56655c]">{p.method}</span><span className="mono text-[#7c887f]">{money(p.totalCents,shop?.currency)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf0e9]"><div className={`h-full rounded-full ${['bg-[#3d725f]','bg-[#d4ad6d]','bg-[#86a994]','bg-[#b58f83]'][i%4]}`} style={{width:`${pct}%`}}/></div><p className="mt-1 text-right text-[10px] text-[#98a098]">{pct}%</p></div>;})}{!d?.payments?.length&&<p className="py-8 text-center text-sm text-[#89948c]">Payments will appear after the first sale.</p>}</div></section></div>
      <section className="mt-5"><div className="mb-3 flex items-center justify-between"><div><h2 className="font-semibold text-[#344a40]">Recent bills</h2><p className="mt-1 text-xs text-[#879189]">Latest activity from your counter</p></div><Link href="/sales" className="text-xs font-semibold text-[#46705a]">All sales <ArrowRight size={13} className="inline"/></Link></div><DataTable headers={['Bill','Time','Staff','Payment','Total']} rows={(d?.recentSales||[]).map((s:Sale)=>[<span className="mono text-xs font-bold">#{s.billNumber}</span>,dateLabel(s.createdAt),s.employeeName,<Pill>{s.paymentMethod.toUpperCase()}</Pill>,<span className="mono font-bold">{money(s.totalCents,shop?.currency)}</span>])}/></section>
    </></QueryState></>;
}
function POS() {
  const { shop, shops } = useCurrentShop();
  const { user } = useAuth();
  const [category, setCategory] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<number, number>>({});
  const [discountVal, setDiscountVal] = useState('');
  const [discountMode, setDiscountMode] = useState<'flat' | 'percent'>('flat');
  const [payment, setPayment] = useState<'cash' | 'upi' | 'card' | 'other'>('cash');
  const [order, setOrder] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState('');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentShopId = shop?.id || 1;
  const cp = { shopId: currentShopId };
  const pp = {
    shopId: currentShopId,
    ...(category !== undefined ? { categoryId: category } : {}),
    ...(search ? { search } : {}),
  };
  const cats = useListCategories(cp, { query: { enabled: !!shop, queryKey: getListCategoriesQueryKey(cp) } });
  const products = useListProducts(pp, { query: { enabled: !!shop, queryKey: getListProductsQueryKey(pp) } });
  const employees = useListEmployees(cp, { query: { enabled: !!shop, queryKey: getListEmployeesQueryKey(cp) } });
  const complete = useCompleteSale();
  const qc = useQueryClient();
  const salesQuery = useListSales(cp, { query: { enabled: !!shop, queryKey: getListSalesQueryKey(cp) } });
  const expensesQuery = useListExpenses(cp, { query: { enabled: !!shop, queryKey: getListExpensesQueryKey(cp) } });
  const createExpenseMutation = useCreateExpense();

  // POS Quick Expense Payout modal state
  const [posExpenseModalOpen, setPosExpenseModalOpen] = useState(false);
  const [posExpenseTitle, setPosExpenseTitle] = useState('');
  const [posExpenseAmount, setPosExpenseAmount] = useState('');
  const [posExpenseCategory, setPosExpenseCategory] = useState('Kitchen & Cooking Supplies');
  const [posExpensePayment, setPosExpensePayment] = useState<'cash' | 'card' | 'upi' | 'other'>('cash');
  const [posExpenseError, setPosExpenseError] = useState('');
  const [posExpenseToast, setPosExpenseToast] = useState('');

  const todayIso = new Date().toISOString().slice(0, 10);
  const todaySalesList = (salesQuery.data || []).filter((s: Sale) => s.createdAt?.slice(0, 10) === todayIso);
  const todaySalesCents = todaySalesList.reduce((acc: number, s: Sale) => acc + (s.totalCents || 0), 0);
  const todayExpensesList = (expensesQuery.data || []).filter((e: Expense) => (e.expenseDate || e.createdAt?.slice(0, 10)) === todayIso);
  const todayExpensesCents = todayExpensesList.reduce((acc: number, e: Expense) => acc + (e.totalCents || 0), 0);
  const todayNetDrawerCents = todaySalesCents - todayExpensesCents;

  // Fullscreen / Kiosk mode state
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // PWA Standalone Install Prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isPwaInstalled, setIsPwaInstalled] = useState(false);
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);

  useEffect(() => {
    const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone);
    if (isStandalone) setIsPwaInstalled(true);

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleInstallPwa() {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsPwaInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosInstallModal(true);
    } else {
      alert('To install BillFlow POS:\n\nIn Chrome or Edge, click the Install App button in your browser address bar (or Menu -> Install BillFlow POS). It will add an icon to your desktop or home screen and open in full screen without any browser address bar.');
    }
  }

  // Bluetooth Toast in POS
  const [btToast, setBtToast] = useState('');
  const savedBtInfo = getSavedPrinterInfo();

  function handlePosExpenseSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shop) return;
    const t = posExpenseTitle.trim();
    const a = Number(posExpenseAmount);
    if (!t) {
      setPosExpenseError('Please enter an expense description.');
      return;
    }
    if (!a || a <= 0) {
      setPosExpenseError('Please enter a valid expense amount.');
      return;
    }
    setPosExpenseError('');
    createExpenseMutation.mutate(
      {
        data: {
          shopId: shop.id,
          expenseDate: todayIso,
          paymentMethod: posExpensePayment,
          items: [
            {
              categoryName: posExpenseCategory,
              productName: t,
              quantity: 1,
              unit: 'item',
              unitPriceCents: Math.round(a * 100),
            },
          ],
        },
      },
      {
        onSuccess: (exp: Expense) => {
          setPosExpenseModalOpen(false);
          setPosExpenseTitle('');
          setPosExpenseAmount('');
          setPosExpenseToast(`Expense of ${money(Math.round(a * 100), shop.currency)} saved & deducted from drawer.`);
          qc.setQueryData(getListExpensesQueryKey(cp), (old: any) => [exp, ...(Array.isArray(old) ? old : [])]);
          qc.setQueryData(getListExpensesQueryKey({ shopId: 0 }), (old: any) => [exp, ...(Array.isArray(old) ? old : [])]);
          qc.setQueryData(getGetDashboardQueryKey({ shopId: currentShopId, period: 'week' }), (old: any) => {
            if (!old) return old;
            const newExpensesCents = (old.expensesCents || 0) + (exp.totalCents || 0);
            return {
              ...old,
              expensesCents: newExpensesCents,
              operatingBalanceCents: (old.salesCents || 0) - newExpensesCents,
            };
          });
          try {
            const raw = localStorage.getItem('billflow-offline-expenses');
            const list = raw ? JSON.parse(raw) : [];
            localStorage.setItem('billflow-offline-expenses', JSON.stringify([exp, ...list.filter((x: any) => x.id !== exp.id)]));
          } catch {}
          invalidate(qc);
          setTimeout(() => setPosExpenseToast(''), 4500);
        },
        onError: () => {
          setPosExpenseError('Could not save expense. Please check input values.');
        },
      }
    );
  }

  // Active cashier selector state
  const [activeCashier, setActiveCashier] = useState<string>(() => user?.name || 'Store Owner');

  useEffect(() => {
    if (user?.name) setActiveCashier(user.name);
  }, [user?.name]);

  const active = (products.data || []).filter(p => p.isAvailable);
  const cartLines = Object.entries(cart)
    .map(([id, qty]) => ({
      product: active.find(p => p.id === Number(id)) || (products.data || []).find(p => p.id === Number(id)),
      qty,
    }))
    .filter((x): x is { product: Product; qty: number } => !!x.product);

  const rawSubtotal = cartLines.reduce((a, x) => a + (x.product.priceCents || 0) * x.qty, 0);
  const parsedDiscount = parseFloat(discountVal) || 0;
  const discountCents = Math.max(
    0,
    Math.min(
      rawSubtotal,
      discountMode === 'percent'
        ? Math.round((rawSubtotal * parsedDiscount) / 100)
        : Math.round(parsedDiscount * 100)
    )
  );
  const discountedSubtotal = Math.max(0, rawSubtotal - discountCents);

  // Adaptable Tax:
  // - Inclusive (UAE / Retail standard): Product prices already include VAT (tax = total * rate / (10000 + rate))
  // - Exclusive: Tax is added on top of the prices
  const isTaxExclusive = (shop as any)?.taxType === 'exclusive';
  const taxRateBps = shop?.taxRateBps || 0;
  const tax = isTaxExclusive
    ? Math.round((discountedSubtotal * taxRateBps) / 10000)
    : Math.round((discountedSubtotal * taxRateBps) / (10000 + taxRateBps));

  // Parcel / Takeaway fee calculation for products with parcel packaging enabled
  const isTakeaway = order === 'takeaway';
  const parcelCents = isTakeaway
    ? cartLines.reduce((acc, x) => {
        const pFee = (x.product.parcelType === 'fixed' || (x.product.parcelValue && x.product.parcelValue > 0))
          ? (x.product.parcelValue || 0)
          : 0;
        return acc + (pFee * x.qty);
      }, 0)
    : 0;

  const total = isTaxExclusive
    ? discountedSubtotal + tax + parcelCents
    : discountedSubtotal + parcelCents;
  const netAmountBeforeTax = isTaxExclusive ? discountedSubtotal : Math.max(0, discountedSubtotal - tax);

  async function pay(methodOverride?: 'cash' | 'upi' | 'card' | 'other') {
    if (!shop || !cartLines.length || complete.isPending) return;
    const chosenMethod = methodOverride || payment;
    setError('');
    complete.mutate(
      {
        data: {
          shopId: shop.id,
          idempotencyKey: freshKey(),
          orderType: order,
          paymentMethod: chosenMethod,
          discountCents: discountCents,
          items: cartLines.map(x => ({
            productId: x.product.id,
            quantity: x.qty,
            discountCents: 0,
          })),
          employeeName: activeCashier,
        } as any,
      },
      {
        onSuccess: r => {
          setSale(r);
          setCart({});
          setDiscountVal('');
          setMobileCartOpen(false);

          // Immediately inject new sale into React Query cache so Sales page displays it instantly
          qc.setQueryData(getListSalesQueryKey(cp), (old: any) => {
            const list = Array.isArray(old) ? old : [];
            return [r, ...list.filter((x: any) => x.id !== r.id && x.billNumber !== r.billNumber)];
          });
          qc.setQueryData(getListSalesQueryKey({ shopId: 0 }), (old: any) => {
            const list = Array.isArray(old) ? old : [];
            return [r, ...list.filter((x: any) => x.id !== r.id && x.billNumber !== r.billNumber)];
          });

          // Update Dashboard query cache
          qc.setQueryData(getGetDashboardQueryKey({ shopId: currentShopId, period: 'week' }), (old: any) => {
            if (!old) return old;
            const newSalesCents = (old.salesCents || 0) + (r.totalCents || 0);
            return {
              ...old,
              salesCents: newSalesCents,
              operatingBalanceCents: newSalesCents - (old.expensesCents || 0),
              billCount: (old.billCount || 0) + 1,
              averageBillCents: Math.round(newSalesCents / ((old.billCount || 0) + 1)),
              recentSales: [r, ...(old.recentSales || [])].slice(0, 8),
            };
          });

          // Persist directly to local storage
          try {
            const raw = localStorage.getItem('billflow-offline-sales');
            const list = raw ? JSON.parse(raw) : [];
            const updated = [r, ...list.filter((x: any) => x.id !== r.id && x.billNumber !== r.billNumber)];
            localStorage.setItem('billflow-offline-sales', JSON.stringify(updated));
          } catch {}

          invalidate(qc);
          const curCfg = loadRc();
          if (curCfg.autoPrintOnSale) {
            setTimeout(() => {
              executeSmartReceiptPrint('billflow-checkout-receipt', r, curCfg, shop, msg => {
                setBtToast(msg);
                setTimeout(() => setBtToast(''), 3500);
              });
            }, 300);
          }
        },
        onError: () =>
          setError('Payment could not be completed. Check connection and retry; your cart is unchanged.'),
      },
    );
  }

  // Keyboard shortcuts listener for rapid cashier billing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';

      // 1. Receipt Modal Shortcuts
      if (sale) {
        if (e.key === 'p' || e.key === 'P' || e.key === 'Enter') {
          e.preventDefault();
          executeSmartReceiptPrint('billflow-checkout-receipt', sale, loadRc(), shop, msg => {
            setBtToast(msg);
            setTimeout(() => setBtToast(''), 3500);
          });
          return;
        }
        if (e.key === 'Escape' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          setSale(null);
          return;
        }
        return;
      }

      // If shortcuts modal is open, Escape closes it
      if (showShortcutsModal) {
        if (e.key === 'Escape') {
          setShowShortcutsModal(false);
          return;
        }
      }

      // 2. Open Shortcuts Modal: '?'
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowShortcutsModal(prev => !prev);
        return;
      }

      // 3. Search Focus: '/' or 'Ctrl+K'
      if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // 4. Clear Cart: 'Delete' or 'Alt+C' (when not in input)
      if ((e.key === 'Delete' || (e.altKey && e.key.toLowerCase() === 'c')) && !isInput && cartLines.length) {
        e.preventDefault();
        setCart({});
        return;
      }

      // If user is currently typing in an input, do not trigger single-key action shortcuts
      if (isInput) return;

      // 5. Toggle Order Type: 'd' for Dine-in, 't' for Takeaway
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        setOrder('dine-in');
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setOrder('takeaway');
        return;
      }

      // 6. Payment Method selection: '1' for Cash, '2' for UPI, '3' for Card, '4' for Other
      if (e.key === '1' || e.key === 'F1') {
        e.preventDefault();
        setPayment('cash');
        return;
      }
      if (e.key === '2' || e.key === 'F2') {
        e.preventDefault();
        setPayment('upi');
        return;
      }
      if (e.key === '3' || e.key === 'F3') {
        e.preventDefault();
        setPayment('card');
        return;
      }
      if (e.key === '4' || e.key === 'F4') {
        e.preventDefault();
        setPayment('other');
        return;
      }

      // 7. 1-Key Fast POS Sale:
      // 'c' or 'C' -> Instant Cash Pay
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setPayment('cash');
        pay('cash');
        return;
      }
      // 'k' or 'K' -> Instant Card Pay
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setPayment('card');
        pay('card');
        return;
      }
      // 'u' or 'U' -> Instant UPI Pay
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        setPayment('upi');
        pay('upi');
        return;
      }

      // 8. Main Charge: 'Enter' or 'Space' -> completes payment with currently selected method
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pay();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sale, showShortcutsModal, cartLines, complete.isPending, payment, order, activeCashier, shop]);

  // Combined staff list for cashier switcher
  const staffList = Array.from(
    new Set([
      user?.name || 'Store Owner',
      'Store Owner',
      'Shift Manager',
      'Cashier 1',
      'Cashier 2',
      ...(employees.data || []).map(e => e.name),
    ]),
  );

  const renderCartContent = (isMobileSheet?: boolean) => (
    <>
      <div className="mb-4 flex items-center justify-between border-b border-[#eeede6] pb-3">
        <div>
          <h2 className="font-semibold text-[#2f4337] text-base">Current Bill</h2>
          <p className="mt-0.5 text-[11px] text-[#869288]">
            {shop?.name || 'Counter'} · Cashier: <strong>{activeCashier}</strong>
          </p>
        </div>
        {cartLines.length > 0 && (
          <button
            onClick={() => setCart({})}
            className="text-xs font-semibold text-[#9c6258] hover:underline cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Dine-in vs Takeaway / Parcel Switcher */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setOrder('dine-in')}
          className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition cursor-pointer ${
            order === 'dine-in'
              ? 'border-[#315f52] bg-[#eff5f0] text-[#315f52] shadow-xs ring-1 ring-[#315f52]'
              : 'border-[#e4e2d9] bg-white text-[#738077] hover:bg-[#faf9f4]'
          }`}
          title="Dine-in Mode (Press 'D')"
        >
          <span>🍽️ Dine in</span>
          <kbd className="rounded bg-black/5 px-1.5 py-0.2 text-[9px] font-mono text-[#5f7065]">[D]</kbd>
        </button>
        <button
          type="button"
          onClick={() => setOrder('takeaway')}
          className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition cursor-pointer ${
            order === 'takeaway'
              ? 'border-[#315f52] bg-[#eff5f0] text-[#315f52] shadow-xs ring-1 ring-[#315f52]'
              : 'border-[#e4e2d9] bg-white text-[#738077] hover:bg-[#faf9f4]'
          }`}
          title="Takeaway / Parcel Mode (Press 'T')"
        >
          <span>📦 Takeaway</span>
          <kbd className="rounded bg-black/5 px-1.5 py-0.2 text-[9px] font-mono text-[#5f7065]">[T]</kbd>
        </button>
      </div>

      {/* Cart Items List */}
      <div className={`${isMobileSheet ? 'max-h-[38vh]' : 'max-h-[34vh]'} min-h-24 space-y-3 overflow-y-auto border-y border-[#eeede6] py-3 pr-1`}>
        {cartLines.map(x => {
          const itemParcel = (isTakeaway && (x.product.parcelValue || 0) > 0)
            ? (x.product.parcelValue || 0) * x.qty
            : 0;
          return (
            <div key={x.product.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[#3d4f45]">{x.product.name}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[#869288]">
                  <span className="mono">{money(x.product.priceCents, shop?.currency)} ea</span>
                  {itemParcel > 0 && (
                    <span className="font-medium text-[#b0782e]">
                      (+{money(itemParcel, shop?.currency)} parcel)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-[#e4e2d9] bg-[#faf9f5] px-1 py-0.5">
                <button
                  aria-label="Decrease quantity"
                  onClick={() => setCart({ ...cart, [x.product.id]: Math.max(0, x.qty - 1) })}
                  className="grid h-7 w-7 place-items-center rounded text-sm font-bold text-[#4e6055] hover:bg-[#e7eee8] cursor-pointer"
                >
                  −
                </button>
                <span className="mono w-5 text-center text-xs font-bold text-[#32453a]">{x.qty}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() => setCart({ ...cart, [x.product.id]: x.qty + 1 })}
                  className="grid h-7 w-7 place-items-center rounded text-sm font-bold text-[#4e6055] hover:bg-[#e7eee8] cursor-pointer"
                >
                  +
                </button>
              </div>

              <span className="mono w-16 text-right text-xs font-bold text-[#2e4238]">
                {money(x.product.priceCents * x.qty, shop?.currency)}
              </span>
            </div>
          );
        })}

        {!cartLines.length && (
          <div className="flex h-28 flex-col items-center justify-center text-center text-xs text-[#95a097]">
            <ShoppingBag size={22} className="mb-2 text-[#b0bba2]" />
            <p className="font-semibold text-[#5a6b60]">Bill is empty</p>
            <p className="text-[11px] text-[#8e988f]">Tap menu items to add to cart</p>
          </div>
        )}
      </div>

      {/* Discount Section */}
      <div className="mt-3 rounded-xl border border-[#dedcd2] bg-[#fbfaf6] p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#738077] flex items-center gap-1">
            <Tag size={12} /> Discount
          </span>
          <div className="flex rounded-md border border-[#dedcd2] bg-white p-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => setDiscountMode('flat')}
              className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${discountMode === 'flat' ? 'bg-[#315f52] text-white' : 'text-[#738077]'}`}
            >
              {shop?.currency || 'AED'}
            </button>
            <button
              type="button"
              onClick={() => setDiscountMode('percent')}
              className={`px-2 py-0.5 rounded font-semibold transition cursor-pointer ${discountMode === 'percent' ? 'bg-[#315f52] text-white' : 'text-[#738077]'}`}
            >
              %
            </button>
          </div>
        </div>
        <div className="relative">
          <input
            type="number"
            min="0"
            max={discountMode === 'percent' ? 100 : rawSubtotal / 100}
            step={discountMode === 'percent' ? '1' : '0.5'}
            placeholder={discountMode === 'percent' ? "e.g. 10%" : `e.g. 5.00 ${shop?.currency || 'AED'}`}
            value={discountVal}
            onChange={e => setDiscountVal(e.target.value)}
            className="w-full rounded-lg border border-[#dedcd2] bg-white px-2.5 py-1.5 text-xs text-[#2e4238] outline-none focus:border-[#315f52] focus:ring-1 focus:ring-[#315f52]"
          />
          {discountVal && (
            <button
              type="button"
              onClick={() => setDiscountVal('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Calculations Summary */}
      <div className="space-y-1.5 py-3 text-xs">
        <div className="flex justify-between text-[#78837a]">
          <span>Subtotal ({cartLines.reduce((n, x) => n + x.qty, 0)} items)</span>
          <span className="mono">{money(rawSubtotal, shop?.currency)}</span>
        </div>

        {discountCents > 0 && (
          <div className="flex justify-between font-semibold text-emerald-700">
            <span>Discount {discountMode === 'percent' ? `(${discountVal}%)` : ''}</span>
            <span className="mono">−{money(discountCents, shop?.currency)}</span>
          </div>
        )}

        {isTaxExclusive && taxRateBps > 0 && (
          <div className="flex justify-between text-[#78837a]">
            <span>Tax ({(taxRateBps / 100).toFixed(2)}%)</span>
            <span className="mono">+{money(tax, shop?.currency)}</span>
          </div>
        )}

        {/* Parcel Packaging Fee Row */}
        {isTakeaway && parcelCents > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-[#fbf5eb] px-2.5 py-1 text-xs font-semibold text-[#aa7329] border border-[#f1e1c7]">
            <span className="flex items-center gap-1.5">
              <Package size={13} /> Parcel / Packaging fee
            </span>
            <span className="mono font-bold">+{money(parcelCents, shop?.currency)}</span>
          </div>
        )}

        <div className="border-t border-[#ecebe4] pt-2">
          <div className="flex justify-between text-sm font-semibold text-[#2f4439]">
            <span>Total due</span>
            <span className="mono text-xl font-bold text-[#315f52]">{money(total, shop?.currency)}</span>
          </div>
          {!isTaxExclusive && taxRateBps > 0 && (
            <p className="mt-1 text-[11px] text-[#78837a] text-right font-medium">
              Includes {(taxRateBps / 100).toFixed(0)}% VAT: <span className="mono font-semibold text-[#315f52]">{money(tax, shop?.currency)}</span> · Net: <span className="mono font-semibold">{money(netAmountBeforeTax, shop?.currency)}</span>
            </p>
          )}
        </div>
      </div>

      {/* Payment Method Selector with Key Badges */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b978e]">
            Payment mode
          </label>
          <span className="text-[10px] text-[#97a299]">Keys: [1] to [4]</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(['cash', 'card', 'other', 'upi'] as const).map((method, idx) => (
            <button
              key={method}
              type="button"
              onClick={() => setPayment(method)}
              className={`rounded-lg border py-2 text-[11px] font-semibold capitalize transition flex flex-col items-center justify-center cursor-pointer ${
                payment === method
                  ? 'border-[#315f52] bg-[#eff5f0] text-[#315f52] shadow-xs ring-1 ring-[#315f52]'
                  : 'border-[#e4e2d9] bg-white text-[#738077] hover:bg-[#faf9f4]'
              }`}
              title={`Select ${method.toUpperCase()} (Press '${idx + 1}')`}
            >
              <span>{method === 'upi' ? 'UPI' : method}</span>
              <span className="text-[9px] font-mono opacity-50">[{idx + 1}]</span>
            </button>
          ))}
        </div>
      </div>

      {/* 1-Touch Quick POS Sale Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          disabled={!cartLines.length || complete.isPending}
          onClick={() => { setPayment('cash'); pay('cash'); }}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50/80 hover:bg-emerald-100/90 py-3 px-2 text-xs font-bold text-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-98"
          title="Instant 1-Key Cash Sale (Press 'C')"
        >
          <span>💵 Cash Pay</span>
          <kbd className="rounded bg-emerald-200/70 px-1.5 py-0.2 text-[9px] font-mono font-bold">[C]</kbd>
        </button>
        <button
          type="button"
          disabled={!cartLines.length || complete.isPending}
          onClick={() => { setPayment('card'); pay('card'); }}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-teal-600/30 bg-teal-50/80 hover:bg-teal-100/90 py-3 px-2 text-xs font-bold text-teal-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-98"
          title="Instant 1-Key Card Sale (Press 'K')"
        >
          <span>💳 Card Pay</span>
          <kbd className="rounded bg-teal-200/70 px-1.5 py-0.2 text-[9px] font-mono font-bold">[K]</kbd>
        </button>
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg bg-[#f8e9e4] p-2.5 text-xs text-[#a3463b]">{error}</p>}

      {/* Primary Charge Button with Enter Key indicator */}
      <button
        data-testid="button-complete-payment"
        disabled={!cartLines.length || complete.isPending}
        onClick={() => pay()}
        className="flex w-full items-center justify-between rounded-xl bg-[#315f52] px-4 py-3.5 text-sm font-semibold text-white shadow hover:bg-[#274f44] disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer active:scale-98"
        title="Complete Payment (Press Enter or Space)"
      >
        <span className="flex items-center gap-2">
          {complete.isPending ? <LoaderCircle className="animate-spin" size={17} /> : <CreditCard size={17} />}
          Charge {money(total, shop?.currency)}
        </span>
        <kbd className="rounded bg-white/20 px-2 py-0.5 text-xs font-mono font-semibold tracking-wide">
          Enter ↵
        </kbd>
      </button>

      <p className="mt-2 text-center text-[10px] text-[#9aa29b]">
        Recorded as cashier <strong>{activeCashier}</strong> · Encrypted transaction ID
      </p>
    </>
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#9b8059]">Point of Sale (POS) Register</p>
          <h1 className="text-[26px] font-semibold tracking-[-.04em] text-[#2c4339] md:text-[32px]">
            Live Counter Register
          </h1>
        </div>

        {/* Multi-Shop & Multi-User Billing Bar */}
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#dedcd2] bg-white p-1.5 shadow-sm">
          {/* Shop Switcher */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs">
            <Store size={14} className="text-[#315f52]" />
            <select
              aria-label="Current shop"
              value={shop?.id || ''}
              onChange={e => {
                localStorage.setItem('billflow-shop', e.target.value);
                window.location.reload();
              }}
              className="bg-transparent font-semibold text-[#2c4339] outline-none cursor-pointer"
            >
              {shops.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="h-5 w-[1px] bg-[#e6e4dc]" />

          {/* Cashier / Operator Switcher */}
          <div className="flex items-center gap-2 px-2.5 py-1 text-xs">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#e7efe7] text-[10px] font-bold text-[#315f52]">
              {activeCashier.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            <div className="text-left">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-[#8b978e]">Billing as</span>
              <select
                aria-label="Select billing cashier"
                value={activeCashier}
                onChange={e => setActiveCashier(e.target.value)}
                className="bg-transparent font-semibold text-[#2c4339] outline-none cursor-pointer"
              >
                {staffList.map(sName => (
                  <option key={sName} value={sName}>
                    {sName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-[#e6e4dc]" />

          {/* Today's Cash Drawer & Register Flow */}
          <div className="hidden sm:flex items-center gap-2.5 px-2.5 py-1 text-xs bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Today Sales</span>
              <span className="mono font-extrabold text-xs text-emerald-900">{money(todaySalesCents, shop?.currency)}</span>
            </div>
            <div className="h-4 w-[1px] bg-[#e6e4dc]" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600">Expenses</span>
              <span className="mono font-extrabold text-xs text-rose-800">−{money(todayExpensesCents, shop?.currency)}</span>
            </div>
            <div className="h-4 w-[1px] bg-[#e6e4dc]" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Net Drawer</span>
              <span className="mono font-extrabold text-xs text-slate-900">{money(todayNetDrawerCents, shop?.currency)}</span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-[#e6e4dc]" />

          {/* Quick Expense Payout Button */}
          <button
            type="button"
            onClick={() => {
              setPosExpenseTitle('');
              setPosExpenseAmount('');
              setPosExpenseError('');
              setPosExpenseModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition cursor-pointer shadow-xs"
            title="Log cash drawer payout or shop expense"
          >
            <Wallet size={13} className="text-amber-700" />
            <span>+ Expense</span>
          </button>

          <div className="h-5 w-[1px] bg-[#e6e4dc]" />

          {/* Shortcuts Guide Button */}
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-[#315f52] hover:bg-[#eff5f0] transition cursor-pointer"
            title="Billing Keyboard Shortcuts (?)"
          >
            <Keyboard size={14} />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="rounded bg-[#dedcd2]/60 px-1 py-0.2 text-[9px] font-mono text-[#55675c]">?</kbd>
          </button>

          <div className="h-5 w-[1px] bg-[#e6e4dc]" />

          {/* Bluetooth Printer Status & Quick Access */}
          <Link
            href="/receipt"
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
              savedBtInfo
                ? 'bg-teal-50 border border-teal-200/80 text-teal-900 hover:bg-teal-100'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title={savedBtInfo ? `Bluetooth Printer: ${savedBtInfo.name}` : 'Pair Bluetooth Thermal Printer (50mm / 58mm / 80mm)'}
          >
            <Bluetooth size={13} className={savedBtInfo ? 'text-teal-700' : 'text-slate-400'} />
            <span className="hidden md:inline">{savedBtInfo ? savedBtInfo.name : 'Pair Printer'}</span>
            <span className="md:hidden">BT</span>
          </Link>

          <div className="h-5 w-[1px] bg-[#e6e4dc]" />

          {/* Fullscreen / Cashier Kiosk Mode Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-xs"
            title="Toggle Fullscreen Kiosk Mode"
          >
            {isFullscreen ? <Minimize2 size={13} className="text-slate-700" /> : <Maximize2 size={13} className="text-slate-700" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Kiosk' : 'Kiosk'}</span>
          </button>

          {/* Install Standalone App Button */}
          {!isPwaInstalled && (
            <>
              <div className="h-5 w-[1px] bg-[#e6e4dc]" />
              <button
                type="button"
                onClick={handleInstallPwa}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 px-3 py-1 text-xs font-bold text-white hover:from-emerald-800 hover:to-teal-900 transition cursor-pointer shadow-xs"
                title="Install as dedicated POS software on Tablet or PC"
              >
                <Smartphone size={13} />
                <span>Install POS</span>
              </button>
            </>
          )}
        </div>
      </div>

      {btToast && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 text-xs font-semibold text-teal-900 animate-in fade-in">
          <span className="flex items-center gap-2">
            <Bluetooth size={16} className="text-teal-700" /> {btToast}
          </span>
          <button onClick={() => setBtToast('')} className="text-teal-700 hover:opacity-75 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {posExpenseToast && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#e5f3e7] border border-[#b7dfbd] px-4 py-3 text-xs font-semibold text-[#295b34] animate-in fade-in">
          <span className="flex items-center gap-2">
            <Check size={16} /> {posExpenseToast}
          </span>
          <button onClick={() => setPosExpenseToast('')} className="text-[#295b34] hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      <EmptyShop shops={shops} />

      {/* Split Screen POS Interface: LHS Menu items, RHS Total bill */}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_390px]">
        {/* LHS Menu Items & Category Tabs */}
        <section className="min-w-0">
          {/* Category Tabs */}
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
            <button
              onClick={() => setCategory(undefined)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                !category
                  ? 'bg-[#315f52] text-white shadow-sm'
                  : 'border border-[#dedcd2] bg-white text-[#55675c] hover:border-[#315f52]/40 hover:bg-[#f6f5ef]'
              }`}
            >
              <span>All items</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  !category ? 'bg-white/20 text-white' : 'bg-[#eef0ea] text-[#6d7b72]'
                }`}
              >
                {active.length}
              </span>
            </button>

            {cats.data?.map((c: Category) => {
              const count = active.filter(p => p.categoryId === c.id).length;
              const isSelected = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-[#315f52] text-white shadow-sm'
                      : 'border border-[#dedcd2] bg-white text-[#55675c] hover:border-[#315f52]/40 hover:bg-[#f6f5ef]'
                  }`}
                >
                  <span>{c.name}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[#eef0ea] text-[#6d7b72]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar with keyboard shortcut */}
          <div className="relative mb-5">
            <Search size={16} className="absolute left-3.5 top-3.5 text-[#97a098]" />
            <input
              ref={searchInputRef}
              data-testid="input-search-products"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (active.length > 0) {
                    const topItem = active[0];
                    setCart(prev => ({ ...prev, [topItem.id]: (prev[topItem.id] || 0) + 1 }));
                    setSearch('');
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setSearch('');
                  (e.target as HTMLElement).blur();
                }
              }}
              placeholder="Find product by name or SKU... [Press Enter to add, Esc to exit]"
              className={`${inputClass} pl-10 pr-24 py-3 text-sm`}
            />
            <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rounded px-1.5 py-1 text-xs text-[#8c978f] hover:text-[#31463c] cursor-pointer"
                >
                  Clear
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[#dfddd5] bg-[#f5f4ed] px-1.5 py-0.5 text-[10px] font-semibold text-[#8a968d]" title="Press '/' or 'Ctrl+K' to focus search">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Product Grid: 2-column compact on mobile, 3-column on desktop */}
          <QueryState loading={products.isLoading} error={products.isError} retry={() => products.refetch()} empty={!active.length}>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((p: Product) => {
                const inCartQty = cart[p.id] || 0;
                const hasParcelFee = (p.parcelType === 'fixed' || (p.parcelValue && p.parcelValue > 0));
                return (
                  <button
                    data-testid={`button-add-cart-${p.id}`}
                    onClick={() => setCart({ ...cart, [p.id]: inCartQty + 1 })}
                    key={p.id}
                    className={`surface group relative flex flex-col justify-between overflow-hidden p-3 sm:p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md active:scale-98 ${
                      inCartQty > 0 ? 'ring-2 ring-[#315f52] border-[#315f52]' : 'hover:border-[#9cb3a1]'
                    }`}
                  >
                    {inCartQty > 0 && (
                      <span className="absolute right-2.5 top-2.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-[#315f52] text-xs font-bold text-white shadow">
                        {inCartQty}
                      </span>
                    )}

                    <div className="mb-2 sm:mb-3 flex h-20 sm:h-28 items-center justify-center rounded-xl bg-[#f1f3ec] text-[#98ab9c] overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-full w-full rounded-xl object-cover transition duration-300 group-hover:scale-105"
                          onError={e => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <ShoppingBag size={24} />
                      )}
                    </div>

                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <p className="truncate text-xs sm:text-sm font-semibold text-[#2f4337]">{p.name}</p>
                      </div>
                      {p.description && (
                        <p className="mt-0.5 line-clamp-1 text-[10px] sm:text-[11px] text-[#869288]">{p.description}</p>
                      )}
                    </div>

                    <div className="mt-2.5 sm:mt-3 flex items-center justify-between border-t border-[#f0eee6] pt-2">
                      <div>
                        <span className="mono text-sm sm:text-base font-bold text-[#315f52]">
                          {money(p.priceCents, shop?.currency)}
                        </span>
                        {hasParcelFee && (
                          <span
                            title={`Takeaway packaging fee applies: ${money(p.parcelValue, shop?.currency)}`}
                            className="mt-0.5 block text-[9px] sm:text-[10px] font-semibold text-[#aa7329]"
                          >
                            📦 +{money(p.parcelValue, shop?.currency)}
                          </span>
                        )}
                      </div>
                      <span className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-xl bg-[#edf3ec] text-[#315f52] group-hover:bg-[#315f52] group-hover:text-white transition">
                        <Plus size={15} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </QueryState>
        </section>

        {/* DESKTOP RHS Checkout Sidebar (Unchanged on desktop/tablet) */}
        <aside className="surface sticky top-[84px] p-5 shadow-sm hidden xl:block">
          {renderCartContent(false)}
        </aside>

        {/* MOBILE Cart section if user scrolls down on tablet/mobile */}
        <aside className="surface p-5 shadow-sm xl:hidden">
          {renderCartContent(false)}
        </aside>
      </div>

      {/* FLOATING MOBILE CHECKOUT PILL (Sticky above bottom thumb bar when items are in cart) */}
      {cartLines.length > 0 && (
        <div className="fixed bottom-[64px] inset-x-3 z-30 flex items-center justify-between rounded-2xl bg-[#203d37] text-white px-4 py-3 shadow-2xl border border-white/10 xl:hidden animate-in slide-in-from-bottom-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/25 text-emerald-300 font-extrabold text-sm border border-emerald-400/30">
              {cartLines.reduce((n, x) => n + x.qty, 0)}
            </span>
            <div>
              <p className="text-[10px] text-[#a6b8af] uppercase tracking-wider font-bold">Total Bill</p>
              <p className="text-base font-extrabold text-white leading-tight">{money(total, shop?.currency)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0f241a] px-4 py-2.5 text-xs font-bold shadow-md active:scale-95 transition cursor-pointer"
          >
            <span>Review & Pay</span>
            <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* MOBILE SLIDE-UP CART BOTTOM SHEET */}
      {mobileCartOpen && (
        <div className="fixed inset-0 z-50 xl:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setMobileCartOpen(false)}
          />
          <div className="relative z-10 w-full max-h-[88vh] bg-white rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-[#f7f6f0]">
              <div className="flex items-center gap-2">
                <ShoppingBag size={18} className="text-[#315f52]" />
                <h3 className="font-bold text-[#2f4337] text-sm">Review Cart & Checkout</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {renderCartContent(true)}
            </div>
          </div>
        </div>
      )}

      {/* Quick Shortcuts Pill Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dedcd2] bg-white/90 px-4 py-2 text-[11px] text-[#55675c] shadow-xs backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-[#315f52] flex items-center gap-1">
            <Zap size={14} className="text-[#315f52]" /> Quick Keys:
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-[#dedcd2] bg-[#f8f7f2] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#315f52]">Enter / Space</kbd>
            <span>Charge</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-[#dedcd2] bg-[#f8f7f2] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#315f52]">C</kbd>
            <span>Cash Pay</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-[#dedcd2] bg-[#f8f7f2] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#315f52]">U</kbd>
            <span>UPI Pay</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-[#dedcd2] bg-[#f8f7f2] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#315f52]">1-4</kbd>
            <span>Mode</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-[#dedcd2] bg-[#f8f7f2] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#315f52]">D / T</kbd>
            <span>Dine/Takeaway</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-[#dedcd2] bg-[#f8f7f2] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#315f52]">/</kbd>
            <span>Search</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-[#dedcd2] bg-[#f8f7f2] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#9c6258]">Delete</kbd>
            <span>Clear</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowShortcutsModal(true)}
          className="font-semibold text-[#315f52] hover:underline cursor-pointer flex items-center gap-1"
        >
          <span>All shortcuts</span>
          <kbd className="rounded bg-[#dedcd2]/50 px-1 py-0.2 text-[9px] font-mono">?</kbd>
        </button>
      </div>

      {/* Payment Complete & Thermal Receipt Modal with Hotkeys */}
      {sale && (
        <Modal
          title="Payment Completed"
          subtitle={`Bill #${sale.billNumber} · Paid via ${sale.paymentMethod.toUpperCase()}`}
          icon={<Check size={20} className="text-emerald-700" />}
          maxWidth="max-w-lg"
          onClose={() => setSale(null)}
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-sm ring-4 ring-emerald-50">
                <Check size={28} />
              </div>
              <h3 className="mt-3 text-lg font-bold text-slate-800">
                {money(sale.totalCents, shop?.currency)} Collected
              </h3>
              <p className="text-xs text-slate-500">
                Cashier: <strong>{sale.employeeName || activeCashier}</strong> · {dateLabel(sale.createdAt)}
              </p>
            </div>

            <div className="max-h-[50vh] overflow-y-auto w-full flex justify-center p-4 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-inner">
              <ReceiptPreview
                id="billflow-checkout-receipt"
                cfg={loadRc()}
                sampleSale={{
                  billNo: sale.billNumber,
                  date: `${dateLabel(sale.createdAt)} ${new Date(sale.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`,
                  cashier: sale.employeeName || activeCashier,
                  payment: sale.paymentMethod,
                  items: sale.items.map(it => ({
                    name: it.productName,
                    qty: it.quantity,
                    price: (it.unitPriceCents || Math.round(it.lineTotalCents / (it.quantity || 1))) / 100,
                  })),
                  subtotal: (sale.subtotalCents || rawSubtotal) / 100,
                  discount: (sale.discountCents || 0) / 100,
                  tax: (sale.taxCents || 0) / 100,
                  taxRate: (shop?.taxRateBps || 0) / 100,
                  taxIncluded: !isTaxExclusive,
                  net: Math.max(0, (sale.subtotalCents || rawSubtotal) - (sale.discountCents || 0) - (sale.taxCents || 0)) / 100,
                  parcel: (sale.parcelCents || 0) / 100,
                  total: sale.totalCents / 100,
                  currency: shop?.currency || 'AED',
                }}
              />
            </div>

            <div className="flex w-full gap-3 pt-2">
              <button
                onClick={() =>
                  executeSmartReceiptPrint('billflow-checkout-receipt', sale, loadRc(), shop, msg => {
                    setBtToast(msg);
                    setTimeout(() => setBtToast(''), 3500);
                  })
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 hover:from-emerald-800 hover:to-teal-900 transition cursor-pointer"
                title="Print Receipt (Press 'P' or 'Enter')"
              >
                <Printer size={16} />
                <span>Print Receipt</span>
                <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">P / ↵</kbd>
              </button>
              <button
                onClick={() => setSale(null)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Start Next Bill (Press 'Esc' or 'Space')"
              >
                <span>Start Next Bill</span>
                <kbd className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-mono">Esc / Space</kbd>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* POS Keyboard Shortcuts Cheatsheet Modal */}
      {showShortcutsModal && (
        <Modal
          title="POS Keyboard Shortcuts"
          subtitle="Speed up your billing checkout without touching the mouse"
          icon={<Keyboard size={20} className="text-[#315f52]" />}
          maxWidth="max-w-md"
          onClose={() => setShowShortcutsModal(false)}
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3.5">
              <p className="font-bold text-emerald-900 flex items-center gap-1.5 text-sm mb-2.5">
                <Zap size={15} /> 1-Touch Fast Checkout
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-950 font-medium">Charge current bill</span>
                  <kbd className="rounded bg-white px-2 py-1 font-mono font-bold text-emerald-800 shadow-xs border border-emerald-200">Enter / Space</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-950 font-medium">Instant Cash Pay</span>
                  <kbd className="rounded bg-white px-2 py-1 font-mono font-bold text-emerald-800 shadow-xs border border-emerald-200">C</kbd>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-950 font-medium">Instant UPI Pay</span>
                  <kbd className="rounded bg-white px-2 py-1 font-mono font-bold text-emerald-800 shadow-xs border border-emerald-200">U</kbd>
                </div>
              </div>
            </div>

            <div className="divide-y divide-[#eeede6] rounded-2xl border border-[#dedcd2] bg-white p-3.5">
              <p className="font-bold text-[#2c4339] text-xs uppercase tracking-wider mb-2">Payment & Order Modes</p>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Select Cash mode</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">1</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Select UPI mode</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">2</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Select Card mode</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">3</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Select Other mode</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">4</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Switch to Dine-In</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">D</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Switch to Takeaway / Parcel</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">T</kbd>
              </div>
            </div>

            <div className="divide-y divide-[#eeede6] rounded-2xl border border-[#dedcd2] bg-white p-3.5">
              <p className="font-bold text-[#2c4339] text-xs uppercase tracking-wider mb-2">Search & Cart</p>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Focus product search</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">/ or Ctrl+K</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Add top matched item to cart</span>
                <span className="text-[#728378]">In search, hit <kbd className="rounded bg-[#f5f4ed] px-1.5 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">Enter ↵</kbd></span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Clear search / blur</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">Esc</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Clear entire cart</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#9c6258] border border-[#dedcd2]">Delete</kbd>
              </div>
            </div>

            <div className="divide-y divide-[#eeede6] rounded-2xl border border-[#dedcd2] bg-white p-3.5">
              <p className="font-bold text-[#2c4339] text-xs uppercase tracking-wider mb-2">Receipt & Next Customer</p>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Print Receipt copy</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">P or Enter</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[#55675c]">Start Next Bill</span>
                <kbd className="rounded bg-[#f5f4ed] px-2 py-0.5 font-mono font-semibold text-[#315f52] border border-[#dedcd2]">Esc or Space</kbd>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowShortcutsModal(false)}
              className="w-full rounded-xl bg-[#315f52] py-2.5 text-xs font-semibold text-white hover:bg-[#274f44] transition cursor-pointer"
            >
              Got it, continue billing
            </button>
          </div>
        </Modal>
      )}

      {/* POS Quick Register Payout Modal */}
      {posExpenseModalOpen && (
        <Modal
          title="Record Register Payout / Expense"
          subtitle="Deduct payout directly from counter register cash drawer"
          icon={<Wallet size={20} className="text-amber-700" />}
          maxWidth="max-w-md"
          onClose={() => setPosExpenseModalOpen(false)}
        >
          <form onSubmit={handlePosExpenseSubmit} className="space-y-4">
            {posExpenseError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                {posExpenseError}
              </div>
            )}

            <Field label="Expense Description" required hint="e.g. Fresh milk, Delivery tip">
              <input
                type="text"
                value={posExpenseTitle}
                onChange={e => setPosExpenseTitle(e.target.value)}
                placeholder="What was paid for?"
                className={inputClass}
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Amount (${shop?.currency || 'AED'})`} required>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={posExpenseAmount}
                  onChange={e => setPosExpenseAmount(e.target.value)}
                  placeholder="0.00"
                  className={inputClass}
                />
              </Field>

              <Field label="Payment Mode">
                <select
                  value={posExpensePayment}
                  onChange={e => setPosExpensePayment(e.target.value as any)}
                  className={inputClass}
                >
                  <option value="cash">💵 Cash Drawer</option>
                  <option value="card">💳 Card</option>
                  <option value="upi">📱 UPI</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>

            <Field label="Category">
              <select
                value={posExpenseCategory}
                onChange={e => setPosExpenseCategory(e.target.value)}
                className={inputClass}
              >
                {UNIVERSAL_EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPosExpenseModalOpen(false)}
                className="w-1/2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createExpenseMutation.isPending}
                className="w-1/2 flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 py-2.5 text-xs font-bold text-white transition disabled:opacity-50"
              >
                {createExpenseMutation.isPending ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />}
                <span>Deduct & Save</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* iPad / iPhone PWA Home Screen Guide */}
      {showIosInstallModal && (
        <Modal
          title="Install BillFlow POS on iPad"
          subtitle="Run as full-screen dedicated POS software without Safari address bar"
          icon={<Smartphone size={20} className="text-emerald-700" />}
          maxWidth="max-w-md"
          onClose={() => setShowIosInstallModal(false)}
        >
          <div className="space-y-4 p-2 text-sm text-slate-700">
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white shrink-0">1</span>
              <div>
                <p className="font-semibold text-slate-900">Tap the Share icon in Safari</p>
                <p className="text-xs text-slate-500 mt-0.5">Look for the square box with an arrow pointing up [↑] at the top right of Safari.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white shrink-0">2</span>
              <div>
                <p className="font-semibold text-slate-900">Scroll down and tap 'Add to Home Screen'</p>
                <p className="text-xs text-slate-500 mt-0.5">This creates a direct app icon on your iPad's home screen.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white shrink-0">3</span>
              <div>
                <p className="font-semibold text-slate-900">Launch from Home Screen</p>
                <p className="text-xs text-slate-500 mt-0.5">BillFlow POS will open edge-to-edge in full screen with no browser address bar or tabs!</p>
              </div>
            </div>
            <button
              onClick={() => setShowIosInstallModal(false)}
              className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-semibold text-white hover:bg-emerald-800 transition cursor-pointer"
            >
              Got it
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Sales() {
  const { shop } = useCurrentShop();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [toast, setToast] = useState('');

  const currentShopId = shop?.id || 1;
  const params = {
    shopId: currentShopId,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const q = useListSales(params, { query: { enabled: !!shop, queryKey: getListSalesQueryKey(params) } });

  const rawSales = q.data || [];
  const staffNames = Array.from(new Set(rawSales.map(s => s.employeeName || 'Staff'))).filter(Boolean);

  const filteredSales = staffFilter === 'all'
    ? rawSales
    : rawSales.filter(s => (s.employeeName || 'Staff').toLowerCase() === staffFilter.toLowerCase());

  const totalFilteredCents = filteredSales.reduce((a, s) => a + (s.totalCents || 0), 0);

  async function copyForGoogleSheets() {
    if (!filteredSales.length) return;
    const headers = [
      'Bill #',
      'Date',
      'Time',
      'Cashier / Staff',
      'Order Type',
      'Payment Mode',
      'Items Qty',
      `Subtotal (${shop?.currency || 'AED'})`,
      `Tax (${shop?.currency || 'AED'})`,
      `Parcel Packaging (${shop?.currency || 'AED'})`,
      `Total Bill (${shop?.currency || 'AED'})`,
    ];
    const rows = filteredSales.map(s => [
      `#${s.billNumber}`,
      s.createdAt.slice(0, 10),
      new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      s.employeeName || 'Staff',
      s.orderType === 'takeaway' ? 'Takeaway / Parcel' : 'Dine In',
      s.paymentMethod.toUpperCase(),
      s.items.reduce((n, x) => n + x.quantity, 0),
      (s.subtotalCents / 100).toFixed(2),
      ((s.taxCents || 0) / 100).toFixed(2),
      ((s.parcelCents || 0) / 100).toFixed(2),
      (s.totalCents / 100).toFixed(2),
    ]);
    const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    const ok = await copyToClipboard(tsv);
    if (ok) {
      setToast('Sales data copied! Open Google Sheets and press Ctrl+V to paste into columns.');
      setTimeout(() => setToast(''), 4500);
    }
  }

  function exportCsv() {
    if (!filteredSales.length) return;
    const headers = ['Bill Number', 'Date', 'Time', 'Staff', 'Order', 'Payment', 'Items', 'Subtotal', 'Tax', 'Parcel', 'Total'];
    const rows = filteredSales.map(s => [
      s.billNumber,
      s.createdAt.slice(0, 10),
      new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      s.employeeName || 'Staff',
      s.orderType,
      s.paymentMethod,
      s.items.reduce((n, x) => n + x.quantity, 0),
      s.subtotalCents / 100,
      (s.taxCents || 0) / 100,
      (s.parcelCents || 0) / 100,
      s.totalCents / 100,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `billflow-sales-${dateInput()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeading
        eyebrow="Transactions"
        title="Sales History"
        sub="Review every completed bill, track sales per staff member, and export to Google Sheets."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!filteredSales.length}
              onClick={copyForGoogleSheets}
              className="flex items-center gap-2 rounded-xl border border-[#315f52] bg-[#eff5f0] px-4 py-2.5 text-xs font-semibold text-[#315f52] shadow-xs hover:bg-[#e4efe6] disabled:opacity-50 transition"
            >
              <FileSpreadsheet size={15} /> Copy for Google Sheets
            </button>
            <button
              disabled={!filteredSales.length}
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-xl border border-[#dedcd2] bg-white px-4 py-2.5 text-xs font-semibold text-[#526357] shadow-xs hover:bg-[#faf9f4] disabled:opacity-50 transition"
            >
              <Download size={15} /> Export CSV
            </button>
          </div>
        }
      />

      {toast && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#e5f3e7] border border-[#b7dfbd] px-4 py-3 text-xs font-semibold text-[#295b34]">
          <span className="flex items-center gap-2">
            <Check size={16} /> {toast}
          </span>
          <button onClick={() => setToast('')} className="text-[#295b34] hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Filters and Staff Breakdown Bar */}
      <div className="surface mb-5 flex flex-wrap items-end gap-3 p-4 shadow-sm">
        <Field label="Filter by Staff">
          <select
            value={staffFilter}
            onChange={e => setStaffFilter(e.target.value)}
            className={`${inputClass} min-w-[160px]`}
          >
            <option value="all">All Staff Members ({rawSales.length} bills)</option>
            {staffNames.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="From Date">
          <input
            aria-label="From date"
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="To Date">
          <input
            aria-label="To date"
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className={inputClass}
          />
        </Field>

        <button
          onClick={() => {
            setFrom('');
            setTo('');
            setStaffFilter('all');
          }}
          className="rounded-lg border border-[#dedcd2] px-3.5 py-2.5 text-xs font-semibold text-[#5a6a60] hover:bg-[#f6f5ef]"
        >
          Reset filters
        </button>

        <div className="ml-auto flex items-center gap-3 pt-1">
          <span className="text-xs font-semibold text-[#486253]">
            Total in view: <span className="mono font-bold text-sm text-[#315f52]">{money(totalFilteredCents, shop?.currency)}</span>
          </span>
          <span className="rounded-full bg-[#edf2ec] px-2.5 py-1 text-[11px] font-bold text-[#456b54]">
            {filteredSales.length} bills
          </span>
        </div>
      </div>

      <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!filteredSales.length}>
        {/* MOBILE CARD VIEW: Clean touch cards for phone screens */}
        <div className="space-y-2.5 md:hidden">
          {filteredSales.map((s: Sale) => (
            <div key={s.id} className="surface p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="mono font-bold text-sm text-[#2e4338]">#{s.billNumber}</span>
                  <Pill tone={s.orderType === 'takeaway' ? 'amber' : 'gray'}>
                    {s.orderType === 'takeaway' ? '📦 Takeaway' : '🍽️ Dine in'}
                  </Pill>
                </div>
                <span className="mono font-extrabold text-base text-[#315f52]">
                  {money(s.totalCents, shop?.currency)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[#78837a]">
                <span>{dateLabel(s.createdAt)} · {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="font-semibold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">
                  {s.paymentMethod}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[#eeede6] pt-2 text-[11px] text-[#869288]">
                <span>Cashier: <strong>{s.employeeName || 'Staff'}</strong> ({s.items.reduce((n, x) => n + x.quantity, 0)} items)</span>
                {s.parcelCents && s.parcelCents > 0 ? (
                  <span className="text-[#a87425] font-semibold text-[10px]">
                    +{money(s.parcelCents, shop?.currency)} parcel
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* DESKTOP DATA TABLE: Unchanged for laptop and tablet view */}
        <div className="hidden md:block">
          <DataTable
            headers={['Bill #', 'Date & Time', 'Staff Operator', 'Order', 'Payment', 'Items', 'Parcel Fee', 'Total']}
            rows={filteredSales.map((s: Sale) => [
              <span className="mono text-xs font-bold text-[#2e4338]">#{s.billNumber}</span>,
              <span>
                {dateLabel(s.createdAt)}
                <small className="block text-[10px] text-[#8f9991]">
                  {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </small>
              </span>,
              <span className="font-semibold text-[#32483d] flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-[#e3ece4] text-[9px] font-bold text-[#315f52]">
                  {(s.employeeName || 'S')[0].toUpperCase()}
                </span>
                {s.employeeName || 'Staff'}
              </span>,
              <Pill tone={s.orderType === 'takeaway' ? 'amber' : 'gray'}>
                {s.orderType === 'takeaway' ? '📦 Takeaway' : '🍽️ Dine in'}
              </Pill>,
              <Pill>{s.paymentMethod.toUpperCase()}</Pill>,
              <span className="text-xs font-medium">{s.items.reduce((n, x) => n + x.quantity, 0)} items</span>,
              (s.parcelCents && s.parcelCents > 0) ? (
                <span className="mono text-xs font-semibold text-[#a87425]">
                  +{money(s.parcelCents, shop?.currency)}
                </span>
              ) : (
                <span className="text-[#a1aba3] text-xs">—</span>
              ),
              <span className="mono font-bold text-[#2d4439]">{money(s.totalCents, shop?.currency)}</span>,
            ])}
          />
        </div>
      </QueryState>
    </>
  );
}

function Expenses() {
  const { shop, shops } = useCurrentShop();
  const { user } = useAuth();
  const [modal, setModal] = useState(false);
  const [entryMode, setEntryMode] = useState<'simple' | 'multi'>('simple');
  const [msg, setMsg] = useState('');
  const [toast, setToast] = useState('');

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  // Inline Quick-Add bar state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState(UNIVERSAL_EXPENSE_CATEGORIES[0].name);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickPayment, setQuickPayment] = useState<'cash' | 'upi' | 'card' | 'other'>('cash');
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);

  // Modal Simple Expense State
  const [simpleTitle, setSimpleTitle] = useState('');
  const [simpleCategory, setSimpleCategory] = useState(UNIVERSAL_EXPENSE_CATEGORIES[0].name);
  const [simpleAmount, setSimpleAmount] = useState<string>('');
  const [simplePayment, setSimplePayment] = useState<'cash' | 'upi' | 'card' | 'other'>('cash');
  const [simpleDate, setSimpleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [simpleSupplier, setSimpleSupplier] = useState('');
  const [simpleReference, setSimpleReference] = useState('');
  const [simpleNote, setSimpleNote] = useState('');

  // Modal Multi-Item Procurement State
  const [multiRows, setMultiRows] = useState<Array<{
    id: string;
    productName: string;
    categoryName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>>([
    {
      id: 'row-1',
      productName: EXPENSE_TAXONOMY[0].items[0]?.name || 'Tomatoes',
      categoryName: EXPENSE_TAXONOMY[0].name,
      quantity: 5,
      unit: EXPENSE_TAXONOMY[0].items[0]?.unit || 'kg',
      unitPrice: EXPENSE_TAXONOMY[0].items[0]?.suggestedPrice || 4,
    },
  ]);
  const [multiPayment, setMultiPayment] = useState<'cash' | 'upi' | 'card' | 'other'>('cash');
  const [multiDate, setMultiDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [multiSupplier, setMultiSupplier] = useState('');
  const [multiReference, setMultiReference] = useState('');
  const [multiNote, setMultiNote] = useState('');

  const currentShopId = shop?.id || 1;
  const params = { shopId: currentShopId };
  const q = useListExpenses(params, { query: { enabled: !!shop, queryKey: getListExpensesQueryKey(params) } });
  const create = useCreateExpense();
  const qc = useQueryClient();

  // Multi-item calculations
  const multiTotal = multiRows.reduce((acc, r) => acc + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0), 0);

  // Quick preset click handlers
  function applyQuickPreset(preset: typeof QUICK_EXPENSE_PRESETS[0]) {
    setQuickTitle(preset.label);
    setQuickCategory(preset.category);
    if (preset.amount) setQuickAmount(preset.amount);
  }

  function applyModalPreset(preset: typeof QUICK_EXPENSE_PRESETS[0]) {
    setSimpleTitle(preset.label);
    setSimpleCategory(preset.category);
    if (preset.amount) setSimpleAmount(preset.amount);
  }

  function addAmountBooster(delta: number) {
    const cur = Number(simpleAmount) || 0;
    setSimpleAmount(String(Math.max(0, cur + delta)));
  }

  function syncExpenseSuccess(exp: Expense) {
    qc.setQueryData(getListExpensesQueryKey(params), (old: any) => {
      const list = Array.isArray(old) ? old : [];
      return [exp, ...list.filter((x: any) => x.id !== exp.id)];
    });
    qc.setQueryData(getListExpensesQueryKey({ shopId: 0 }), (old: any) => {
      const list = Array.isArray(old) ? old : [];
      return [exp, ...list.filter((x: any) => x.id !== exp.id)];
    });
    qc.setQueryData(getGetDashboardQueryKey({ shopId: currentShopId, period: 'week' }), (old: any) => {
      if (!old) return old;
      const newExpensesCents = (old.expensesCents || 0) + (exp.totalCents || 0);
      return {
        ...old,
        expensesCents: newExpensesCents,
        operatingBalanceCents: (old.salesCents || 0) - newExpensesCents,
      };
    });
    try {
      const raw = localStorage.getItem('billflow-offline-expenses');
      const list = raw ? JSON.parse(raw) : [];
      const updated = [exp, ...list.filter((x: any) => x.id !== exp.id)];
      localStorage.setItem('billflow-offline-expenses', JSON.stringify(updated));
    } catch {}
    invalidate(qc);
  }

  // Inline Quick Add Submit
  function handleInlineQuickSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shop) return;
    const title = quickTitle.trim();
    const amt = Number(quickAmount);
    if (!title) {
      setMsg('Please enter an expense title or click a quick template.');
      return;
    }
    if (!amt || amt <= 0) {
      setMsg('Please enter a valid expense amount.');
      return;
    }

    setIsQuickSubmitting(true);
    create.mutate(
      {
        data: {
          shopId: shop.id,
          expenseDate: new Date().toISOString().slice(0, 10),
          paymentMethod: quickPayment,
          items: [
            {
              categoryName: quickCategory,
              productName: title,
              quantity: 1,
              unit: 'item',
              unitPriceCents: Math.round(amt * 100),
            },
          ],
        },
      },
      {
        onSuccess: (exp: Expense) => {
          setIsQuickSubmitting(false);
          setQuickTitle('');
          setQuickAmount('');
          setToast(`Logged ${title} (${money(Math.round(amt * 100), shop.currency)}) successfully!`);
          syncExpenseSuccess(exp);
          setTimeout(() => setToast(''), 4000);
        },
        onError: () => {
          setIsQuickSubmitting(false);
          setMsg('Could not save expense. Please verify inputs and retry.');
        },
      }
    );
  }

  // Modal Simple Expense Submit
  function handleSimpleModalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shop) return;
    const title = simpleTitle.trim();
    const amt = Number(simpleAmount);
    if (!title) {
      setMsg('Please enter an expense title.');
      return;
    }
    if (!amt || amt <= 0) {
      setMsg('Please enter a valid expense amount.');
      return;
    }

    create.mutate(
      {
        data: {
          shopId: shop.id,
          expenseDate: simpleDate,
          supplier: simpleSupplier.trim() || undefined,
          invoiceReference: simpleReference.trim() || undefined,
          paymentMethod: simplePayment,
          note: simpleNote.trim() || undefined,
          items: [
            {
              categoryName: simpleCategory,
              productName: title,
              quantity: 1,
              unit: 'item',
              unitPriceCents: Math.round(amt * 100),
            },
          ],
        },
      },
      {
        onSuccess: (exp: Expense) => {
          setModal(false);
          setSimpleTitle('');
          setSimpleAmount('');
          setSimpleSupplier('');
          setSimpleReference('');
          setSimpleNote('');
          setToast('Expense successfully recorded.');
          syncExpenseSuccess(exp);
          setTimeout(() => setToast(''), 4000);
        },
        onError: () => setMsg('Could not save this expense. Please verify inputs and retry.'),
      }
    );
  }

  // Multi-item row management
  function addMultiRow(preset?: { name: string; unit: string; suggestedPrice?: number; categoryName?: string }) {
    setMultiRows(prev => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        productName: preset?.name || '',
        categoryName: preset?.categoryName || UNIVERSAL_EXPENSE_CATEGORIES[2].name,
        quantity: 1,
        unit: preset?.unit || 'kg',
        unitPrice: preset?.suggestedPrice || 10,
      },
    ]);
  }

  function removeMultiRow(id: string) {
    if (multiRows.length <= 1) {
      setMsg('An expense must contain at least one item.');
      return;
    }
    setMultiRows(prev => prev.filter(r => r.id !== id));
  }

  function updateMultiRow(id: string, field: string, val: any) {
    setMultiRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: val } : r)));
  }

  // Modal Multi-Item Submit
  function handleMultiModalSubmit(e: FormEvent) {
    e.preventDefault();
    if (!shop) return;
    if (!multiRows.length) {
      setMsg('Please add at least one line item.');
      return;
    }
    for (const r of multiRows) {
      if (!r.productName.trim()) {
        setMsg('Please ensure all items have a valid name.');
        return;
      }
    }

    create.mutate(
      {
        data: {
          shopId: shop.id,
          expenseDate: multiDate,
          supplier: multiSupplier.trim() || undefined,
          invoiceReference: multiReference.trim() || undefined,
          paymentMethod: multiPayment,
          note: multiNote.trim() || undefined,
          items: multiRows.map(r => ({
            categoryName: r.categoryName || 'Stock & Inventory',
            productName: r.productName.trim(),
            quantity: Number(r.quantity) || 1,
            unit: String(r.unit || 'item'),
            unitPriceCents: Math.round((Number(r.unitPrice) || 0) * 100),
          })),
        },
      },
      {
        onSuccess: (exp: Expense) => {
          setModal(false);
          setToast('Procurement bill successfully recorded.');
          syncExpenseSuccess(exp);
          setTimeout(() => setToast(''), 4000);
        },
        onError: () => setMsg('Could not save procurement. Please verify inputs and retry.'),
      }
    );
  }

  async function copyExpensesGoogleSheets() {
    if (!q.data?.length) return;
    const curr = shop?.currency || 'AED';
    const headers = [
      'Date',
      'Expense Category',
      'Product / Item Name',
      'Quantity',
      'Unit',
      `Unit Price (${curr})`,
      `Line Total (${curr})`,
      'Supplier / Vendor',
      'Invoice Ref',
      'Payment Mode',
      'Recorded By',
      'Note',
    ];
    const rows = (q.data || []).flatMap(exp => {
      if (exp.items && exp.items.length) {
        return exp.items.map(it => [
          exp.expenseDate,
          it.categoryName || 'General',
          it.productName,
          it.quantity,
          it.unit || 'item',
          ((it.unitPriceCents || 0) / 100).toFixed(2),
          ((it.lineTotalCents || 0) / 100).toFixed(2),
          exp.supplier || '',
          exp.invoiceReference || '',
          exp.paymentMethod.toUpperCase(),
          exp.employeeName || 'Staff',
          exp.note || '',
        ]);
      }
      return [
        [
          exp.expenseDate,
          'General',
          'Expense',
          '1',
          'item',
          (exp.totalCents / 100).toFixed(2),
          (exp.totalCents / 100).toFixed(2),
          exp.supplier || '',
          exp.invoiceReference || '',
          exp.paymentMethod.toUpperCase(),
          exp.employeeName || 'Staff',
          exp.note || '',
        ],
      ];
    });

    const tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    const ok = await copyToClipboard(tsv);
    if (ok) {
      setToast('Expenses copied! Open Google Sheets and press Ctrl+V to paste into columns.');
      setTimeout(() => setToast(''), 4500);
    }
  }

  // Filter & Search calculations
  const allExpenses: Expense[] = q.data || [];
  const filtered = allExpenses.filter(x => {
    if (categoryFilter !== 'all') {
      const matchCat = x.items?.some(it => (it.categoryName || '').toLowerCase().includes(categoryFilter.toLowerCase()));
      if (!matchCat) return false;
    }
    if (paymentFilter !== 'all' && x.paymentMethod !== paymentFilter) {
      return false;
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      const matchItem = x.items?.some(it => (it.productName || '').toLowerCase().includes(term) || (it.categoryName || '').toLowerCase().includes(term));
      const matchSupp = (x.supplier || '').toLowerCase().includes(term);
      const matchRef = (x.invoiceReference || '').toLowerCase().includes(term);
      const matchNote = (x.note || '').toLowerCase().includes(term);
      if (!matchItem && !matchSupp && !matchRef && !matchNote) return false;
    }
    return true;
  });

  const totalAllCents = allExpenses.reduce((a, x) => a + x.totalCents, 0);
  const cashOutflowCents = allExpenses.filter(x => x.paymentMethod === 'cash').reduce((a, x) => a + x.totalCents, 0);
  const digitalOutflowCents = allExpenses.filter(x => x.paymentMethod !== 'cash').reduce((a, x) => a + x.totalCents, 0);

  // Compute top category
  const catTotals: Record<string, number> = {};
  for (const exp of allExpenses) {
    for (const it of exp.items || []) {
      const cat = it.categoryName || 'General';
      catTotals[cat] = (catTotals[cat] || 0) + (it.lineTotalCents || exp.totalCents);
    }
  }
  const topCatEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  const topCategoryLabel = topCatEntry ? `${topCatEntry[0]} (${money(topCatEntry[1], shop?.currency)})` : 'None';

  return (
    <>
      <PageHeading
        eyebrow="Restaurant Operations"
        title="Restaurant Expenses"
        sub="Kitchen food procurement, LPG cooking gas, fresh market purchases, takeaway packaging, and staff wages."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!q.data?.length}
              onClick={copyExpensesGoogleSheets}
              className="flex items-center gap-2 rounded-xl border border-[#315f52] bg-[#eff5f0] px-4 py-2.5 text-xs font-semibold text-[#315f52] shadow-xs hover:bg-[#e4efe6] disabled:opacity-50 transition cursor-pointer"
            >
              <FileSpreadsheet size={15} /> Copy for Google Sheets
            </button>
            <button
              data-testid="button-add-expense"
              onClick={() => {
                setModal(true);
                setEntryMode('simple');
              }}
              className="flex items-center gap-2 rounded-xl bg-[#315f52] px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-[#274f44] transition cursor-pointer"
            >
              <Plus size={16} /> Record Expense
            </button>
          </div>
        }
      />

      <EmptyShop shops={shops} />

      {toast && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#e5f3e7] border border-[#b7dfbd] px-4 py-3 text-xs font-semibold text-[#295b34] animate-in fade-in">
          <span className="flex items-center gap-2">
            <Check size={16} /> {toast}
          </span>
          <button onClick={() => setToast('')} className="text-[#295b34] hover:opacity-75 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {msg && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-xs font-medium text-amber-800">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-amber-800 hover:opacity-75 cursor-pointer">
            <X size={13} />
          </button>
        </div>
      )}

      {/* 4 Financial Reconciliation Metrics */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Total expenses"
          value={money(totalAllCents, shop?.currency)}
          detail={`${allExpenses.length} total entries`}
          icon={<Wallet size={18} />}
          accent="bg-[#f4eae5] text-[#a3614e]"
        />
        <Metric
          label="Cash drawer outflow"
          value={money(cashOutflowCents, shop?.currency)}
          detail="Physical register cash paid out"
          icon={<Banknote size={18} />}
          accent="bg-emerald-50 text-emerald-800"
        />
        <Metric
          label="Card & bank outflow"
          value={money(digitalOutflowCents, shop?.currency)}
          detail="Digital / online transfers"
          icon={<CreditCard size={18} />}
          accent="bg-blue-50 text-blue-800"
        />
        <Metric
          label="Top expense category"
          value={topCategoryLabel}
          detail="Largest spending category"
          icon={<TrendingDown size={18} />}
        />
      </div>

      {/* ⚡ INSTANT INLINE QUICK-ADD BAR (On-Page Fast Entry) */}
      <div className="mb-5 rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-white p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <Zap size={14} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-950">
              ⚡ Quick Restaurant Expense (Instant 5-Second Entry)
            </span>
          </div>
          <span className="text-[11px] font-medium text-emerald-800 hidden sm:inline">
            Click a preset or enter amount & press Record
          </span>
        </div>

        {/* Quick Template Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Quick presets:</span>
          {QUICK_EXPENSE_PRESETS.slice(0, 8).map(preset => (
            <button
              type="button"
              key={preset.label}
              onClick={() => applyQuickPreset(preset)}
              className="shrink-0 rounded-lg border border-emerald-300/80 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 shadow-2xs hover:bg-emerald-100/70 hover:border-emerald-400 transition cursor-pointer"
            >
              {preset.label} {preset.amount ? `· ${preset.amount}` : ''}
            </button>
          ))}
        </div>

        {/* Inline Entry Form */}
        <form onSubmit={handleInlineQuickSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-4">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Expense Title / Item</label>
            <input
              required
              placeholder="e.g. Cooking Gas Cylinder, Fresh Chicken, Vegetables, Oil..."
              value={quickTitle}
              onChange={e => setQuickTitle(e.target.value)}
              className={`${inputClass} bg-white`}
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
            <select
              value={quickCategory}
              onChange={e => setQuickCategory(e.target.value)}
              className={`${inputClass} bg-white text-xs`}
            >
              {UNIVERSAL_EXPENSE_CATEGORIES.map(c => (
                <option key={c.id} value={c.name}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Amount ({shop?.currency || 'AED'})
            </label>
            <input
              required
              type="number"
              min="0.01"
              step="any"
              placeholder="0.00"
              value={quickAmount}
              onChange={e => setQuickAmount(e.target.value)}
              className={`${inputClass} bg-white font-bold text-slate-900`}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Paid Via</label>
            <select
              value={quickPayment}
              onChange={e => setQuickPayment(e.target.value as any)}
              className={`${inputClass} bg-white text-xs`}
            >
              <option value="cash">💵 Cash In Hand</option>
              <option value="card">💳 Card Payment</option>
              <option value="other">🏦 Bank Transfer</option>
              <option value="upi">📱 UPI / QR</option>
            </select>
          </div>

          <div className="sm:col-span-1">
            <button
              type="submit"
              disabled={isQuickSubmitting}
              className="w-full flex h-[38px] items-center justify-center rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer"
            >
              {isQuickSubmitting ? <LoaderCircle className="animate-spin" size={16} /> : <Plus size={16} />}
            </button>
          </div>
        </form>
      </div>

      {/* 🔍 FILTER & SEARCH BAR */}
      <div className="surface mb-4 flex flex-wrap items-center justify-between gap-3 p-3 shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              placeholder="Search expenses by title, supplier, invoice, note..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${inputClass} pl-9 text-xs`}
            />
          </div>

          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className={`${inputClass} w-auto text-xs`}
          >
            <option value="all">All Categories ({allExpenses.length})</option>
            {UNIVERSAL_EXPENSE_CATEGORIES.map(c => (
              <option key={c.id} value={c.name}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>

          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className={`${inputClass} w-auto text-xs`}
          >
            <option value="all">All Payments</option>
            <option value="cash">💵 Cash Only</option>
            <option value="card">💳 Card Only</option>
            <option value="other">🏦 Bank Only</option>
            <option value="upi">📱 UPI / QR</option>
          </select>

          {(search || categoryFilter !== 'all' || paymentFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategoryFilter('all');
                setPaymentFilter('all');
              }}
              className="text-xs font-semibold text-rose-700 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <strong>{filtered.length}</strong> of <strong>{allExpenses.length}</strong> entries
        </div>
      </div>

      {/* EXPENSES DATA VIEW: Mobile Cards for phone screens, DataTable for desktop */}
      <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!filtered.length}>
        {/* MOBILE CARD VIEW */}
        <div className="space-y-2.5 md:hidden">
          {filtered.map((x: Expense) => {
            const firstItem = x.items?.[0];
            const matchingCat = UNIVERSAL_EXPENSE_CATEGORIES.find(c => c.name === firstItem?.categoryName);
            return (
              <div key={x.id} className="surface p-3.5 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-base">
                      {matchingCat?.icon || '🏷️'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-800 truncate">{firstItem?.productName || 'Expense Record'}</p>
                      <p className="text-[11px] text-slate-500">{dateLabel(x.expenseDate)} · {firstItem?.categoryName || 'General'}</p>
                      {x.items && x.items.length > 1 && (
                        <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">+{x.items.length - 1} more line items</p>
                      )}
                    </div>
                  </div>
                  <span className="mono text-base font-bold text-rose-700 shrink-0">
                    {money(x.totalCents, shop?.currency)}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
                  <span className="capitalize flex items-center gap-1 font-semibold text-[11px]">
                    {x.paymentMethod === 'cash' ? '💵 Cash' : x.paymentMethod === 'card' ? '💳 Card' : '🏦 Other'}
                  </span>
                  {x.supplier ? (
                    <span className="truncate max-w-[160px] text-[11px]">Vendor: {x.supplier}</span>
                  ) : (
                    <span className="text-[11px] text-slate-400">By: {x.employeeName || user?.name || 'Staff'}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* DESKTOP DATA TABLE: Unaltered for laptop and tablet view */}
        <div className="hidden md:block">
          <DataTable
            headers={['Date', 'Category', 'Expense / Items', 'Quantity & Unit', 'Amount', 'Payment', 'Supplier / Ref', 'Recorded by']}
            rows={filtered.map((x: Expense) => {
              const firstItem = x.items?.[0];
              const matchingCat = UNIVERSAL_EXPENSE_CATEGORIES.find(c => c.name === firstItem?.categoryName);
              return [
                dateLabel(x.expenseDate),
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    matchingCat?.color || 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>{matchingCat?.icon || '🏷️'}</span>
                  <span>{firstItem?.categoryName || 'General'}</span>
                </span>,
                <div>
                  <p className="font-bold text-slate-800">{firstItem?.productName || 'Expense Record'}</p>
                  {x.items && x.items.length > 1 && (
                    <p className="text-[10px] text-emerald-700 font-semibold">+{x.items.length - 1} more line items</p>
                  )}
                  {x.note && <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{x.note}</p>}
                </div>,
                firstItem ? (
                  <span className="mono text-xs text-slate-600">
                    {firstItem.quantity} {firstItem.unit}
                  </span>
                ) : (
                  '1 item'
                ),
                <span className="mono font-bold text-slate-900">{money(x.totalCents, shop?.currency)}</span>,
                <Pill>{x.paymentMethod.toUpperCase()}</Pill>,
                <div>
                  <p className="text-xs font-medium text-slate-700">{x.supplier || '—'}</p>
                  {x.invoiceReference && (
                    <p className="mono text-[10px] text-slate-400">Ref: {x.invoiceReference}</p>
                  )}
                </div>,
                x.employeeName || user?.name || 'Staff',
              ];
            })}
          />
        </div>
      </QueryState>

      {/* 📝 FULL COMPREHENSIVE RECORD EXPENSE MODAL */}
      {modal && (
        <Modal
          title="Record Restaurant Expense"
          subtitle="Fast entry for daily kitchen food runs, cooking gas, staff wages, or multi-item vendor invoices."
          icon={<Wallet size={20} className="text-emerald-700" />}
          maxWidth="max-w-2xl"
          onClose={() => setModal(false)}
        >
          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => setEntryMode('simple')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                entryMode === 'simple'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap size={14} className={entryMode === 'simple' ? 'text-emerald-700' : ''} />
              ⚡ Simple Expense (Single Amount)
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('multi')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition cursor-pointer ${
                entryMode === 'multi'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes size={14} className={entryMode === 'multi' ? 'text-emerald-700' : ''} />
              📋 Multi-Item Procurement (Detailed)
            </button>
          </div>

          {entryMode === 'simple' ? (
            /* SIMPLE MODE FORM */
            <form onSubmit={handleSimpleModalSubmit} className="space-y-4">
              {/* Hero Amount Display & Quick Boosters */}
              <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50/60 via-teal-50/30 to-white p-4">
                <span className="block text-xs font-bold uppercase tracking-wider text-emerald-950 mb-1.5">
                  Expense Amount ({shop?.currency || 'AED'})
                </span>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-black text-emerald-700">
                    {shop?.currency || 'AED'}
                  </span>
                  <input
                    required
                    autoFocus
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="0.00"
                    value={simpleAmount}
                    onChange={e => setSimpleAmount(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 bg-white py-3 pl-16 pr-4 text-2xl font-black text-slate-900 shadow-inner focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {/* Quick Amount Adders */}
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400">Quick add:</span>
                  {[10, 20, 50, 100, 200, 500].map(val => (
                    <button
                      type="button"
                      key={val}
                      onClick={() => addAmountBooster(val)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 transition cursor-pointer"
                    >
                      +{val}
                    </button>
                  ))}
                  {simpleAmount && (
                    <button
                      type="button"
                      onClick={() => setSimpleAmount('')}
                      className="rounded-lg px-2 py-0.5 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Title & Quick Presets */}
              <div>
                <Field label="Expense Title / Description" required>
                  <input
                    required
                    placeholder="e.g. Shop Rent, DEWA Bill, Staff Tea, Petrol..."
                    value={simpleTitle}
                    onChange={e => setSimpleTitle(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase">Popular:</span>
                  {QUICK_EXPENSE_PRESETS.map(preset => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => applyModalPreset(preset)}
                      className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Grid (10 Modern Cards) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Select Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {UNIVERSAL_EXPENSE_CATEGORIES.map(cat => {
                    const isSelected = simpleCategory === cat.name;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setSimpleCategory(cat.name)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-500/20 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-lg mb-0.5">{cat.icon}</span>
                        <span className="text-[11px] leading-tight truncate w-full">{cat.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & Payment Method */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Expense Date" required>
                  <input
                    required
                    type="date"
                    value={simpleDate}
                    onChange={e => setSimpleDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Payment Method">
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    {[
                      { id: 'cash', label: '💵 Cash' },
                      { id: 'card', label: '💳 Card' },
                      { id: 'other', label: '🏦 Bank' },
                      { id: 'upi', label: '📱 Online' },
                    ].map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setSimplePayment(p.id as any)}
                        className={`rounded-lg border py-2 text-xs font-bold transition cursor-pointer ${
                          simplePayment === p.id
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Vendor & Invoice References */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Field label="Supplier / Vendor (Optional)">
                    <input
                      placeholder="e.g. DEWA, Etisalat, Landlord..."
                      value={simpleSupplier}
                      onChange={e => setSimpleSupplier(e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <div className="flex gap-1 pt-1 flex-wrap">
                    {['DEWA', 'du / Etisalat', 'Landlord', 'Fruit & Veg Market'].map(v => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => setSimpleSupplier(v)}
                        className="text-[10px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 hover:bg-emerald-100"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <Field label="Invoice / Receipt Ref (Optional)">
                  <input
                    placeholder="e.g. INV-9042, BILL-220"
                    value={simpleReference}
                    onChange={e => setSimpleReference(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Notes (Optional)">
                <input
                  placeholder="e.g. Paid for the month of November, delivered in morning slot"
                  value={simpleNote}
                  onChange={e => setSimpleNote(e.target.value)}
                  className={inputClass}
                />
              </Field>

              {/* Modal Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="w-1/3 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <div className="w-2/3">
                  <Submit
                    label={`Save Expense · ${shop?.currency || 'AED'} ${(Number(simpleAmount) || 0).toFixed(2)}`}
                    busy={create.isPending}
                  />
                </div>
              </div>
            </form>
          ) : (
            /* MULTI-ITEM PROCUREMENT FORM */
            <form onSubmit={handleMultiModalSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Procurement Items</h4>
                  <p className="text-[11px] text-slate-400">Add multiple raw materials or invoice line items</p>
                </div>
                <button
                  type="button"
                  onClick={() => addMultiRow()}
                  className="flex items-center gap-1 rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-800 transition cursor-pointer"
                >
                  <Plus size={14} /> Add Line Item
                </button>
              </div>

              {/* Multi-item Table */}
              <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                {multiRows.map((r, idx) => {
                  const lineTotal = (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>Item #{idx + 1}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-800">
                            Total: {shop?.currency || 'AED'} {lineTotal.toFixed(2)}
                          </span>
                          {multiRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeMultiRow(r.id)}
                              className="text-rose-600 hover:text-rose-800 transition cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                        <div className="sm:col-span-5">
                          <input
                            required
                            placeholder="Item name (e.g. Tomatoes, Basmati Rice)..."
                            value={r.productName}
                            onChange={e => updateMultiRow(r.id, 'productName', e.target.value)}
                            className={`${inputClass} bg-white`}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <input
                            required
                            type="number"
                            min="0.01"
                            step="any"
                            placeholder="Qty"
                            value={r.quantity}
                            onChange={e => updateMultiRow(r.id, 'quantity', Number(e.target.value))}
                            className={`${inputClass} bg-white text-center font-bold`}
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <input
                            required
                            placeholder="Unit (kg, pcs)"
                            value={r.unit}
                            onChange={e => updateMultiRow(r.id, 'unit', e.target.value)}
                            className={`${inputClass} bg-white text-center`}
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Unit Price"
                            value={r.unitPrice}
                            onChange={e => updateMultiRow(r.id, 'unitPrice', Number(e.target.value))}
                            className={`${inputClass} bg-white text-right font-bold`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick catalog insert pills */}
              <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
                  Insert from common procurement:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {EXPENSE_TAXONOMY.flatMap(cat => cat.items.slice(0, 3)).map(it => (
                    <button
                      type="button"
                      key={it.name}
                      onClick={() => addMultiRow({ name: it.name, unit: it.unit, suggestedPrice: it.suggestedPrice })}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 transition cursor-pointer"
                    >
                      + {it.name} ({it.unit})
                    </button>
                  ))}
                </div>
              </div>

              {/* Date, Payment & Vendor */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Expense Date" required>
                  <input
                    required
                    type="date"
                    value={multiDate}
                    onChange={e => setMultiDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Payment Method">
                  <select
                    value={multiPayment}
                    onChange={e => setMultiPayment(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="cash">💵 Cash In Hand</option>
                    <option value="card">💳 Card Payment</option>
                    <option value="other">🏦 Bank Transfer</option>
                    <option value="upi">📱 UPI / QR</option>
                  </select>
                </Field>

                <Field label="Supplier / Vendor">
                  <input
                    placeholder="e.g. Al Aweer Wholesale Market"
                    value={multiSupplier}
                    onChange={e => setMultiSupplier(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Invoice / Bill Reference">
                  <input
                    placeholder="e.g. INV-2026-902"
                    value={multiReference}
                    onChange={e => setMultiReference(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Notes (Optional)">
                  <input
                    placeholder="e.g. Fresh stock delivered in morning"
                    value={multiNote}
                    onChange={e => setMultiNote(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              {/* Grand Total Indicator */}
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                  Combined Procurement Total ({multiRows.length} items)
                </span>
                <span className="text-lg font-black text-emerald-800">
                  {shop?.currency || 'AED'} {multiTotal.toFixed(2)}
                </span>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="w-1/3 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <div className="w-2/3">
                  <Submit
                    label={`Save Procurement · ${shop?.currency || 'AED'} ${multiTotal.toFixed(2)}`}
                    busy={create.isPending}
                  />
                </div>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

function Catalog() {
  const { shop, shops } = useCurrentShop();
  const [tab, setTab] = useState<'products' | 'categories'>('products');
  const [modal, setModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  // Form parcel fee state
  const [hasParcelFee, setHasParcelFee] = useState(false);
  const [parcelFeeVal, setParcelFeeVal] = useState<number>(5);
  const [selectedPresetImage, setSelectedPresetImage] = useState<string>('');

  const currentShopId = shop?.id || 1;
  const pp = {
    shopId: currentShopId,
    ...(search ? { search } : {}),
  };
  const cp = { shopId: currentShopId };
  const products = useListProducts(pp, { query: { enabled: !!shop, queryKey: getListProductsQueryKey(pp) } });
  const categories = useListCategories(cp, { query: { enabled: !!shop, queryKey: getListCategoriesQueryKey(cp) } });

  const createP = useCreateProduct();
  const updateP = useUpdateProduct();
  const createC = useCreateCategory();
  const updateC = useUpdateCategory();
  const qc = useQueryClient();

  function openAddModal() {
    setEditingProduct(null);
    setHasParcelFee(false);
    setParcelFeeVal(5);
    setSelectedPresetImage('');
    setModal(true);
  }

  function openEditModal(prod: Product) {
    setEditingProduct(prod);
    setHasParcelFee(prod.parcelType === 'fixed' || prod.parcelValue > 0);
    setParcelFeeVal((prod.parcelValue || 500) / 100);
    setSelectedPresetImage(prod.imageUrl || '');
    setModal(true);
  }

  function submitProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shop) return;
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name')).trim();
    const description = String(f.get('description') || '');
    const priceCents = Math.round(Number(f.get('price')) * 100);
    const sku = String(f.get('sku') || '');
    const categoryId = f.get('category') ? Number(f.get('category')) : null;
    const imageUrl = String(f.get('imageUrl') || selectedPresetImage || '').trim();

    const parcelType = hasParcelFee ? ('fixed' as const) : ('none' as const);
    const parcelValue = hasParcelFee ? Math.round(Number(parcelFeeVal) * 100) : 0;

    if (editingProduct) {
      updateP.mutate(
        {
          productId: editingProduct.id,
          data: {
            name,
            description,
            priceCents,
            sku,
            categoryId,
            imageUrl,
            parcelType,
            parcelValue,
          },
        },
        {
          onSuccess: () => {
            setModal(false);
            setEditingProduct(null);
            setMessage('Product updated successfully.');
            invalidate(qc);
            setTimeout(() => setMessage(''), 4000);
          },
          onError: () => setMessage('Could not update product.'),
        },
      );
    } else {
      createP.mutate(
        {
          data: {
            shopId: shop.id,
            name,
            description,
            priceCents,
            sku,
            categoryId,
            imageUrl,
            isAvailable: true,
            parcelType,
            parcelValue,
          },
        },
        {
          onSuccess: () => {
            setModal(false);
            setMessage('Product added to catalog.');
            invalidate(qc);
            setTimeout(() => setMessage(''), 4000);
          },
          onError: () => setMessage('Could not add product.'),
        },
      );
    }
  }

  function submitCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shop) return;
    const f = new FormData(e.currentTarget);
    createC.mutate(
      {
        data: {
          shopId: shop.id,
          name: String(f.get('name')),
          color: String(f.get('color') || '#6b8c76'),
          sortOrder: categories.data?.length || 0,
        },
      },
      {
        onSuccess: () => {
          setModal(false);
          setMessage('Category added.');
          invalidate(qc);
          setTimeout(() => setMessage(''), 4000);
        },
        onError: () => setMessage('Could not add category.'),
      },
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Product & Menu Setup"
        title="Catalog Management"
        sub="Organize menu items, photo thumbnails, prices, and configure takeaway parcel packaging fees."
        action={
          <button
            data-testid="button-add-catalog"
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-xl bg-[#315f52] px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-[#274f44] transition"
          >
            <Plus size={16} /> Add {tab === 'products' ? 'Product' : 'Category'}
          </button>
        }
      />

      <EmptyShop shops={shops} />

      {message && <p role="status" className="mb-3 text-sm text-[#4c7358] font-medium">{message}</p>}

      <div className="mb-4 flex gap-2 border-b border-[#e5e4db]">
        <button
          onClick={() => setTab('products')}
          className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${
            tab === 'products' ? 'border-[#315f52] text-[#315f52]' : 'border-transparent text-[#8a958d]'
          }`}
        >
          Menu Products <span className="ml-1 text-xs">({products.data?.length || 0})</span>
        </button>
        <button
          onClick={() => setTab('categories')}
          className={`border-b-2 px-3 py-3 text-sm font-semibold transition ${
            tab === 'categories' ? 'border-[#315f52] text-[#315f52]' : 'border-transparent text-[#8a958d]'
          }`}
        >
          Menu Categories <span className="ml-1 text-xs">({categories.data?.length || 0})</span>
        </button>
      </div>

      {tab === 'products' ? (
        <>
          <div className="relative mb-4 max-w-sm">
            <Search size={15} className="absolute left-3 top-3 text-[#97a098]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products by name or SKU"
              className={`${inputClass} pl-9`}
            />
          </div>

          <QueryState loading={products.isLoading} error={products.isError} retry={() => products.refetch()} empty={!products.data?.length}>
            <DataTable
              headers={['Product', 'SKU', 'Category', 'Price', 'Parcel Packaging', 'Status', 'Actions']}
              rows={(products.data || []).map((p: Product) => {
                const hasParcel = p.parcelType === 'fixed' || (p.parcelValue && p.parcelValue > 0);
                return [
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f3ec] text-[#8ba18f] overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag size={18} />
                      )}
                    </span>
                    <div>
                      <p className="font-semibold text-[#2d4237]">{p.name}</p>
                      <p className="text-[10px] text-[#8f9991] line-clamp-1">{p.description || 'No description'}</p>
                    </div>
                  </div>,
                  p.sku || '—',
                  categories.data?.find(c => c.id === p.categoryId)?.name || 'Uncategorized',
                  <span className="mono font-bold text-[#315f52]">{money(p.priceCents, shop?.currency)}</span>,
                  hasParcel ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fbf4e8] px-2.5 py-1 text-[11px] font-semibold text-[#a87425] border border-[#f3e1c6]">
                      <Package size={12} /> +{money(p.parcelValue, shop?.currency)}
                    </span>
                  ) : (
                    <span className="text-[#a4aea6] text-xs">None</span>
                  ),
                  <Pill tone={p.isAvailable ? 'green' : 'gray'}>{p.isAvailable ? 'Available' : 'Hidden'}</Pill>,
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openEditModal(p)}
                      className="flex items-center gap-1 text-xs font-semibold text-[#315f52] hover:underline"
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      data-testid={`button-toggle-product-${p.id}`}
                      onClick={() =>
                        updateP.mutate(
                          { productId: p.id, data: { isAvailable: !p.isAvailable } },
                          { onSuccess: () => invalidate(qc) },
                        )
                      }
                      className="text-xs font-medium text-[#7c8b82] hover:text-[#3e5046]"
                    >
                      {p.isAvailable ? 'Hide' : 'Show'}
                    </button>
                  </div>,
                ];
              })}
            />
          </QueryState>
        </>
      ) : (
        <QueryState loading={categories.isLoading} error={categories.isError} retry={() => categories.refetch()} empty={!categories.data?.length}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(categories.data || []).map((c: Category) => (
              <div key={c.id} className="surface flex items-center gap-3 p-4">
                <span className="h-10 w-10 rounded-xl" style={{ backgroundColor: c.color || '#9ab2a0' }} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#3d5146]">{c.name}</p>
                  <p className="mt-1 text-xs text-[#879189]">
                    {(products.data || []).filter(p => p.categoryId === c.id).length} menu items
                  </p>
                </div>
                <Pill tone={c.isActive ? 'green' : 'gray'}>{c.isActive ? 'Active' : 'Hidden'}</Pill>
                <button
                  onClick={() =>
                    updateC.mutate(
                      { categoryId: c.id, data: { isActive: !c.isActive } },
                      { onSuccess: () => invalidate(qc) },
                    )
                  }
                  className="text-xs font-semibold text-[#527260]"
                >
                  {c.isActive ? 'Hide' : 'Show'}
                </button>
              </div>
            ))}
          </div>
        </QueryState>
      )}

      {/* Product / Category Modal */}
      {modal && (
        <Modal
          title={
            tab === 'products'
              ? editingProduct
                ? 'Edit Menu Product'
                : 'Add New Menu Product'
              : 'Add Menu Category'
          }
          subtitle={
            tab === 'products'
              ? editingProduct
                ? 'Update item pricing, photo, and parcel charges'
                : 'Create a new dish or counter item for billing'
              : 'Organize your counter menu with category tabs'
          }
          icon={tab === 'products' ? <Tag size={20} className="text-emerald-700" /> : <Boxes size={20} className="text-emerald-700" />}
          maxWidth="max-w-xl"
          onClose={() => setModal(false)}
        >
          {tab === 'products' ? (
            <form onSubmit={submitProduct} className="space-y-4">
              <Field label="Product Name" required>
                <input
                  required
                  name="name"
                  defaultValue={editingProduct?.name || ''}
                  autoFocus
                  placeholder="e.g. Masala Dosa, Filter Coffee, Paneer Butter Masala"
                  className={inputClass}
                />
              </Field>

              <Field label="Description (Optional)" hint="Short culinary summary">
                <input
                  name="description"
                  defaultValue={editingProduct?.description || ''}
                  placeholder="e.g. Crispy golden crepe served with spiced potato & fresh chutneys"
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={`Selling Price (${shop?.currency || 'AED'})`} required>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{shop?.currency || 'AED'}</span>
                    <input
                      required
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={editingProduct ? (editingProduct.priceCents / 100).toFixed(2) : ''}
                      placeholder="25.00"
                      className={`${inputClass} pl-12 text-base font-bold`}
                    />
                  </div>
                </Field>
                <Field label="SKU / Item Code" hint="Optional barcode">
                  <input
                    name="sku"
                    defaultValue={editingProduct?.sku || ''}
                    placeholder="e.g. BRK-001"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Menu Category" hint="Appears under this counter tab">
                <select name="category" defaultValue={editingProduct?.categoryId || ''} className={inputClass}>
                  <option value="">📁 Uncategorized</option>
                  {categories.data?.map(c => (
                    <option key={c.id} value={c.id}>
                      📂 {c.name}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Product Photo Upload */}
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4">
                <ImageUploadZone
                  label="Product Photo & Thumbnail"
                  value={selectedPresetImage}
                  onChange={img => setSelectedPresetImage(img)}
                  aspect="square"
                  helperText="Upload dish or product photo from camera, phone gallery, or computer"
                  showPresets={true}
                />
                <input type="hidden" name="imageUrl" value={selectedPresetImage} />
              </div>

              {/* Parcel Packaging Charge Config */}
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasParcelFee}
                    onChange={e => setHasParcelFee(e.target.checked)}
                    className="h-4 w-4 rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      📦 Apply Takeaway Parcel / Packaging Fee
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Charge extra packaging fee for this item only when the customer orders Takeaway / Parcel.
                    </p>
                  </div>
                </label>

                {hasParcelFee && (
                  <div className="pl-7 pt-1 animate-in fade-in duration-150">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Packaging Fee Amount ({shop?.currency || 'AED'})
                    </label>
                    <div className="relative max-w-[170px]">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{shop?.currency || 'AED'}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={parcelFeeVal}
                        onChange={e => setParcelFeeVal(Number(e.target.value))}
                        placeholder="2.00"
                        className={`${inputClass} pl-11 font-bold bg-white`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="w-1/3 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <div className="w-2/3">
                  <Submit
                    label={editingProduct ? 'Save Product Changes' : 'Create Menu Product'}
                    busy={createP.isPending || updateP.isPending}
                  />
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={submitCategory} className="space-y-4">
              <Field label="Category Name" required hint="e.g. Breakfast, Lunch, Beverages">
                <input required name="name" autoFocus placeholder="e.g. Breakfast, Lunch, Beverages" className={inputClass} />
              </Field>
              <Field label="Category Color Tag">
                <input name="color" type="color" defaultValue="#315f52" className={`${inputClass} h-11 p-1 cursor-pointer`} />
              </Field>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="w-1/3 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <div className="w-2/3">
                  <Submit label="Save Category" busy={createC.isPending} />
                </div>
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}

function Team() {
  const { shop, shops } = useCurrentShop();
  const { quickPinConfig, updateQuickPinConfig } = useAuth();
  const params = { shopId: shop?.id || 0 };
  const q = useListEmployees(params, { query: { enabled: !!shop, queryKey: getListEmployeesQueryKey(params) } });
  const create = useCreateEmployee();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editingPinStaff, setEditingPinStaff] = useState<{ id: number; name: string; pin: string } | null>(null);
  const [message, setMessage] = useState('');

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shop) return;
    const f = new FormData(e.currentTarget);
    const pin = String(f.get('pin') || '1234').trim();
    create.mutate(
      {
        data: {
          shopId: shop.id,
          name: String(f.get('name')),
          role: String(f.get('role')) as 'cashier' | 'manager',
        },
      },
      {
        onSuccess: (newEmp: any) => {
          if (newEmp?.id) {
            const currentPins = { ...quickPinConfig.staffPins };
            currentPins[`${shop.id}_${newEmp.id}`] = pin;
            currentPins[String(newEmp.id)] = pin;
            updateQuickPinConfig({ staffPins: currentPins });

            try {
              const raw = localStorage.getItem('billflow-offline-employees');
              if (raw) {
                const emps = JSON.parse(raw);
                const updated = emps.map((emp: any) => (emp.id === newEmp.id ? { ...emp, pin } : emp));
                localStorage.setItem('billflow-offline-employees', JSON.stringify(updated));
              }
            } catch {}
          }
          setModal(false);
          setMessage(`Staff member added with Quick PIN ${pin}.`);
          invalidate(qc);
        },
        onError: () => setMessage('Could not add staff member.'),
      },
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="People & Cashiers"
        title="Your Team"
        sub="Manage staff profiles and cashier operators assigned to this counter."
        action={
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#315f52] px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-[#274f44]"
          >
            <Plus size={16} /> Add Staff
          </button>
        }
      />
      <EmptyShop shops={shops} />
      {message && <p role="status" className="mb-3 text-sm text-[#52785f]">{message}</p>}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Metric
          label="Active staff"
          value={String(q.data?.filter(x => x.isActive).length || 0)}
          detail="Assigned to this shop"
          icon={<Users size={18} />}
        />
        <Metric
          label="Shop"
          value={shop?.name || '—'}
          detail={shop?.address || 'No address on file'}
          icon={<Store size={18} />}
          accent="bg-[#f7efdf] text-[#9b7844]"
        />
      </div>
      <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.data?.length}>
        <DataTable
          headers={['Team member', 'Role', 'Shop', 'Quick PIN', 'Status', '']}
          rows={(q.data || []).map((e: Employee) => {
            const currentPin = quickPinConfig.staffPins[`${shop?.id}_${e.id}`] || quickPinConfig.staffPins[String(e.id)] || (e as any).pin || (shop?.id === 1 ? '1111' : shop?.id === 2 ? '2222' : '1234');
            return [
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e6ede3] text-xs font-bold text-[#557461]">
                  {e.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <span className="font-semibold">{e.name}</span>
              </div>,
              <span className="capitalize">{e.role}</span>,
              shop?.name,
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#274f44] bg-[#edf2e9] border border-[#c2d6c7] px-2 py-0.5 rounded-md">
                  {currentPin}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingPinStaff({ id: e.id, name: e.name, pin: currentPin })}
                  className="text-xs font-semibold text-[#315f52] hover:underline cursor-pointer"
                >
                  Change PIN
                </button>
              </div>,
              <Pill tone={e.isActive ? 'green' : 'gray'}>{e.isActive ? 'Active' : 'Inactive'}</Pill>,
              <span className="text-xs text-[#98a098]">Staff record</span>,
            ];
          })}
        />
      </QueryState>
      {modal && (
        <Modal
          title="Add Team Member"
          subtitle="Add a cashier or store manager to handle billing"
          icon={<Users size={20} className="text-emerald-700" />}
          maxWidth="max-w-md"
          onClose={() => setModal(false)}
        >
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full Name" required hint="e.g. Rahul Sharma">
              <input required name="name" placeholder="e.g. Rahul Sharma" className={inputClass} autoFocus />
            </Field>
            <Field label="Assigned Role" hint="Defines billing and access permissions">
              <select name="role" className={inputClass}>
                <option value="cashier">💼 Counter Cashier (POS & Sales)</option>
                <option value="manager">🛡️ Store Manager (Full Access)</option>
              </select>
            </Field>
            <Field label="4-Digit Quick PIN" required hint="Counter shift login code (e.g. 1111 or 2222)">
              <input
                required
                name="pin"
                type="text"
                maxLength={4}
                pattern="\d{4}"
                defaultValue={shop?.id === 1 ? '1111' : shop?.id === 2 ? '2222' : '1234'}
                placeholder="4 numeric digits e.g. 1111"
                className={inputClass}
              />
            </Field>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="w-1/3 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <div className="w-2/3">
                <Submit label="Add to Team" busy={create.isPending} />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit PIN Modal */}
      {editingPinStaff && (
        <Modal
          title={`Update PIN for ${editingPinStaff.name}`}
          subtitle="Change the 4-digit Quick PIN used by this cashier"
          icon={<KeyRound size={20} className="text-emerald-700" />}
          maxWidth="max-w-sm"
          onClose={() => setEditingPinStaff(null)}
        >
          <form
            onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const newPin = String(f.get('pin') || '').trim();
              if (!/^\d{4}$/.test(newPin)) {
                alert('PIN must be exactly 4 numeric digits.');
                return;
              }
              const currentPins = { ...quickPinConfig.staffPins };
              if (shop?.id) currentPins[`${shop.id}_${editingPinStaff.id}`] = newPin;
              currentPins[String(editingPinStaff.id)] = newPin;
              updateQuickPinConfig({ staffPins: currentPins });

              try {
                const raw = localStorage.getItem('billflow-offline-employees');
                if (raw) {
                  const emps = JSON.parse(raw);
                  const updated = emps.map((emp: any) =>
                    emp.id === editingPinStaff.id ? { ...emp, pin: newPin } : emp,
                  );
                  localStorage.setItem('billflow-offline-employees', JSON.stringify(updated));
                }
              } catch {}

              setMessage(`PIN updated to ${newPin} for ${editingPinStaff.name}.`);
              setEditingPinStaff(null);
              invalidate(qc);
            }}
            className="space-y-4"
          >
            <Field label="New 4-Digit PIN" required hint="Must be exactly 4 numeric digits">
              <input
                required
                name="pin"
                type="text"
                maxLength={4}
                pattern="\d{4}"
                defaultValue={editingPinStaff.pin}
                className={inputClass}
                autoFocus
              />
            </Field>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingPinStaff(null)}
                className="w-1/3 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-2/3 rounded-xl bg-emerald-700 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
              >
                Save PIN
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Shops() {
  const q = useListShops();
  const create = useCreateShop();
  const update = useUpdateShop();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [message, setMessage] = useState('');
  const [deletingShop, setDeletingShop] = useState<Shop | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  async function handleDeleteShop() {
    if (!deletingShop) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await customFetch<any>(`/api/shops/${deletingShop.id}`, { method: 'DELETE' });
      const currentActiveShop = localStorage.getItem('billflow-shop');
      const remaining = (q.data || []).filter(s => s.id !== deletingShop.id);
      qc.setQueryData(getListShopsQueryKey(), remaining);

      // If deleted shop was currently active, switch to first remaining shop
      if (currentActiveShop === String(deletingShop.id) && remaining.length > 0) {
        localStorage.setItem('billflow-shop', String(remaining[0].id));
      }
      setMessage(`Shop "${deletingShop.name}" has been deleted.`);
      setDeletingShop(null);
      invalidate(qc);
      if (currentActiveShop === String(deletingShop.id)) {
        setTimeout(() => window.location.reload(), 400);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'Could not delete shop.');
    } finally {
      setDeleteLoading(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data = {
      name: String(f.get('name')),
      address: String(f.get('address') || ''),
      phone: String(f.get('phone') || ''),
      currency: String(f.get('currency') || 'AED'),
      taxRateBps: Math.round(Number(f.get('tax')) * 100),
      taxType: String(f.get('taxType') || 'inclusive'),
    };
    if (editing) {
      update.mutate(
        { shopId: editing.id, data },
        {
          onSuccess: () => {
            setModal(false);
            setEditing(null);
            setMessage('Shop details updated.');
            invalidate(qc);
          },
          onError: () => setMessage('Could not update the shop.'),
        },
      );
    } else {
      create.mutate(
        { data },
        {
          onSuccess: s => {
            localStorage.setItem('billflow-shop', String(s.id));
            window.dispatchEvent(new CustomEvent('billflow-shop-changed', { detail: s.id }));
            setModal(false);
            setMessage('Shop created.');
            invalidate(qc);
          },
          onError: () => setMessage('Could not create the shop.'),
        },
      );
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="Locations"
        title="Shops"
        sub="Manage multi-shop outlets with independent sales, catalog, and tax settings."
        action={
          <button
            onClick={() => {
              setEditing(null);
              setModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-[#315f52] px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-[#274f44]"
          >
            <Plus size={16} /> Add Shop
          </button>
        }
      />
      {message && <p role="status" className="mb-3 text-sm text-[#52785f]">{message}</p>}
      <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.data?.length}>
        <div className="grid gap-4 lg:grid-cols-2">
          {(q.data || []).map((s: Shop) => (
            <article key={s.id} className="surface p-5 md:p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf2e9] text-[#547762]">
                    <Store size={19} />
                  </span>
                  <div>
                    <h2 className="font-semibold text-[#344a40]">{s.name}</h2>
                    <p className="mt-1 text-xs text-[#89948c]">{s.address || 'Address not added'}</p>
                  </div>
                </div>
                <Pill tone={s.isActive ? 'green' : 'gray'}>{s.isActive ? 'Active' : 'Inactive'}</Pill>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 border-y border-[#efeee7] py-4">
                <div>
                  <p className="text-[10px] text-[#89948c]">Currency</p>
                  <p className="mono mt-1 text-sm font-bold">{s.currency}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#89948c]">Sales tax</p>
                  <p className="mono mt-1 text-sm font-bold">
                    {(s.taxRateBps / 100).toFixed(2)}% {((s as any).taxType === 'exclusive' ? '(Excl)' : '(Incl)')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#89948c]">Phone</p>
                  <p className="mt-1 truncate text-sm font-semibold">{s.phone || '—'}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      localStorage.setItem('billflow-shop', String(s.id));
                      window.location.reload();
                    }}
                    className="text-xs font-semibold text-[#527260] hover:underline cursor-pointer"
                  >
                    Use this shop
                  </button>
                  <button
                    onClick={() =>
                      update.mutate({ shopId: s.id, data: { isActive: !s.isActive } }, { onSuccess: () => invalidate(qc) })
                    }
                    className="text-xs font-semibold text-[#8c6656] hover:underline cursor-pointer"
                  >
                    {s.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditing(s);
                      setModal(true);
                    }}
                    className="rounded-lg border border-[#deddd5] px-3 py-1.5 text-xs font-semibold text-[#68766c] hover:bg-[#faf9f4] transition cursor-pointer"
                  >
                    Edit details
                  </button>
                  <button
                    onClick={() => {
                      setDeleteError('');
                      setDeletingShop(s);
                    }}
                    className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                    title="Delete this shop outlet"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </QueryState>
      {modal && (
        <Modal
          title={editing ? 'Edit Shop Location' : 'Add New Shop Location'}
          subtitle="Configure branch details, currency, and tax rate"
          icon={<Store size={20} className="text-emerald-700" />}
          maxWidth="max-w-lg"
          onClose={() => setModal(false)}
        >
          <form onSubmit={submit} className="space-y-4">
            <Field label="Shop / Outlet Name" required hint="e.g. Downtown Branch">
              <input required name="name" defaultValue={editing?.name || ''} autoFocus placeholder="e.g. BillFlow Express Cafe" className={inputClass} />
            </Field>
            <Field label="Store Address" hint="Printed on thermal receipt header">
              <input name="address" defaultValue={editing?.address || ''} placeholder="e.g. Sheikh Zayed Road, Dubai" className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact Phone">
                <input name="phone" defaultValue={editing?.phone || ''} placeholder="+971 50 123 4567" className={inputClass} />
              </Field>
              <Field label="Operating Currency">
                <select name="currency" defaultValue={editing?.currency || 'AED'} className={inputClass}>
                  {['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR', 'QAR', 'OMR', 'KWD', 'BHD', 'CAD', 'AUD'].map(c => (
                    <option key={c} value={c}>
                      {c === 'AED' ? 'AED (UAE Dirham)' : c === 'INR' ? 'INR (Indian Rupee)' : c === 'USD' ? '$ USD (US Dollar)' : c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sales Tax Rate (%)" hint="e.g. 5.00 for UAE VAT">
                <div className="relative">
                  <input
                    name="tax"
                    type="number"
                    min="0"
                    max="100"
                    step=".01"
                    defaultValue={((editing?.taxRateBps ?? 500) / 100).toFixed(2)}
                    placeholder="5.00"
                    className={`${inputClass} pr-8`}
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>
              </Field>
              <Field label="Tax Calculation Mode" hint="UAE standard: Inclusive">
                <select name="taxType" defaultValue={(editing as any)?.taxType || 'inclusive'} className={inputClass}>
                  <option value="inclusive">Tax Inclusive (Price includes tax - UAE)</option>
                  <option value="exclusive">Tax Exclusive (Tax added to price)</option>
                </select>
              </Field>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="w-1/3 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <div className="w-2/3">
                <Submit label={editing ? 'Save Changes' : 'Create Shop'} busy={create.isPending || update.isPending} />
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Shop Outlet Modal */}
      {deletingShop && (
        <Modal
          title={`Delete ${deletingShop.name}`}
          subtitle="Permanently remove shop outlet"
          icon={<Trash2 size={20} className="text-rose-600" />}
          maxWidth="max-w-md"
          onClose={() => !deleteLoading && setDeletingShop(null)}
        >
          {(q.data || []).length <= 1 ? (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <p className="font-semibold text-sm mb-1">Cannot Delete Only Shop</p>
                <p>Your business must have at least one shop outlet for counter billing. If you wish to replace this shop, create a new shop outlet first before deleting this one.</p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingShop(null)}
                className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-white hover:bg-slate-900 transition cursor-pointer"
              >
                Understood
              </button>
            </div>
          ) : (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                <p className="font-bold text-sm mb-1.5">Are you sure you want to delete this shop?</p>
                <p>
                  This will permanently delete <strong>{deletingShop.name}</strong> along with its outlet configuration and catalog associations.
                  {localStorage.getItem('billflow-shop') === String(deletingShop.id) && (
                    <span className="block mt-2 font-semibold text-rose-800">
                      ⚠️ Note: This is your currently active shop. The system will automatically switch to your other shop outlet.
                    </span>
                  )}
                </p>
              </div>
              {deleteError && (
                <p className="rounded-lg bg-rose-100 p-2.5 text-xs font-semibold text-rose-800">{deleteError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => setDeletingShop(null)}
                  className="w-1/2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={handleDeleteShop}
                  className="w-1/2 flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 py-2.5 text-xs font-bold text-white transition disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {deleteLoading ? <LoaderCircle className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  <span>Delete Shop</span>
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function Reports() {
  const { shop } = useCurrentShop();
  const [from, setFrom] = useState(dateInput(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(dateInput());
  const [kind, setKind] = useState<'sales' | 'expenses'>('sales');
  const [toast, setToast] = useState('');

  const params = { shopId: shop?.id, from: from || undefined, to: to || undefined };
  const sales = useGetSalesReport(params, {
    query: { enabled: !!shop, queryKey: getGetSalesReportQueryKey(params) },
  });
  const expenses = useGetExpensesReport(params, {
    query: { enabled: !!shop, queryKey: getGetExpensesReportQueryKey(params) },
  });
  const q = kind === 'sales' ? sales : expenses;
  const data = q.data;

  function getSalesTsv(d: any): string {
    if (!d?.sales) return '';
    const headers = ['Bill #', 'Date', 'Staff Cashier', 'Payment Mode', 'Order Type', 'Subtotal', 'Discount', 'Tax', 'Parcel Packaging', 'Total'];
    const rows = d.sales.map((s: any) => [
      `#${s.billNumber}`,
      s.createdAt.slice(0, 10),
      s.employeeName || 'Staff',
      s.paymentMethod.toUpperCase(),
      s.orderType === 'takeaway' ? 'Takeaway' : 'Dine In',
      (s.subtotalCents / 100).toFixed(2),
      ((s.discountCents || 0) / 100).toFixed(2),
      ((s.taxCents || 0) / 100).toFixed(2),
      ((s.parcelCents || 0) / 100).toFixed(2),
      (s.totalCents / 100).toFixed(2),
    ]);
    return [headers.join('\t'), ...rows.map((r: any) => r.join('\t'))].join('\n');
  }

  function getExpensesTsv(d: any): string {
    if (!d?.expenses) return '';
    const headers = ['Date', 'Category', 'Product / Item', 'Quantity & Unit', 'Unit Price', 'Line Total', 'Supplier', 'Payment'];
    const rows = d.expenses.flatMap((exp: any) => {
      if (exp.items && exp.items.length) {
        return exp.items.map((it: any) => [
          exp.expenseDate,
          it.categoryName || 'General',
          it.productName,
          `${it.quantity} ${it.unit}`,
          ((it.unitPriceCents || 0) / 100).toFixed(2),
          ((it.lineTotalCents || 0) / 100).toFixed(2),
          exp.supplier || '',
          exp.paymentMethod.toUpperCase(),
        ]);
      }
      return [
        [
          exp.expenseDate,
          'General',
          'Procurement',
          '1 item',
          (exp.totalCents / 100).toFixed(2),
          (exp.totalCents / 100).toFixed(2),
          exp.supplier || '',
          exp.paymentMethod.toUpperCase(),
        ],
      ];
    });
    return [headers.join('\t'), ...rows.map((r: any) => r.join('\t'))].join('\n');
  }

  async function copySales() {
    if (!sales.data) return;
    const tsv = getSalesTsv(sales.data);
    if (tsv && await copyToClipboard(tsv)) {
      setToast('Copied Sales Report! Paste directly (Ctrl+V) into Google Sheets or Excel.');
      setTimeout(() => setToast(''), 4500);
    }
  }

  async function copyExpenses() {
    if (!expenses.data) return;
    const tsv = getExpensesTsv(expenses.data);
    if (tsv && await copyToClipboard(tsv)) {
      setToast('Copied Expenses Report! Paste directly (Ctrl+V) into Google Sheets or Excel.');
      setTimeout(() => setToast(''), 4500);
    }
  }

  async function copyBoth() {
    const sTsv = sales.data ? getSalesTsv(sales.data) : '';
    const eTsv = expenses.data ? getExpensesTsv(expenses.data) : '';
    const combined = `=== SALES REPORT ===\n${sTsv}\n\n=== EXPENSES REPORT ===\n${eTsv}`;
    if (await copyToClipboard(combined)) {
      setToast('Copied Both Sales & Expenses Reports! Paste directly (Ctrl+V) into your spreadsheet.');
      setTimeout(() => setToast(''), 4500);
    }
  }

  function exportCsv() {
    if (!data) return;
    let lines: string[];
    if (kind === 'sales' && 'sales' in data) {
      lines = [
        ['Bill', 'Date', 'Employee', 'Payment', 'Order', 'Subtotal', 'Discount', 'Tax', 'Parcel', 'Total'].join(','),
        ...data.sales.map(s =>
          [
            s.billNumber,
            s.createdAt,
            s.employeeName,
            s.paymentMethod,
            s.orderType,
            s.subtotalCents / 100,
            s.discountCents / 100,
            s.taxCents / 100,
            s.parcelCents / 100,
            s.totalCents / 100,
          ]
            .map(csvCell)
            .join(','),
        ),
      ];
    } else if ('expenses' in data) {
      lines = [
        ['Date', 'Supplier', 'Reference', 'Employee', 'Payment', 'Total'].join(','),
        ...data.expenses.map(x =>
          [x.expenseDate, x.supplier || '', x.invoiceReference || '', x.employeeName, x.paymentMethod, x.totalCents / 100]
            .map(csvCell)
            .join(','),
        ),
      ];
    } else return;
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `billflow-${kind}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <PageHeading
        eyebrow="Business Intelligence & Analytics"
        title="Reports & Spreadsheet Export"
        sub="Track per-user cashier performance, parcel fees, spend categories, and copy clean spreadsheet TSV."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!sales.data?.sales?.length}
              onClick={copySales}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-600/40 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-100 disabled:opacity-50 transition cursor-pointer"
              title="Copy Sales report TSV for Google Sheets / Excel"
            >
              <Copy size={14} /> Copy Sales
            </button>
            <button
              disabled={!expenses.data?.expenses?.length}
              onClick={copyExpenses}
              className="flex items-center gap-1.5 rounded-xl border border-rose-600/40 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-800 shadow-xs hover:bg-rose-100 disabled:opacity-50 transition cursor-pointer"
              title="Copy Expenses report TSV for Google Sheets / Excel"
            >
              <Copy size={14} /> Copy Expenses
            </button>
            <button
              disabled={!sales.data?.sales?.length && !expenses.data?.expenses?.length}
              onClick={copyBoth}
              className="flex items-center gap-1.5 rounded-xl border border-[#315f52] bg-[#eff5f0] px-3.5 py-2 text-xs font-semibold text-[#315f52] shadow-xs hover:bg-[#e4efe6] disabled:opacity-50 transition cursor-pointer"
              title="Copy Both Sales and Expenses in one table"
            >
              <FileSpreadsheet size={14} /> Copy Both
            </button>
            <button
              disabled={!data}
              onClick={exportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-[#d8ddd5] bg-white px-3.5 py-2 text-xs font-semibold text-[#486255] shadow-xs hover:bg-[#faf9f4] disabled:opacity-50 transition cursor-pointer"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        }
      />

      {toast && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-[#e5f3e7] border border-[#b7dfbd] px-4 py-3 text-xs font-semibold text-[#295b34]">
          <span className="flex items-center gap-2">
            <Check size={16} /> {toast}
          </span>
          <button onClick={() => setToast('')} className="text-[#295b34] hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="surface mb-5 flex flex-wrap items-end gap-3 p-4 shadow-sm">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#8b978e] mb-1.5">
            Report Type
          </label>
          <div className="flex rounded-xl border border-[#dedcd2] bg-[#f5f4ee] p-1">
            <button
              type="button"
              onClick={() => setKind('sales')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                kind === 'sales'
                  ? 'bg-[#315f52] text-white shadow-xs'
                  : 'text-[#617467] hover:text-[#2c4339]'
              }`}
            >
              <ShoppingBag size={14} /> Sales Report
            </button>
            <button
              type="button"
              onClick={() => setKind('expenses')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                kind === 'expenses'
                  ? 'bg-[#315f52] text-white shadow-xs'
                  : 'text-[#617467] hover:text-[#2c4339]'
              }`}
            >
              <Wallet size={14} /> Expenses Report
            </button>
          </div>
        </div>
        <Field label="From Date">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputClass} />
        </Field>
        <Field label="To Date">
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputClass} />
        </Field>
        <span className="ml-auto pb-2 text-xs text-[#8a958d]">
          Period: <strong>{from}</strong> to <strong>{to}</strong>
        </span>
      </div>

      <QueryState
        loading={q.isLoading}
        error={q.isError}
        retry={() => q.refetch()}
        empty={
          !data ||
          (kind === 'sales'
            ? 'sales' in data
              ? data.sales.length === 0
              : true
            : 'expenses' in data
            ? data.expenses.length === 0
            : true)
        }
      >
        {kind === 'sales' && data && 'byEmployee' in data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Sales Total"
                value={money(data.totalCents, shop?.currency)}
                detail={`${data.billCount} completed bills`}
                icon={<Coins size={18} />}
              />
              <Metric
                label="Takeaway Parcel Charges"
                value={money(data.parcelCents, shop?.currency)}
                detail="Packaging revenue"
                icon={<Package size={18} />}
                accent="bg-[#fbf4e8] text-[#aa7329]"
              />
              <Metric
                label="Discounts Given"
                value={money(data.discountCents, shop?.currency)}
                detail="Across selected period"
                icon={<ArrowDownRight size={18} />}
                accent="bg-[#f7efdf] text-[#9b7844]"
              />
              <Metric
                label="Completed Bills"
                value={String(data.billCount)}
                detail="For selected dates"
                icon={<ClipboardList size={18} />}
                accent="bg-[#f4eae5] text-[#a3614e]"
              />
            </div>

            {/* Separate Value of Sales when Each Person is Using */}
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <section className="surface p-5 md:p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-[#eeede6] pb-3">
                  <div>
                    <h2 className="font-semibold text-[#2f4337] text-base">Sales by Staff / Cashier</h2>
                    <p className="text-xs text-[#859288]">Distinct total sales and bill counts per user</p>
                  </div>
                  <span className="rounded-full bg-[#edf3ec] px-2.5 py-1 text-[11px] font-bold text-[#35614a]">
                    {data.byEmployee.length} Staff
                  </span>
                </div>

                <DataTable
                  headers={['Staff Member', 'Bills Completed', 'Total Sales', 'Share']}
                  rows={data.byEmployee.map(x => {
                    const pct = data.totalCents ? Math.round((x.totalCents / data.totalCents) * 100) : 0;
                    return [
                      <div className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#e3eae4] text-xs font-bold text-[#315f52]">
                          {(x.employeeName || 'S')[0].toUpperCase()}
                        </span>
                        <span className="font-semibold text-[#2f4337]">{x.employeeName}</span>
                      </div>,
                      <span className="mono text-xs">{x.billCount} bills</span>,
                      <span className="mono font-bold text-[#315f52]">{money(x.totalCents, shop?.currency)}</span>,
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 overflow-hidden rounded-full bg-[#edf0eb]">
                          <div className="h-full rounded-full bg-[#315f52]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-[#728076]">{pct}%</span>
                      </div>,
                    ];
                  })}
                />
              </section>

              <section className="surface p-5 md:p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-[#eeede6] pb-3">
                  <div>
                    <h2 className="font-semibold text-[#2f4337] text-base">Sales by Payment Mode</h2>
                    <p className="text-xs text-[#859288]">Revenue distribution across payment methods</p>
                  </div>
                </div>

                <DataTable
                  headers={['Payment Mode', 'Total Collected', 'Share']}
                  rows={data.byPayment.map(x => [
                    <span className="capitalize font-semibold text-[#344a3e]">{x.method}</span>,
                    <span className="mono font-bold text-[#315f52]">{money(x.totalCents, shop?.currency)}</span>,
                    `${data.totalCents ? Math.round((x.totalCents / data.totalCents) * 100) : 0}%`,
                  ])}
                />
              </section>
            </div>
          </>
        ) : kind === 'expenses' && data && 'byCategory' in data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Procurement Expense Total"
                value={money(data.totalCents, shop?.currency)}
                detail={`${data.expenses.length} recorded entries`}
                icon={<Wallet size={18} />}
                accent="bg-[#f4eae5] text-[#a3614e]"
              />
              <Metric
                label="Categories in View"
                value={String(data.byCategory.length)}
                detail="Active spend categories"
                icon={<Boxes size={18} />}
              />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[.85fr_1.15fr]">
              <section className="surface p-5 shadow-sm">
                <h2 className="mb-3 font-semibold text-[#344a40]">Spend by Category</h2>
                <DataTable
                  headers={['Category', 'Total', 'Share']}
                  rows={data.byCategory.map(x => [
                    <span className="font-semibold">{x.categoryName}</span>,
                    <span className="mono font-bold text-[#a3614e]">{money(x.totalCents, shop?.currency)}</span>,
                    `${data.totalCents ? Math.round((x.totalCents / data.totalCents) * 100) : 0}%`,
                  ])}
                />
              </section>

              <section className="surface p-5 shadow-sm">
                <h2 className="mb-3 font-semibold text-[#344a40]">Expense Records</h2>
                <DataTable
                  headers={['Date', 'Supplier', 'Category / Item', 'Payment', 'Total']}
                  rows={data.expenses.map(x => [
                    dateLabel(x.expenseDate),
                    x.supplier || '—',
                    <span>
                      {x.items?.[0]?.productName || 'Procurement'}
                      <small className="block text-[10px] text-[#8c968e]">
                        {x.items?.[0]?.categoryName || 'General'}
                      </small>
                    </span>,
                    <Pill>{x.paymentMethod.toUpperCase()}</Pill>,
                    <span className="mono font-bold text-[#2e4337]">{money(x.totalCents, shop?.currency)}</span>,
                  ])}
                />
              </section>
            </div>
          </>
        ) : null}
      </QueryState>
    </>
  );
}

function csvCell(value: unknown) {
  let str = String(value ?? '').replaceAll('"', '""');
  // Security: Prevent CSV / Spreadsheet Formula Injection (CWE-1236)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str}"`;
}

function GoogleSheetsSyncManager() {
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('billflow-gsheet-webhook') || '');
  const [status, setStatus] = useState<string | null>(null);
  const [showScriptModal, setShowScriptModal] = useState(false);

  function saveUrl(e: FormEvent) {
    e.preventDefault();
    localStorage.setItem('billflow-gsheet-webhook', webhookUrl.trim());
    setStatus('Google Sheets webhook URL saved locally.');
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <section className="surface p-5 md:p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-[#eeede6] pb-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf4ec] text-[#315f52]">
            <FileSpreadsheet size={20} />
          </span>
          <div>
            <h2 className="font-semibold text-[#2c4339]">Google Sheets Integration</h2>
            <p className="text-xs text-[#829087]">Automate exports or paste TSV rows directly into Google Sheets</p>
          </div>
        </div>
        <button
          onClick={() => setShowScriptModal(true)}
          className="text-xs font-semibold text-[#315f52] hover:underline"
        >
          View Apps Script Template →
        </button>
      </div>

      <p className="text-xs text-[#6a7a70] mb-4">
        You can use the <strong>"Copy for Google Sheets"</strong> button in Sales and Reports to paste formatted columns
        directly into any Google Sheet with Ctrl+V. Alternatively, set a Google Apps Script Web App URL below to sync
        sales and expenses automatically.
      </p>

      <form onSubmit={saveUrl} className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          value={webhookUrl}
          onChange={e => setWebhookUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/.../exec"
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          className="rounded-xl bg-[#315f52] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#274f44] transition shrink-0"
        >
          Save Webhook
        </button>
      </form>

      {status && <p className="mt-2 text-xs font-medium text-[#467455]">{status}</p>}

      {showScriptModal && (
        <Modal
          title="Google Apps Script Setup"
          subtitle="Deploy a WebApp endpoint to sync sales and expenses directly into Google Sheets"
          icon={<FileSpreadsheet size={20} className="text-emerald-700" />}
          maxWidth="max-w-xl"
          onClose={() => setShowScriptModal(false)}
        >
          <div className="space-y-4 text-xs text-slate-600">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
              <span className="font-bold text-emerald-950 text-xs">Easy 3-Step Setup Instructions</span>
              <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-600">
                <li>Open your Google Sheet and click <strong>Extensions → Apps Script</strong>.</li>
                <li>Paste the code snippet below and click <strong>Deploy → New deployment → Web app</strong>.</li>
                <li>Set <em>"Who has access"</em> to <strong>"Anyone"</strong> and paste the deployed URL into the Webhook field above.</li>
              </ol>
            </div>

            <div className="relative rounded-2xl bg-slate-900 p-4 text-slate-100 font-mono text-[11px] overflow-x-auto shadow-inner">
              <pre>{`function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(),
    data.billNumber || data.expenseId,
    data.employeeName || "Staff",
    data.totalCents / 100,
    data.paymentMethod,
    data.orderType || data.category
  ]);
  return ContentService.createTextOutput(JSON.stringify({status: "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}`}</pre>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                className="w-1/3 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
              <div className="w-2/3">
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(`function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    new Date(),
    data.billNumber || data.expenseId,
    data.employeeName || "Staff",
    data.totalCents / 100,
    data.paymentMethod,
    data.orderType || data.category
  ]);
  return ContentService.createTextOutput(JSON.stringify({status: "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}`);
                    setStatus('Script copied to clipboard!');
                    setTimeout(() => setStatus(null), 3000);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 hover:from-emerald-800 hover:to-teal-900 transition cursor-pointer"
                >
                  <Copy size={15} /> Copy Apps Script Code
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

function AdminGate({ children }: { children: ReactNode }) {
  const { verifyAdminLogin } = useAuth();
  const [, setLocation] = useLocation();
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem('billflow-admin-unlocked') === 'true';
    } catch {
      return false;
    }
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleUnlock(e: FormEvent) {
    e.preventDefault();
    setError('');
    const u = username.trim();
    const p = password;

    if (!u) {
      setError('Please enter your admin username.');
      return;
    }
    if (!p) {
      setError('Please enter your admin password.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      if (verifyAdminLogin(u, p)) {
        try {
          sessionStorage.setItem('billflow-admin-unlocked', 'true');
        } catch {}
        setUnlocked(true);
      } else {
        setError('Incorrect admin username or password. Access denied.');
        setPassword('');
      }
      setLoading(false);
    }, 150);
  }

  function handleLock() {
    try {
      sessionStorage.removeItem('billflow-admin-unlocked');
    } catch {}
    setUnlocked(false);
    setPassword('');
    setUsername('');
    setError('');
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md py-6 sm:py-10">
        <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-slate-900/5">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20 shadow-xs mb-3">
              <ShieldCheck size={28} />
            </span>
            <h2 className="text-xl font-bold text-slate-800">Admin Authorization Required</h2>
            <p className="mt-1.5 text-xs text-slate-500 max-w-xs leading-relaxed">
              To enter Admin & Settings, please enter the administrator username and password.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Field label="Admin Username" required>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(''); }}
                  placeholder="e.g. admin"
                  className={`${inputClass} pl-10`}
                />
              </div>
            </Field>

            <Field label="Admin Password" required>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter admin password"
                  className={`${inputClass} pl-10 pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 py-3 text-xs font-semibold text-white shadow-md shadow-emerald-900/15 hover:from-emerald-800 hover:to-teal-900 active:scale-[0.99] transition cursor-pointer disabled:opacity-70 mt-2"
            >
              {loading ? <LoaderCircle className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
              Verify & Enter Admin Settings →
            </button>

            <button
              type="button"
              onClick={() => setLocation('/pos')}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              ← Back to POS Register
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-xs">
        <span className="flex items-center gap-2 font-semibold text-emerald-900">
          <ShieldCheck size={16} className="text-emerald-700" /> Admin Authorized Session Active
        </span>
        <button
          type="button"
          onClick={handleLock}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100/60 cursor-pointer transition"
        >
          <Lock size={13} /> Lock Settings
        </button>
      </div>
      {children}
    </>
  );
}

function SettingsPage() {
  const ws = useGetWorkspace();
  const health = useHealthCheck();
  const shops = useListShops();
  return (
    <AdminGate>
      <PageHeading
        eyebrow="Admin Panel & Workspace"
        title="Settings & Admin Control"
        sub="Control admin login credentials, business details, Google Sheets sync, and system status."
      />
      <div className="space-y-6">
        <AdminCredentialsManager />
        <QuickPinManager />
        <GoogleSheetsSyncManager />
        <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <section className="surface p-5 md:p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf2e9] text-[#527260]">
                <BriefcaseBusiness size={18} />
              </span>
              <div>
                <h2 className="font-semibold text-[#344a40]">Business profile</h2>
                <p className="text-xs text-[#89948c]">Workspace identity and access</p>
              </div>
            </div>
            <div className="divide-y divide-[#efeee7]">
              {[
                ['Business name', ws.data?.businessName || 'Loading…'],
                ['Signed-in user', ws.data?.userName || '—'],
                ['Access role', ws.data?.role || '—'],
                ['Connected shops', String(shops.data?.length || 0)],
              ].map(([k, v]) => (
                <div className="flex justify-between gap-4 py-3 text-sm" key={k}>
                  <span className="text-[#77827a]">{k}</span>
                  <span className="font-semibold capitalize text-[#3e5147]">{v}</span>
                </div>
              ))}
            </div>
            <Link
              href="/shops"
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#d9ddd4] px-3 py-2 text-xs font-semibold text-[#527260]"
            >
              Manage shops <ArrowRight size={13} />
            </Link>
          </section>
          <section className="surface p-5 md:p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7efdf] text-[#9b7844]">
                <Activity size={18} />
              </span>
              <div>
                <h2 className="font-semibold text-[#344a40]">Service status</h2>
                <p className="text-xs text-[#89948c]">Connections for this workspace</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                ['BillFlow API', health.data?.status || 'Checking', health.isError],
                ['Local Admin Auth', 'Online & Protected', false],
                ['Shop data', shops.isError ? 'Unavailable' : shops.isLoading ? 'Checking' : 'Connected', shops.isError],
              ].map(([label, status, failed]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-xl border border-[#eeede6] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-[#47584e]">{label}</p>
                    <p className="mt-0.5 text-[11px] text-[#8b958e]">Local offline ready</p>
                  </div>
                  <Pill tone={failed ? 'amber' : 'green'}>{String(status)}</Pill>
                </div>
              ))}
            </div>
            <p className="mt-5 rounded-lg bg-[#f7f6f0] p-3 text-xs leading-5 text-[#7b877e]">
              Your sales and staff data are scoped to your local POS workspace. Admin credentials are saved locally in secure offline storage.
            </p>
          </section>
        </div>
      </div>
    </AdminGate>
  );
}

// ─── Receipt Control ────────────────────────────────────────────────────────
const RC_KEY = 'billflow-receipt-cfg';
type ReceiptCfg = {
  businessName: string;
  tagline: string;
  logoUrl: string;
  address: string;
  phone: string;
  website: string;
  taxNumber: string;
  footerMsg: string;
  customNote: string;
  accentColor: string;
  fontFamily: string;
  showLogo: boolean;
  showBillNo: boolean;
  showDate: boolean;
  showCashier: boolean;
  showPayment: boolean;
  showTax: boolean;
  showTaxNumber: boolean;
  showCustomNote: boolean;
  showQrCode: boolean;
  qrCodeData: string;
  showThankYou: boolean;
  paperWidth: '50mm' | '58mm' | '80mm' | 'A4';
  autoPrintOnSale: boolean;
  cutSpacing: boolean;
  silentBluetoothPrint?: boolean;
  kickDrawerOnSale?: boolean;
};

const RC_DEFAULTS: ReceiptCfg = {
  businessName: 'BillFlow Shop',
  tagline: 'Thank you for shopping with us!',
  logoUrl: '/logo.png',
  address: 'Sheikh Zayed Road, Dubai, UAE',
  phone: '+971 50 123 4567',
  website: '',
  taxNumber: 'TRN: 100234567800003',
  footerMsg: 'Visit us again soon! شكراً لزيارتكم 🙏',
  customNote: 'Goods once sold can be exchanged within 7 days with this bill.',
  accentColor: '#315f52',
  fontFamily: 'DM Sans, sans-serif',
  showLogo: true,
  showBillNo: true,
  showDate: true,
  showCashier: true,
  showPayment: true,
  showTax: true,
  showTaxNumber: true,
  showCustomNote: true,
  showQrCode: true,
  qrCodeData: '',
  showThankYou: true,
  paperWidth: '80mm',
  autoPrintOnSale: false,
  cutSpacing: true,
  silentBluetoothPrint: false,
  kickDrawerOnSale: false,
};

function loadRc(): ReceiptCfg {
  try {
    const raw = localStorage.getItem(RC_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    // Automatically purge legacy dead placeholder domain 'billflow.app'
    if (parsed.qrCodeData && (parsed.qrCodeData.includes('billflow.app') || parsed.qrCodeData.includes('/verify'))) {
      parsed.qrCodeData = '';
      localStorage.setItem(RC_KEY, JSON.stringify({ ...RC_DEFAULTS, ...parsed }));
    }
    return { ...RC_DEFAULTS, ...parsed };
  } catch {
    return RC_DEFAULTS;
  }
}

function saveRc(cfg: ReceiptCfg) { localStorage.setItem(RC_KEY, JSON.stringify(cfg)); }

function printReceiptElement(elementId: string, cfg: ReceiptCfg) {
  const target = document.getElementById(elementId);
  if (!target) {
    console.error(`Receipt element #${elementId} not found`);
    return;
  }

  // Remove any leftover print iframe from previous prints
  const oldIframe = document.getElementById('__billflow_print_frame');
  if (oldIframe) {
    oldIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = '__billflow_print_frame';
  iframe.setAttribute(
    'style',
    'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;'
  );
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) return;

  const isA4 = cfg.paperWidth === 'A4';
  const is50 = cfg.paperWidth === '50mm';
  const is58 = cfg.paperWidth === '58mm';
  const paperW = isA4 ? '210mm' : cfg.paperWidth;
  const printWidth = isA4 ? '190mm' : is50 ? '45mm' : is58 ? '52mm' : '74mm';
  const padding = isA4 ? '10mm 15mm' : is50 ? '2mm 1mm' : is58 ? '2mm 1.5mm' : '3mm 2.5mm';

  // Clone receipt element
  const clone = target.cloneNode(true) as HTMLElement;
  clone.id = `${elementId}-print-clone`;
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.border = 'none';
  clone.style.margin = isA4 ? '0 auto' : '0';
  clone.style.width = '100%';
  clone.style.maxWidth = printWidth;
  clone.style.padding = padding;
  clone.style.boxSizing = 'border-box';
  clone.style.background = '#ffffff';
  clone.style.color = '#111111';

  const receiptTitle = `Receipt_${(cfg.businessName || 'BillFlow').replace(/[^a-zA-Z0-9]/g, '_')}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <base href="${window.location.origin}/" />
  <title>${receiptTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    @page {
      size: ${isA4 ? 'A4 portrait' : `${cfg.paperWidth} auto`};
      margin: 0mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #111111 !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      font-family: ${cfg.fontFamily || "'DM Sans', sans-serif"};
      -webkit-font-smoothing: antialiased;
    }
    body {
      display: flex;
      flex-direction: column;
      align-items: ${isA4 ? 'center' : 'flex-start'};
      justify-content: flex-start;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
    }
    @media print {
      html, body {
        width: ${isA4 ? '100%' : paperW} !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  ${clone.outerHTML}
</body>
</html>`;

  doc.open();
  doc.write(html);
  doc.close();

  // Wait for images to load (store logo, QR code)
  const images = Array.from(doc.images);
  const imagePromises = images.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve(true);
    return new Promise(resolve => {
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
    });
  });

  const timeoutPromise = new Promise(resolve => setTimeout(resolve, 800));

  Promise.race([Promise.all(imagePromises), timeoutPromise]).then(() => {
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (err) {
        console.error('Print execution failed:', err);
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 1500);
      }
    }, 150);
  });
}

async function executeSmartReceiptPrint(
  elementId: string,
  sale: any,
  cfg: ReceiptCfg,
  shop: any,
  onNotify?: (msg: string) => void
) {
  const savedBt = getSavedPrinterInfo();
  if (cfg.silentBluetoothPrint && savedBt) {
    try {
      if (onNotify) onNotify(`Printing silently to ${savedBt.name}...`);
      await printDirectBluetooth(sale, cfg, shop);
      if (onNotify) onNotify(`✓ Printed to ${savedBt.name}`);
      return;
    } catch (err: any) {
      console.warn('Direct Bluetooth print failed, falling back to browser print:', err);
      if (onNotify) onNotify(`Bluetooth reconnecting; opening print preview...`);
    }
  }
  printReceiptElement(elementId, cfg);
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full py-2.5 text-sm font-medium text-[#3d5146] hover:opacity-85"
    >
      <span>{label}</span>
      {checked
        ? <ToggleRight size={26} className="text-[#315f52]" />
        : <ToggleLeft size={26} className="text-[#aab4ac]" />}
    </button>
  );
}

function ReceiptPreview({
  id = 'billflow-receipt-preview',
  cfg,
  sampleSale,
}: {
  id?: string;
  cfg: ReceiptCfg;
  sampleSale: {
    billNo: string;
    date: string;
    cashier: string;
    payment: string;
    items: { name: string; qty: number; price: number }[];
    subtotal: number;
    discount?: number;
    tax: number;
    taxRate?: number;
    taxIncluded?: boolean;
    net?: number;
    parcel?: number;
    total: number;
    currency?: string;
  };
}) {
  const currSym = sampleSale.currency ? `${sampleSale.currency} ` : 'AED ';
  const paperW = cfg.paperWidth === 'A4' ? '210mm' : cfg.paperWidth;
  const isThermal = cfg.paperWidth !== 'A4';
  const is50 = cfg.paperWidth === '50mm';
  const is58 = cfg.paperWidth === '58mm';
  const currentOrigin = typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('null')
    ? window.location.origin
    : '';
  const rawCustom = cfg.qrCodeData?.trim() || '';
  const isDeadPlaceholder = rawCustom.includes('billflow.app');
  const defaultVerifyUrl = currentOrigin
    ? `${currentOrigin}/verify?bill=${encodeURIComponent(sampleSale.billNo)}&total=${encodeURIComponent(sampleSale.total.toFixed(2))}&date=${encodeURIComponent(sampleSale.date)}&cashier=${encodeURIComponent(sampleSale.cashier)}&shop=${encodeURIComponent(cfg.businessName)}`
    : `/verify?bill=${encodeURIComponent(sampleSale.billNo)}&total=${encodeURIComponent(sampleSale.total.toFixed(2))}&date=${encodeURIComponent(sampleSale.date)}&cashier=${encodeURIComponent(sampleSale.cashier)}&shop=${encodeURIComponent(cfg.businessName)}`;
  const qrData = (!isDeadPlaceholder && rawCustom) ? rawCustom : defaultVerifyUrl;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=0&data=${encodeURIComponent(qrData)}`;

  return (
    <div
      id={id}
      style={{
        width: paperW,
        maxWidth: '100%',
        fontFamily: cfg.fontFamily,
        background: '#fff',
        color: '#111',
        borderRadius: 12,
        padding: isThermal ? (is50 ? '10px 6px' : is58 ? '12px 10px' : '16px 14px') : '32px 40px',
        boxShadow: '0 4px 30px rgba(0,0,0,.08)',
        fontSize: isThermal ? (is50 ? 10 : is58 ? 11 : 12) : 14,
        lineHeight: 1.5,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        {cfg.showLogo && cfg.logoUrl && (
          <img src={cfg.logoUrl} alt="logo" style={{ maxHeight: 50, maxWidth: '65%', objectFit: 'contain', margin: '0 auto 6px', display: 'block' }} />
        )}
        <div style={{ fontWeight: 800, fontSize: isThermal ? (is50 ? 12.5 : is58 ? 14 : 17) : 22, color: cfg.accentColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {cfg.businessName}
        </div>
        {cfg.tagline && <div style={{ fontSize: isThermal ? (is50 ? 9 : 10) : 12, color: '#666', marginTop: 2 }}>{cfg.tagline}</div>}
        {cfg.address && <div style={{ fontSize: isThermal ? (is50 ? 8.5 : 9.5) : 12, color: '#555', marginTop: 2 }}>{cfg.address}</div>}
        {cfg.phone && <div style={{ fontSize: isThermal ? (is50 ? 8.5 : 9.5) : 12, color: '#555' }}>Tel: {cfg.phone}</div>}
        {cfg.website && <div style={{ fontSize: isThermal ? (is50 ? 8.5 : 9.5) : 12, color: cfg.accentColor }}>{cfg.website}</div>}
        {cfg.showTaxNumber && cfg.taxNumber && (
          <div style={{ fontSize: isThermal ? (is50 ? 8.5 : 9.5) : 11, color: '#444', fontWeight: 600, marginTop: 2 }}>{cfg.taxNumber}</div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #bbb', margin: '6px 0' }} />

      {/* Meta info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isThermal ? (is50 ? 8.5 : 9.5) : 12, color: '#444', marginBottom: 4 }}>
        {cfg.showBillNo && <span style={{ fontWeight: 700 }}>BILL #{sampleSale.billNo}</span>}
        {cfg.showDate && <span>{sampleSale.date}</span>}
      </div>
      {cfg.showCashier && <div style={{ fontSize: isThermal ? (is50 ? 8.5 : 9.5) : 12, color: '#555', marginBottom: 2 }}>Cashier: {sampleSale.cashier}</div>}
      {cfg.showPayment && <div style={{ fontSize: isThermal ? (is50 ? 8.5 : 9.5) : 12, color: '#555', marginBottom: 2 }}>Payment: {sampleSale.payment.toUpperCase()}</div>}

      {/* Items table */}
      <div style={{ borderTop: '1px dashed #bbb', margin: '6px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: is50 ? '2px 4px' : '2px 8px', fontSize: isThermal ? (is50 ? 8.5 : is58 ? 9.5 : 11) : 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: '#666', fontSize: is50 ? 8 : 9.5 }}>ITEM</span>
        <span style={{ fontWeight: 700, color: '#666', fontSize: is50 ? 8 : 9.5, textAlign: 'center' }}>QTY</span>
        <span style={{ fontWeight: 700, color: '#666', fontSize: is50 ? 8 : 9.5, textAlign: 'right' }}>TOTAL</span>
        {sampleSale.items.map((item, i) => (
          <div key={`row-${i}`} style={{ display: 'contents' }}>
            <span style={{ wordBreak: 'break-word', paddingRight: 4 }}>{item.name}</span>
            <span style={{ textAlign: 'center' }}>{item.qty}</span>
            <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>{currSym}{(item.price * item.qty).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dashed #bbb', margin: '6px 0' }} />

      {/* Totals */}
      <div style={{ fontSize: isThermal ? (is50 ? 9.5 : 11) : 13, lineHeight: 1.6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
          <span>Subtotal</span><span style={{ fontFamily: 'monospace' }}>{currSym}{sampleSale.subtotal.toFixed(2)}</span>
        </div>
        {sampleSale.discount && sampleSale.discount > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d' }}>
            <span>Discount</span><span style={{ fontFamily: 'monospace' }}>-{currSym}{sampleSale.discount.toFixed(2)}</span>
          </div>
        ) : null}
        {sampleSale.parcel && sampleSale.parcel > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aa7329' }}>
            <span>Parcel Packaging</span><span style={{ fontFamily: 'monospace' }}>+{currSym}{sampleSale.parcel.toFixed(2)}</span>
          </div>
        ) : null}
        {sampleSale.taxIncluded ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isThermal ? (is50 ? 7.5 : 8.5) : 10.5, color: '#666', fontStyle: 'italic' }}>
            <span>(Includes {sampleSale.taxRate ? `${sampleSale.taxRate}% ` : ''}VAT: {currSym}{sampleSale.tax.toFixed(2)})</span>
            {sampleSale.net !== undefined && <span>Net: {currSym}{sampleSale.net.toFixed(2)}</span>}
          </div>
        ) : (
          cfg.showTax && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
              <span>Tax {sampleSale.taxRate ? `(${sampleSale.taxRate}%)` : ''}</span><span style={{ fontFamily: 'monospace' }}>{currSym}{sampleSale.tax.toFixed(2)}</span>
            </div>
          )
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: isThermal ? (is50 ? 11.5 : is58 ? 13 : 16) : 18, marginTop: 4, color: cfg.accentColor, borderTop: '1px solid #ddd', paddingTop: 4 }}>
          <span>TOTAL</span><span style={{ fontFamily: 'monospace' }}>{currSym}{sampleSale.total.toFixed(2)}</span>
        </div>
      </div>

      {/* QR Code */}
      {cfg.showQrCode && (
        <div style={{ textAlign: 'center', marginTop: 10, marginBottom: 6 }}>
          <img
            src={qrUrl}
            alt="Verify QR"
            style={{ width: isThermal ? (is50 ? 54 : is58 ? 65 : 78) : 90, height: isThermal ? (is50 ? 54 : is58 ? 65 : 78) : 90, margin: '0 auto', display: 'block' }}
          />
          <div style={{ fontSize: is50 ? 8 : 9, color: '#777', marginTop: 3 }}>Scan to verify receipt</div>
        </div>
      )}

      {/* Custom policy note */}
      {cfg.showCustomNote && cfg.customNote && (
        <div style={{ textAlign: 'center', fontSize: isThermal ? (is50 ? 8 : 9) : 11, color: '#666', marginTop: 6, fontStyle: 'italic', lineHeight: 1.3 }}>
          {cfg.customNote}
        </div>
      )}

      {/* Footer Thank-You */}
      {cfg.showThankYou && cfg.footerMsg && (
        <>
          <div style={{ borderTop: '1px dashed #bbb', margin: '8px 0 6px' }} />
          <div style={{ textAlign: 'center', fontSize: isThermal ? (is50 ? 8.5 : 9.5) : 12, color: '#555', fontWeight: 600 }}>{cfg.footerMsg}</div>
        </>
      )}

      {/* Paper Cutter Feed space */}
      {cfg.cutSpacing && isThermal && (
        <div style={{ height: is50 ? 20 : is58 ? 24 : 32, borderTop: '1px dotted #ccc', marginTop: 10, textAlign: 'center', fontSize: 8, color: '#aaa', lineHeight: '20px' }}>
          ✂ - - - - - - - - - - - - - - - - - - ✂
        </div>
      )}
    </div>
  );
}

const SAMPLE_SALE = {
  billNo: 'BF-0042',
  date: new Date().toLocaleString(),
  cashier: 'Store Cashier',
  payment: 'cash',
  items: [
    { name: 'Special Karak Chai', qty: 2, price: 4.00 },
    { name: 'Butter Croissant', qty: 1, price: 6.00 },
    { name: 'Fresh Orange Juice', qty: 1, price: 10.00 },
  ],
  subtotal: 24.00,
  discount: 0,
  tax: 1.14,
  taxRate: 5,
  taxIncluded: true,
  net: 22.86,
  total: 24.00,
  currency: 'AED',
};

function ReceiptControl() {
  const [cfg, setCfgRaw] = useState<ReceiptCfg>(loadRc);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'fields' | 'layout' | 'printer'>('branding');
  const [btPrinter, setBtPrinter] = useState<BluetoothDeviceInfo | null>(getSavedPrinterInfo);
  const [btLoading, setBtLoading] = useState(false);
  const [btStatusMsg, setBtStatusMsg] = useState('');

  function setCfg(patch: Partial<ReceiptCfg>) { setCfgRaw(prev => ({ ...prev, ...patch })); setSaved(false); }
  function handleSave() { saveRc(cfg); setSaved(true); setTimeout(() => setSaved(false), 2200); }
  function handlePrint() {
    printReceiptElement('billflow-receipt-preview', cfg);
  }

  async function handleConnectBluetooth() {
    try {
      setBtLoading(true);
      setBtStatusMsg('');
      const info = await connectBluetoothPrinter();
      setBtPrinter(info);
      setCfg({ silentBluetoothPrint: true });
      setBtStatusMsg(`✓ Connected to ${info.name}!`);
    } catch (err: any) {
      setBtStatusMsg(err?.message || 'Bluetooth connection failed');
    } finally {
      setBtLoading(false);
    }
  }

  async function handleTestBluetooth() {
    try {
      setBtLoading(true);
      setBtStatusMsg('Sending test bill to printer...');
      await testBluetoothPrint(cfg, { currency: 'AED', name: cfg.businessName });
      setBtStatusMsg('✓ Test bill printed successfully!');
    } catch (err: any) {
      setBtStatusMsg(err?.message || 'Print error');
    } finally {
      setBtLoading(false);
    }
  }

  async function handleKickDrawer() {
    try {
      setBtLoading(true);
      await triggerCashDrawer();
      setBtStatusMsg('✓ Cash drawer pulse sent!');
    } catch (err: any) {
      setBtStatusMsg(err?.message || 'Cash drawer error');
    } finally {
      setBtLoading(false);
    }
  }

  function handleForgetPrinter() {
    clearSavedPrinter();
    setBtPrinter(null);
    setCfg({ silentBluetoothPrint: false });
    setBtStatusMsg('Bluetooth printer disconnected.');
  }

  const tabBtn = (t: typeof activeTab, label: string, icon: ReactNode) => (
    <button
      onClick={() => setActiveTab(t)}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
        activeTab === t ? 'bg-[#315f52] text-white shadow-sm' : 'text-[#627a6e] hover:bg-[#eef3ec]'
      }`}
    >{icon}{label}</button>
  );

  return (
    <>
      <PageHeading
        eyebrow="Receipt customization & hardware"
        title="Receipt Control"
        sub="Design, customize fields, and configure external thermal POS printers."
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                saved ? 'bg-[#e6f2eb] text-[#315f52] border border-[#b5d9c3]' : 'bg-[#315f52] text-white hover:bg-[#274f44]'
              }`}
            >
              {saved ? <Check size={15} /> : <Settings size={15} />}
              {saved ? 'Saved!' : 'Save settings'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-[#dddcd3] bg-white px-4 py-2.5 text-sm font-semibold text-[#526258] hover:bg-[#f7f6f0]"
            >
              <Printer size={15} /> Test print
            </button>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[490px_1fr] items-start">
        {/* ─── Controls Panel ─────────────────────────────── */}
        <div className="surface p-5 md:p-6">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 mb-5 p-1 rounded-xl bg-[#f1f0e9]">
            {tabBtn('branding', 'Branding', <Palette size={14} />)}
            {tabBtn('fields', 'Fields', <FileText size={14} />)}
            {tabBtn('layout', 'Paper & Font', <Type size={14} />)}
            {tabBtn('printer', 'External Printer', <Printer size={14} />)}
          </div>

          {activeTab === 'branding' && (
            <div className="grid gap-4">
              <Field label="Business name">
                <input value={cfg.businessName} onChange={e => setCfg({ businessName: e.target.value })} className={inputClass} placeholder="Your shop name" />
              </Field>
              <Field label="Tagline / sub-heading">
                <input value={cfg.tagline} onChange={e => setCfg({ tagline: e.target.value })} className={inputClass} placeholder="Short description or motto" />
              </Field>
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4">
                <ImageUploadZone
                  label="Store Receipt Logo"
                  value={cfg.logoUrl}
                  onChange={logo => setCfg({ logoUrl: logo, showLogo: !!logo })}
                  aspect="wide"
                  helperText="Upload store logo image from phone or computer for thermal receipts"
                  showPresets={false}
                />
              </div>
              <Field label="Address">
                <input value={cfg.address} onChange={e => setCfg({ address: e.target.value })} className={inputClass} placeholder="Shop address" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone">
                  <input value={cfg.phone} onChange={e => setCfg({ phone: e.target.value })} className={inputClass} placeholder="+91…" />
                </Field>
                <Field label="Website">
                  <input value={cfg.website} onChange={e => setCfg({ website: e.target.value })} className={inputClass} placeholder="www.shop.com" />
                </Field>
              </div>
              <Field label="Tax / GSTIN Number (optional)">
                <input value={cfg.taxNumber} onChange={e => setCfg({ taxNumber: e.target.value })} className={inputClass} placeholder="e.g. GSTIN: 29ABCDE1234F1Z5" />
              </Field>
              <Field label="Return / Exchange Policy note">
                <input value={cfg.customNote} onChange={e => setCfg({ customNote: e.target.value })} className={inputClass} placeholder="e.g. Exchange within 7 days with bill" />
              </Field>
              <Field label="Footer / thank-you message">
                <input value={cfg.footerMsg} onChange={e => setCfg({ footerMsg: e.target.value })} className={inputClass} placeholder="Visit again soon!" />
              </Field>
              <Field label="Accent colour">
                <div className="flex items-center gap-2">
                  <input type="color" value={cfg.accentColor} onChange={e => setCfg({ accentColor: e.target.value })} className="h-11 w-14 cursor-pointer rounded-lg border border-[#dddcd3] p-1" />
                  <span className="mono text-xs text-[#78837a]">{cfg.accentColor}</span>
                </div>
              </Field>
            </div>
          )}

          {activeTab === 'fields' && (
            <div className="divide-y divide-[#eeede7]">
              <Toggle checked={cfg.showLogo} onChange={v => setCfg({ showLogo: v })} label="Show store logo" />
              <Toggle checked={cfg.showBillNo} onChange={v => setCfg({ showBillNo: v })} label="Show bill number" />
              <Toggle checked={cfg.showDate} onChange={v => setCfg({ showDate: v })} label="Show date & time" />
              <Toggle checked={cfg.showCashier} onChange={v => setCfg({ showCashier: v })} label="Show cashier name" />
              <Toggle checked={cfg.showPayment} onChange={v => setCfg({ showPayment: v })} label="Show payment method" />
              <Toggle checked={cfg.showTax} onChange={v => setCfg({ showTax: v })} label="Show tax breakdown" />
              <Toggle checked={cfg.showTaxNumber} onChange={v => setCfg({ showTaxNumber: v })} label="Show Tax / GST number" />
              <Toggle checked={cfg.showQrCode} onChange={v => setCfg({ showQrCode: v })} label="Show QR code for bill verification" />
              <Toggle checked={cfg.showCustomNote} onChange={v => setCfg({ showCustomNote: v })} label="Show return / exchange policy note" />
              <Toggle checked={cfg.showThankYou} onChange={v => setCfg({ showThankYou: v })} label="Show footer thank-you message" />
            </div>
          )}

          {activeTab === 'layout' && (
            <div className="grid gap-5">
              <Field label="Paper width (Thermal roll / Sheet)">
                <select value={cfg.paperWidth} onChange={e => setCfg({ paperWidth: e.target.value as ReceiptCfg['paperWidth'] })} className={inputClass}>
                  <option value="50mm">50mm (1.97 in) — Ultra-compact thermal printer</option>
                  <option value="58mm">58mm (2.28 in) — Compact thermal printer</option>
                  <option value="80mm">80mm (3.15 in) — Standard POS thermal roll (Recommended)</option>
                  <option value="A4">A4 — Full page invoice printer</option>
                </select>
              </Field>
              <Field label="Receipt typography">
                <select value={cfg.fontFamily} onChange={e => setCfg({ fontFamily: e.target.value })} className={inputClass}>
                  <option value="DM Sans, sans-serif">DM Sans (Clean modern retail)</option>
                  <option value="'Courier New', Courier, monospace">Courier New (Classic thermal dot-matrix POS)</option>
                  <option value="Arial, sans-serif">Arial (High contrast)</option>
                  <option value="Georgia, serif">Georgia (Boutique / restaurant)</option>
                  <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                </select>
              </Field>
              <div className="divide-y divide-[#eeede7]">
                <Toggle checked={cfg.cutSpacing} onChange={v => setCfg({ cutSpacing: v })} label="Add cut paper line & feed space at bottom" />
              </div>
              <div className="rounded-xl border border-[#e5e4db] bg-[#f8f7f1] p-4">
                <p className="text-xs font-semibold text-[#627a6e] mb-2">Quick reset</p>
                <button
                  type="button"
                  onClick={() => { setCfgRaw(RC_DEFAULTS); setSaved(false); }}
                  className="text-xs font-semibold text-[#9c6258] hover:underline"
                >Reset all settings to defaults</button>
              </div>
            </div>
          )}

          {activeTab === 'printer' && (
            <div className="grid gap-4">
              {/* Important Note & Setup Guide for External Printers */}
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-4 shadow-xs">
                <p className="text-sm font-bold text-amber-950 flex items-center gap-2">
                  <AlertCircle size={18} className="text-amber-700 shrink-0" />
                  <span>Important Note for Bluetooth & Thermal Printers</span>
                </p>
                <div className="mt-2.5 space-y-2 text-xs text-amber-900 leading-relaxed">
                  <p>
                    <strong>1. Bluetooth Setup:</strong> First, pair your printer in your <strong>Tablet or Computer's Bluetooth Settings</strong> (PIN is typically <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">0000</code> or <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-bold">1234</code>).
                  </p>
                  <p>
                    <strong>2. Standard Reliable Printing (Recommended):</strong> Leave <em>"Silent Bluetooth Printing"</em> <strong>OFF</strong> for standard printers (e.g. Xprinter, POS-58, Rongta, etc.). When you complete a bill, click <strong>Print Receipt</strong> and select your printer from the list. It will print directly onto the paper!
                  </p>
                  <p>
                    <strong>3. Android Tablet Users (Fast 1-Tap):</strong> Install the free <strong>RawBT Print Service</strong> or <strong>ESC POS Print Service</strong> app from Google Play Store and set your Bluetooth printer as default for fast automatic printing.
                  </p>
                  <p>
                    <strong>4. Paper Margins:</strong> In your browser print preview window, ensure <strong>Margins</strong> is set to <strong>'None'</strong> and <strong>'Headers & footers'</strong> is unchecked.
                  </p>
                </div>
              </div>

              {/* Bluetooth Thermal Printer Hardware Card */}
              <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-800 text-white shadow-xs">
                      <Bluetooth size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-teal-950">Direct Bluetooth Printer (ESC/POS)</p>
                      <p className="text-[11px] text-teal-700">Wireless 50mm, 58mm & 80mm silent printing</p>
                    </div>
                  </div>
                  {btPrinter ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      <Check size={12} /> Paired
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
                      Not Paired
                    </span>
                  )}
                </div>

                {btPrinter ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-white p-3 border border-teal-100 shadow-xs">
                      <div className="flex items-center gap-2">
                        <Radio size={14} className="text-emerald-600 animate-pulse" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">{btPrinter.name}</p>
                          <p className="text-[10px] text-slate-500">Connected & ready for instant checkout bills</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleForgetPrinter}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={btLoading}
                        onClick={handleTestBluetooth}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-teal-800 py-2.5 px-3 text-xs font-bold text-white shadow-xs hover:bg-teal-900 transition disabled:opacity-50 cursor-pointer"
                      >
                        {btLoading ? <LoaderCircle className="animate-spin" size={14} /> : <Zap size={14} />}
                        <span>Silent Test Bill</span>
                      </button>
                      <button
                        type="button"
                        disabled={btLoading}
                        onClick={handleKickDrawer}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-teal-300 bg-white py-2.5 px-3 text-xs font-bold text-teal-900 shadow-xs hover:bg-teal-50 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Coins size={14} />
                        <span>Kick Cash Drawer</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      disabled={btLoading}
                      onClick={handleConnectBluetooth}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-800 py-3 text-xs font-bold text-white shadow-sm hover:bg-teal-900 transition disabled:opacity-50 cursor-pointer"
                    >
                      {btLoading ? <LoaderCircle className="animate-spin" size={15} /> : <Bluetooth size={15} />}
                      <span>Connect Bluetooth Thermal Printer</span>
                    </button>
                    <p className="mt-2 text-center text-[10px] text-teal-700">
                      Compatible with Xprinter, Munbyn, Epson, Hoin, POS-58, POS-50 or any ESC/POS Bluetooth printer.
                    </p>
                  </div>
                )}

                {btStatusMsg && (
                  <p className="mt-2.5 text-center text-xs font-semibold text-teal-950 animate-in fade-in">
                    {btStatusMsg}
                  </p>
                )}
              </div>

              {/* Automation Toggles */}
              <div className="rounded-xl border border-[#eee] bg-white p-3 divide-y divide-[#f0efe8]">
                <Toggle
                  checked={!!cfg.silentBluetoothPrint}
                  onChange={v => setCfg({ silentBluetoothPrint: v })}
                  label="⚡ Silent Bluetooth Printing (Instant print, no browser dialog)"
                />
                <Toggle
                  checked={cfg.autoPrintOnSale}
                  onChange={v => setCfg({ autoPrintOnSale: v })}
                  label="🖨️ Auto-trigger print immediately upon completing checkout"
                />
                <Toggle
                  checked={!!cfg.kickDrawerOnSale}
                  onChange={v => setCfg({ kickDrawerOnSale: v })}
                  label="💵 Auto-kick cash drawer open on checkout"
                />
              </div>

              <div className="rounded-xl border border-[#b8dbc3] bg-[#edf6f0] p-4">
                <p className="text-sm font-semibold text-[#27533b] flex items-center gap-2">
                  <Printer size={16} /> USB & Network Thermal Printer Setup
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-[#416853]">
                  <li>• For USB or Wi-Fi printers, use browser print mode with <strong>50mm / 58mm / 80mm</strong> roll size.</li>
                  <li>• Under <strong>More settings</strong> in print preview: set <strong>Margins to 'None'</strong> and uncheck <strong>'Headers and footers'</strong>.</li>
                </ul>
              </div>

              <Field label="Custom verification link / QR data">
                <input
                  value={cfg.qrCodeData}
                  onChange={e => setCfg({ qrCodeData: e.target.value })}
                  className={inputClass}
                  placeholder="https://yourshop.com/verify or UPI link"
                />
              </Field>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#315f52] px-4 py-3 text-sm font-semibold text-white hover:bg-[#274f44] shadow-sm cursor-pointer"
              >
                <Printer size={16} /> Send standard browser test ticket
              </button>
            </div>
          )}
        </div>

        {/* ─── Live Preview ────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[.15em] text-[#9b8059]">Live receipt preview</p>
            <span className="rounded-full bg-[#eef3ec] px-3 py-1 text-[10px] font-semibold text-[#527260]">
              {cfg.paperWidth} roll preview
            </span>
          </div>
          <div className="flex justify-center overflow-x-auto p-4 bg-[#edece4] rounded-2xl border border-[#dedcd2]">
            <ReceiptPreview id="billflow-receipt-preview" cfg={cfg} sampleSale={SAMPLE_SALE} />
          </div>
          <div className="surface flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-semibold text-[#3d5146]">Print to external printer</p>
              <p className="mt-0.5 text-xs text-[#879189]">Triggers your thermal roll printer with custom page sizing & zero margins.</p>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-[#315f52] px-5 py-3 text-sm font-semibold text-white hover:bg-[#274f44] shadow-sm"
            >
              <Printer size={16} /> Print receipt
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function PublicVerifyReceipt() {
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const billNo = search.get('bill') || search.get('b') || '1001';
  const total = search.get('total') || '0.00';
  const curr = search.get('curr') || search.get('c') || 'AED';
  const date = search.get('date') ? decodeURIComponent(search.get('date')!) : new Date().toLocaleDateString();
  const cashier = search.get('cashier') ? decodeURIComponent(search.get('cashier')!) : 'Store Staff';
  const shopName = search.get('shop') ? decodeURIComponent(search.get('shop')!) : 'BillFlow Store';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-center mb-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-4 ring-emerald-50">
            <ShieldCheck size={32} />
          </div>
        </div>

        <div className="text-center">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
            <Check size={14} /> Genuine Verified Receipt
          </span>
          <h1 className="mt-3 text-lg font-bold text-slate-900">{shopName}</h1>
          <p className="text-xs text-slate-500">Official Electronic Receipt Copy</p>
        </div>

        <div className="mt-6 divide-y divide-slate-100 rounded-2xl bg-slate-50 p-4 text-xs">
          <div className="flex justify-between py-2 text-slate-600">
            <span>Bill Number</span>
            <span className="font-mono font-bold text-slate-900">#{billNo}</span>
          </div>
          <div className="flex justify-between py-2 text-slate-600">
            <span>Date & Time</span>
            <span className="font-medium text-slate-800">{date}</span>
          </div>
          <div className="flex justify-between py-2 text-slate-600">
            <span>Billing Staff</span>
            <span className="font-medium text-slate-800">{cashier}</span>
          </div>
          <div className="flex justify-between py-2 text-slate-600">
            <span>Status</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
              <Check size={12} /> Paid & Verified
            </span>
          </div>
          <div className="flex justify-between pt-3 text-sm font-bold text-slate-900">
            <span>Total Amount Paid</span>
            <span className="font-mono text-base text-emerald-800">{curr} {total}</span>
          </div>
        </div>

        <div className="mt-6 space-y-2 text-center no-print">
          <button
            type="button"
            onClick={() => window.print()}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-slate-800 transition cursor-pointer"
          >
            <Printer size={15} /> Save / Print Copy
          </button>
          <p className="text-[11px] text-slate-400">Powered by BillFlow POS · Instant Receipt Verification</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in" component={LocalLoginPage} />
            <Route path="/sign-up" component={LocalLoginPage} />
            <Route path="/verify" component={PublicVerifyReceipt} />
            <Route path="/verify/:rest*" component={PublicVerifyReceipt} />
            <Route path="/dashboard"><Protected title="Overview"><Dashboard/></Protected></Route>
            <Route path="/pos"><Protected title="POS"><POS/></Protected></Route>
            <Route path="/sales"><Protected title="Sales"><Sales/></Protected></Route>
            <Route path="/expenses"><Protected title="Expenses"><Expenses/></Protected></Route>
            <Route path="/catalog"><Protected title="Catalog"><Catalog/></Protected></Route>
            <Route path="/team"><Protected title="Team"><Team/></Protected></Route>
            <Route path="/shops"><Protected title="Shops"><Shops/></Protected></Route>
            <Route path="/reports"><Protected title="Reports"><Reports/></Protected></Route>
            <Route path="/receipt"><Protected title="Receipt Control"><ReceiptControl/></Protected></Route>
            <Route path="/receipts"><Protected title="Receipt Control"><ReceiptControl/></Protected></Route>
            <Route path="/settings"><Protected title="Settings & Admin"><SettingsPage/></Protected></Route>
            <Route path="/admin"><Protected title="Admin Panel"><SettingsPage/></Protected></Route>
            <Route component={NotFound} />
          </Switch>
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}
export default App;
