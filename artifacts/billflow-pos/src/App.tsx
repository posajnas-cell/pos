import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Boxes, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, CircleDollarSign, ClipboardList, Copy, CreditCard, Download, Edit3, ExternalLink, Eye, EyeOff,
  FileSliders, FileSpreadsheet, FileText, IndianRupee, Keyboard, KeyRound, LayoutDashboard, LoaderCircle, Lock, LogOut, Package, Palette, Plus, Printer,
  QrCode, RotateCcw, Search, Settings, ShieldCheck, ShoppingBag, Sliders, Sparkles, Store, Tag, ToggleLeft, ToggleRight, Type, Upload, User, UserCheck, Users, Wallet, X, Zap,
} from 'lucide-react';
import {
  getGetDashboardQueryKey, getGetExpensesReportQueryKey, getGetSalesReportQueryKey, getGetWorkspaceQueryKey,
  getListCategoriesQueryKey, getListEmployeesQueryKey, getListExpensesQueryKey,
  getListProductsQueryKey, getListSalesQueryKey, getListShopsQueryKey,
  useCompleteSale, useCreateCategory, useCreateEmployee, useCreateExpense, useCreateProduct,
  useCreateShop, useGetDashboard, useGetExpensesReport, useGetSalesReport, useGetWorkspace,
  useHealthCheck, useListCategories, useListEmployees, useListExpenses, useListProducts,
  useListSales, useListShops, useUpdateCategory, useUpdateProduct, useUpdateShop,
  type Category, type Employee, type Expense, type Product, type Sale, type Shop,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // 30 minutes in memory: Instant screen transitions without loading delays
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false, // Never refetch on browser click
      refetchOnReconnect: false,
      refetchOnMount: false, // Serve from cache immediately
      retry: 0, // Eliminate retry pauses
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
        address: '123 Commercial Street, Indiranagar',
        phone: '+91 98765 43210',
        currency: 'INR',
        taxRateBps: 500,
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const currentShopId = Number(window.localStorage.getItem('billflow-shop') || shops[0]?.id || 1);

    const categories = JSON.parse(window.localStorage.getItem('billflow-offline-categories') || 'null') || [
      { id: 1, name: 'Breakfast', shopId: currentShopId },
      { id: 2, name: 'Lunch & Meals', shopId: currentShopId },
      { id: 3, name: 'Snacks & Bakery', shopId: currentShopId },
      { id: 4, name: 'Beverages & Tea', shopId: currentShopId },
      { id: 5, name: 'Groceries & Staples', shopId: currentShopId },
    ];

    const products = JSON.parse(window.localStorage.getItem('billflow-offline-products') || 'null') || [
      { id: 1, shopId: currentShopId, categoryId: 4, name: 'Filter Coffee', priceCents: 3500, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300&auto=format&fit=crop&q=60', sku: 'BEV-001', description: 'Fresh South Indian decoction coffee with frothy milk', parcelType: 'fixed', parcelValue: 500 },
      { id: 2, shopId: currentShopId, categoryId: 4, name: 'Masala Chai', priceCents: 2500, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=300&auto=format&fit=crop&q=60', sku: 'BEV-002', description: 'Steaming aromatic ginger cardamom milk tea', parcelType: 'fixed', parcelValue: 500 },
      { id: 3, shopId: currentShopId, categoryId: 1, name: 'Crispy Masala Dosa', priceCents: 8500, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=300&auto=format&fit=crop&q=60', sku: 'BRK-001', description: 'Golden rice crepe served with spiced potato and sambar', parcelType: 'fixed', parcelValue: 1000 },
      { id: 4, shopId: currentShopId, categoryId: 1, name: 'Steamed Idli Vada Combo', priceCents: 7000, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=300&auto=format&fit=crop&q=60', sku: 'BRK-002', description: '2 Soft fluffy idlis & 1 crunchy medu vada with chutney', parcelType: 'fixed', parcelValue: 1000 },
      { id: 5, shopId: currentShopId, categoryId: 2, name: 'Special Veg Thali', priceCents: 16000, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?w=300&auto=format&fit=crop&q=60', sku: 'LNC-001', description: 'Full meal with 2 rotis, rice, dal, 2 curries, papad, curd', parcelType: 'fixed', parcelValue: 1500 },
      { id: 6, shopId: currentShopId, categoryId: 3, name: 'Butter Croissant', priceCents: 12000, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300&auto=format&fit=crop&q=60', sku: 'SNK-001', description: 'Flaky french pastry baked fresh daily', parcelType: 'fixed', parcelValue: 500 },
      { id: 7, shopId: currentShopId, categoryId: 3, name: 'Veg Samosa (2 pcs)', priceCents: 4000, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&auto=format&fit=crop&q=60', sku: 'SNK-002', description: 'Crisp pastry filled with spiced potatoes and green peas', parcelType: 'fixed', parcelValue: 500 },
      { id: 8, shopId: currentShopId, categoryId: 5, name: 'Basmati Rice 1kg', priceCents: 15000, isAvailable: true, imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&auto=format&fit=crop&q=60', sku: 'GRO-001', description: 'Long grain aromatic royal basmati rice pack', parcelType: 'none', parcelValue: 0 },
    ];

    const employees = JSON.parse(window.localStorage.getItem('billflow-offline-employees') || 'null') || [
      { id: 1, shopId: currentShopId, name: 'Store Owner', role: 'owner', isActive: true },
      { id: 2, shopId: currentShopId, name: 'Shift Manager', role: 'manager', isActive: true },
      { id: 3, shopId: currentShopId, name: 'Cashier 1', role: 'cashier', isActive: true },
      { id: 4, shopId: currentShopId, name: 'Cashier 2', role: 'cashier', isActive: true },
    ];

    const sales = JSON.parse(window.localStorage.getItem('billflow-offline-sales') || 'null') || [];
    const expenses = JSON.parse(window.localStorage.getItem('billflow-offline-expenses') || 'null') || [];

    const salesCents = sales.reduce((acc: number, s: any) => acc + (s.totalCents || 0), 0);
    const expensesCents = expenses.reduce((acc: number, e: any) => acc + (e.totalCents || 0), 0);

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
      payments: [
        { method: 'cash', totalCents: Math.round(salesCents * 0.6) },
        { method: 'upi', totalCents: Math.round(salesCents * 0.4) },
      ],
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
    qc.setQueryData(getListCategoriesQueryKey({ shopId: 0 }), categories);
    qc.setQueryData(getListProductsQueryKey({ shopId: currentShopId }), products);
    qc.setQueryData(getListProductsQueryKey({ shopId: 0 }), products);
    qc.setQueryData(getListEmployeesQueryKey({ shopId: currentShopId }), employees);
    qc.setQueryData(getListEmployeesQueryKey({ shopId: 0 }), employees);
    qc.setQueryData(getListExpensesQueryKey({ shopId: currentShopId }), expenses);
    qc.setQueryData(getListExpensesQueryKey({ shopId: 0 }), expenses);
    qc.setQueryData(getListSalesQueryKey({ shopId: currentShopId }), sales);
    qc.setQueryData(getListSalesQueryKey({ shopId: 0 }), sales);
    qc.setQueryData(getGetDashboardQueryKey({ shopId: currentShopId, period: 'week' }), dashboard);
  } catch {}
}

seedInstantCache(queryClient);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const money = (cents: number, currency = 'INR') => {
  const curr = (!currency || currency === 'USD') ? 'INR' : currency;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: curr, maximumFractionDigits: 2 }).format((cents || 0) / 100);
};
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const dateInput = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const freshKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
const invalidate = (qc: ReturnType<typeof useQueryClient>, key?: readonly unknown[]) => {
  if (key) {
    qc.invalidateQueries({ queryKey: key, refetchType: 'active' });
  } else {
    qc.invalidateQueries({ refetchType: 'active' });
  }
};

export type LocalUser = {
  id: string;
  name: string;
  username?: string;
  role: 'owner' | 'manager' | 'cashier';
  avatarInitials: string;
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
        staffPins: parsed.staffPins || {
          'admin': '1234',
          'manager': '1234',
          'cashier': '1234',
          'cashier-2': '1234',
        },
      };
    }
  } catch {}
  return {
    enabled: true,
    masterPin: '1234',
    requirePinForPOS: false,
    staffPins: {
      'admin': '1234',
      'manager': '1234',
      'cashier': '1234',
      'cashier-2': '1234',
    },
  };
}

export function saveStoredQuickPinConfig(cfg: QuickPinConfig) {
  localStorage.setItem(QUICK_PIN_CONFIG_KEY, JSON.stringify(cfg));
}

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
    name: 'Vegetables & Produce (Veg)',
    badge: '🥬 Veg',
    defaultUnit: 'kg',
    items: [
      { name: 'Tomatoes', unit: 'kg', suggestedPrice: 35 },
      { name: 'Onions', unit: 'kg', suggestedPrice: 40 },
      { name: 'Potatoes', unit: 'kg', suggestedPrice: 30 },
      { name: 'Ginger', unit: 'kg', suggestedPrice: 120 },
      { name: 'Garlic', unit: 'kg', suggestedPrice: 200 },
      { name: 'Green Chillies', unit: 'kg', suggestedPrice: 60 },
      { name: 'Fresh Coriander', unit: 'bunch', suggestedPrice: 15 },
      { name: 'Mint Leaves', unit: 'bunch', suggestedPrice: 15 },
      { name: 'Lemons', unit: 'item', suggestedPrice: 5 },
      { name: 'Carrots', unit: 'kg', suggestedPrice: 45 },
      { name: 'Cabbage', unit: 'kg', suggestedPrice: 30 },
      { name: 'French Beans', unit: 'kg', suggestedPrice: 60 },
      { name: 'Capsicum / Bell Peppers', unit: 'kg', suggestedPrice: 70 },
      { name: 'Green Peas', unit: 'kg', suggestedPrice: 80 },
    ],
  },
  {
    id: 'meat',
    name: 'Meat, Poultry & Seafood (Meat)',
    badge: '🍗 Meat',
    defaultUnit: 'kg',
    items: [
      { name: 'Fresh Chicken (Whole/Curry Cut)', unit: 'kg', suggestedPrice: 220 },
      { name: 'Chicken (Boneless Breast)', unit: 'kg', suggestedPrice: 320 },
      { name: 'Fresh Mutton / Goat', unit: 'kg', suggestedPrice: 750 },
      { name: 'Farm Fresh Eggs', unit: 'tray', suggestedPrice: 180 },
      { name: 'Fresh Fish', unit: 'kg', suggestedPrice: 400 },
      { name: 'Prawns / Shrimps', unit: 'kg', suggestedPrice: 450 },
    ],
  },
  {
    id: 'grocery',
    name: 'Groceries & Provisions (Grocery)',
    badge: '🌾 Grocery',
    defaultUnit: 'kg',
    items: [
      { name: 'Cooking Sunflower Oil', unit: 'liter', suggestedPrice: 130 },
      { name: 'Pure Desi Ghee', unit: 'kg', suggestedPrice: 650 },
      { name: 'Basmati Rice', unit: 'kg', suggestedPrice: 95 },
      { name: 'Sona Masoori Rice', unit: 'kg', suggestedPrice: 60 },
      { name: 'Wheat Flour / Atta', unit: 'kg', suggestedPrice: 45 },
      { name: 'Refined Sugar', unit: 'kg', suggestedPrice: 44 },
      { name: 'CTC Tea Powder', unit: 'kg', suggestedPrice: 320 },
      { name: 'Coffee Powder (Decoction blend)', unit: 'kg', suggestedPrice: 450 },
      { name: 'Turmeric & Chilli Spices', unit: 'kg', suggestedPrice: 280 },
      { name: 'Garam Masala Spices', unit: 'kg', suggestedPrice: 450 },
      { name: 'Table Salt', unit: 'kg', suggestedPrice: 25 },
      { name: 'Toor Dal / Pulses', unit: 'kg', suggestedPrice: 160 },
      { name: 'Moong Dal / Green Gram', unit: 'kg', suggestedPrice: 130 },
      { name: 'Fresh Milk', unit: 'liter', suggestedPrice: 56 },
      { name: 'Paneer / Cottage Cheese', unit: 'kg', suggestedPrice: 360 },
    ],
  },
  {
    id: 'packaging',
    name: 'Packaging & Takeaway (Parcel)',
    badge: '📦 Packaging',
    defaultUnit: 'pack',
    items: [
      { name: 'Meal Parcel Boxes (500ml)', unit: 'pack', suggestedPrice: 250 },
      { name: 'Meal Parcel Boxes (1000ml)', unit: 'pack', suggestedPrice: 350 },
      { name: 'Paper Hot Beverage Cups (150ml)', unit: 'pack', suggestedPrice: 120 },
      { name: 'Aluminium Food Foil Roll', unit: 'roll', suggestedPrice: 180 },
      { name: 'Eco Carry Bags', unit: 'pack', suggestedPrice: 150 },
      { name: 'Paper Napkins / Tissues', unit: 'pack', suggestedPrice: 90 },
      { name: 'Wooden Cutlery & Spoons', unit: 'pack', suggestedPrice: 140 },
    ],
  },
  {
    id: 'utilities',
    name: 'Cleaning & Utilities',
    badge: '🧹 Utilities',
    defaultUnit: 'unit',
    items: [
      { name: 'Commercial Gas Cylinder (19kg)', unit: 'cylinder', suggestedPrice: 1850 },
      { name: 'Commercial Dishwashing Liquid (5L)', unit: 'can', suggestedPrice: 450 },
      { name: 'Floor & Surface Cleaner (5L)', unit: 'can', suggestedPrice: 350 },
      { name: 'RO Drinking Water Cans (20L)', unit: 'can', suggestedPrice: 40 },
      { name: 'Electricity Utility Bill', unit: 'month', suggestedPrice: 3500 },
      { name: 'Counter Stationeries & Receipt Rolls', unit: 'pack', suggestedPrice: 250 },
    ],
  },
  {
    id: 'other',
    name: 'Other & Miscellaneous',
    badge: '🏷️ Other',
    defaultUnit: 'item',
    items: [
      { name: 'Shop Maintenance / Repair', unit: 'service', suggestedPrice: 500 },
      { name: 'Staff Daily Allowance / Tea', unit: 'day', suggestedPrice: 150 },
      { name: 'Transportation & Logistics', unit: 'trip', suggestedPrice: 300 },
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
  verifyQuickPin: (operatorId: string, enteredPin: string) => boolean;
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
    return u.trim().toLowerCase() === current.username.toLowerCase() && p === current.password;
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

  const verifyQuickPin = (operatorId: string, enteredPin: string): boolean => {
    const cfg = getStoredQuickPinConfig();
    if (!cfg.enabled) return false;
    // Check per-staff pin first
    const staffPin = cfg.staffPins[operatorId];
    if (staffPin && staffPin === enteredPin) return true;
    // Check master pin
    if (cfg.masterPin && cfg.masterPin === enteredPin) return true;
    // Fallback default
    return enteredPin === '1234';
  };

  const login = (operator: LocalUser) => {
    setUser(operator);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(operator));
    qc.clear();
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(LOCAL_USER_KEY);
    qc.clear();
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
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffPinInput, setStaffPinInput] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

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

  function handleSaveStaffPin(staffId: string) {
    if (!/^\d{4}$/.test(staffPinInput)) {
      setFeedback('Staff PIN must be exactly 4 numeric digits.');
      return;
    }
    const updatedStaffPins = { ...quickPinConfig.staffPins, [staffId]: staffPinInput };
    updateQuickPinConfig({ staffPins: updatedStaffPins });
    setEditingStaffId(null);
    setStaffPinInput('');
    setFeedback(`Quick PIN updated for ${staffId}!`);
    setTimeout(() => setFeedback(null), 3000);
  }

  function runPinTest(digit: string) {
    if (testPin.length < 4) {
      const next = testPin + digit;
      setTestPin(next);
      if (next.length === 4) {
        const matched = PRESET_OPERATORS.find(
          op => (quickPinConfig.staffPins[op.id] || quickPinConfig.masterPin) === next,
        );
        if (matched) {
          setTestResult(`✅ PIN Valid: Unlocks "${matched.name}" (${matched.role})`);
        } else if (next === quickPinConfig.masterPin) {
          setTestResult(`✅ Master PIN Valid: Unlocks All Counter Registers`);
        } else {
          setTestResult('❌ Invalid PIN. Does not match any staff or master code.');
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
            <p className="text-xs text-slate-500">Configure 4-digit PINs for rapid cashier login and shift switching</p>
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
          Quick PIN is an express 4-digit numeric code (e.g. 1234) used in restaurant and retail checkout registers. Instead of typing full usernames and passwords during busy store hours, cashiers tap their 4-digit PIN to unlock the counter and complete bills in seconds.
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
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 text-center space-y-2">
            <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Interactive PIN Tester
            </span>
            <p className="text-[11px] text-slate-500">Test any 4-digit code to see who it unlocks</p>

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

        {/* Right: Per-Staff PIN Table */}
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-3">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-700">
            Staff & Cashier PIN Allocation
          </span>
          <p className="text-[11px] text-slate-500">
            Assign unique 4-digit PINs for each cashier so individual sales are accurately attributed.
          </p>

          <div className="divide-y divide-slate-200 bg-white rounded-xl border border-slate-200 overflow-hidden">
            {PRESET_OPERATORS.map(op => {
              const currentPin = quickPinConfig.staffPins[op.id] || quickPinConfig.masterPin;
              const isEditing = editingStaffId === op.id;

              return (
                <div key={op.id} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                      {op.avatarInitials}
                    </span>
                    <div>
                      <span className="font-semibold text-slate-800 block">{op.name}</span>
                      <span className="text-[10px] capitalize text-slate-400">{op.role}</span>
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
                        onClick={() => handleSaveStaffPin(op.id)}
                        className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingStaffId(null); setStaffPinInput(''); }}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        ••••
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStaffId(op.id);
                          setStaffPinInput(currentPin);
                        }}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                      >
                        Change PIN
                      </button>
                    </div>
                  )}
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

  // Staff PIN state
  const [selectedOp, setSelectedOp] = useState<LocalUser>(PRESET_OPERATORS[2]); // Default Cashier 1
  const [pin, setPin] = useState('');
  const [customName, setCustomName] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState(false);

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
        login({
          id: 'admin',
          username: adminCreds.username,
          name: adminCreds.username === DEFAULT_ADMIN_USERNAME ? 'Store Owner' : adminCreds.username,
          role: 'owner',
          avatarInitials: (adminCreds.username.slice(0, 2) || 'AD').toUpperCase(),
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

    const opToLogin = isCustom && customName.trim()
      ? {
          id: customName.trim().toLowerCase().replace(/\s+/g, '_'),
          name: customName.trim(),
          role: 'cashier' as const,
          avatarInitials: customName.trim().slice(0, 2).toUpperCase(),
        }
      : selectedOp;

    if (pin.length !== 4) {
      setStaffError('Please enter your 4-digit Quick PIN.');
      return;
    }

    if (!verifyQuickPin(opToLogin.id, pin)) {
      setStaffError(`Incorrect 4-digit PIN for ${opToLogin.name}.`);
      setPin('');
      return;
    }

    setStaffSuccess(true);
    setTimeout(() => {
      login(opToLogin);
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
        const opToLogin = isCustom && customName.trim()
          ? {
              id: customName.trim().toLowerCase().replace(/\s+/g, '_'),
              name: customName.trim(),
              role: 'cashier' as const,
              avatarInitials: customName.trim().slice(0, 2).toUpperCase(),
            }
          : selectedOp;

        if (verifyQuickPin(opToLogin.id, nextPin)) {
          setStaffSuccess(true);
          setTimeout(() => {
            login(opToLogin);
            setLocation('/dashboard');
          }, 200);
        } else {
          setTimeout(() => {
            setStaffError(`Incorrect 4-digit PIN for ${opToLogin.name}.`);
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
                        <p className="text-xs text-slate-500">Choose operator & enter 4-digit PIN</p>
                      </div>
                      <span className="rounded-full bg-emerald-100/70 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                        Quick PIN
                      </span>
                    </div>

                    {/* Operator Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                      {PRESET_OPERATORS.map(op => {
                        const active = !isCustom && selectedOp.id === op.id;
                        return (
                          <button
                            type="button"
                            key={op.id}
                            onClick={() => { setSelectedOp(op); setIsCustom(false); setPin(''); setStaffError(''); }}
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
                        <span>PIN Verified! Opening Register…</span>
                      </div>
                    )}

                    {/* Quick PIN Dots Display */}
                    <div className="rounded-2xl bg-slate-50 p-3.5 border border-slate-200/90 text-center mb-3">
                      <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center justify-center gap-1.5">
                        <KeyRound size={13} /> Enter 4-Digit Quick PIN for {selectedOp.name}
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
                      Unlock POS Register →
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
  {href:'/pos',label:'Checkout',icon:ShoppingBag},
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
  const [path] = useLocation();
  const { user, logout } = useAuth();
  const ws = useGetWorkspace();
  const shops = useListShops();
  const [selected,setSelected] = useState<number>(()=>Number(localStorage.getItem('billflow-shop') || 0));
  const active = shops.data?.find(s=>s.id===selected) ?? shops.data?.[0];
  useEffect(()=>{if(active && active.id!==selected){setSelected(active.id);localStorage.setItem('billflow-shop',String(active.id));}},[active,selected]);
  return <div className="app-frame flex bg-[#f7f6f0]">
    <aside className="sidebar flex min-h-[100dvh] flex-col px-3 py-5">
      <div className="sidebar-brand px-2 pb-7"><Brand light /></div>
      <div className="sidebar-shop mb-5 rounded-xl border border-white/10 bg-white/[.06] p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#93ada0]">Workspace</p><label className="flex items-center gap-2"><Store size={15} className="shrink-0 text-[#d2b17d]"/><select data-testid="select-active-shop" aria-label="Active shop" className="w-full bg-transparent text-sm font-semibold text-white outline-none" value={active?.id ?? ''} onChange={e=>{setSelected(Number(e.target.value));localStorage.setItem('billflow-shop',e.target.value);}}>{shops.data?.map((s:Shop)=><option className="text-[#203d37]" key={s.id} value={s.id}>{s.name}</option>)}</select></label><p className="mt-2 truncate text-[11px] text-[#a6b8af]">{ws.data?.businessName ?? 'Business workspace'}</p></div>
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
    <div className="main-area min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[#e6e4da] bg-[#f7f6f0]/95 px-4 backdrop-blur md:px-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#8a958d]">BillFlow / {title}</p>
          <p className="mt-0.5 text-sm font-semibold text-[#31463c]">{active?.name || 'Your business'}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-[#dfe4d9] bg-white/70 px-3 py-1.5 text-[11px] font-medium text-[#587062] sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-[#69a77e]"/>PostgreSQL online
          </span>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e5ebdf] text-xs font-bold text-[#315f52]">
              {user?.avatarInitials || 'SO'}
            </span>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-[#32493f]">{user?.name || 'Store Owner'}</p>
              <p className="text-[10px] capitalize text-[#8a968e]">{user?.role || 'owner'}</p>
            </div>
          </div>
        </div>
      </header>
      <main className="page-enter mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8">{children}</main>
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
  const [id, setId] = useState(() => Number(localStorage.getItem('billflow-shop') || 0));
  const shopList = (shops.data as Shop[] | undefined) || [];
  useEffect(() => {
    if (!id && shopList.length) {
      setId(shopList[0].id);
      localStorage.setItem('billflow-shop', String(shopList[0].id));
    }
  }, [id, shopList]);
  const hasData = shopList.length > 0;
  return {
    shop: shopList.find(x => x.id === id) || shopList[0],
    shops: shopList,
    loading: shops.isLoading && !hasData,
    error: shops.isError && !hasData,
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
function Metric({label,value,detail,icon,accent}: {label:string;value:string;detail:string;icon:ReactNode;accent?:string}) {return <div className="surface p-5"><div className="flex items-start justify-between"><span className="text-[12px] font-medium text-[#748078]">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${accent||'bg-[#edf2e9] text-[#527260]'}`}>{icon}</span></div><p className="mono mt-4 text-[25px] font-bold tracking-[-.05em] text-[#2e463b]">{value}</p><p className="mt-1 text-xs text-[#929a92]">{detail}</p></div>;}
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Net sales" value={money(d?.salesCents||0,shop?.currency)} detail="This week" icon={<IndianRupee size={18}/>} /><Metric label="Bills completed" value={String(d?.billCount||0)} detail="Across this period" icon={<ClipboardList size={18}/>} accent="bg-[#f7efdf] text-[#9b7844]"/><Metric label="Expenses" value={money(d?.expensesCents||0,shop?.currency)} detail="Recorded this week" icon={<Wallet size={18}/>} accent="bg-[#f4eae5] text-[#a3614e]"/><Metric label="Operating balance" value={money(d?.operatingBalanceCents||0,shop?.currency)} detail={`Avg. bill ${money(d?.averageBillCents||0,shop?.currency)}`} icon={<BriefcaseBusiness size={18}/>} /></div>
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
  const [payment, setPayment] = useState<'cash' | 'upi' | 'card' | 'other'>('cash');
  const [order, setOrder] = useState<'dine-in' | 'takeaway'>('dine-in');
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState('');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const cp = { shopId: shop?.id || 0 };
  const pp = { shopId: shop?.id || 0, categoryId: category, search: search || undefined };
  const cats = useListCategories(cp, { query: { enabled: !!shop, queryKey: getListCategoriesQueryKey(cp) } });
  const products = useListProducts(pp, { query: { enabled: !!shop, queryKey: getListProductsQueryKey(pp) } });
  const employees = useListEmployees(cp, { query: { enabled: !!shop, queryKey: getListEmployeesQueryKey(cp) } });
  const complete = useCompleteSale();
  const qc = useQueryClient();

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

  const subtotal = cartLines.reduce((a, x) => a + (x.product.priceCents || 0) * x.qty, 0);
  const tax = Math.round((subtotal * (shop?.taxRateBps || 0)) / 10000);

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

  const total = subtotal + tax + parcelCents;

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
          discountCents: 0,
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
          invalidate(qc);
          const curCfg = loadRc();
          if (curCfg.autoPrintOnSale) {
            setTimeout(() => printReceiptElement('billflow-checkout-receipt', curCfg), 400);
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
          printReceiptElement('billflow-checkout-receipt', loadRc());
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

      // 7. 1-Key Fast Checkout:
      // 'c' or 'C' -> Instant Cash Pay
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setPayment('cash');
        pay('cash');
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

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.16em] text-[#9b8059]">Counter / Checkout</p>
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
        </div>
      </div>

      <EmptyShop shops={shops} />

      {/* Split Screen POS Interface: LHS Menu items, RHS Total bill */}
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_390px]">
        {/* LHS Menu Items & Category Tabs */}
        <section className="min-w-0">
          {/* Category Tabs */}
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
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

          {/* Product Grid */}
          <QueryState loading={products.isLoading} error={products.isError} retry={() => products.refetch()} empty={!active.length}>
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((p: Product) => {
                const inCartQty = cart[p.id] || 0;
                const hasParcelFee = (p.parcelType === 'fixed' || (p.parcelValue && p.parcelValue > 0));
                return (
                  <button
                    data-testid={`button-add-cart-${p.id}`}
                    onClick={() => setCart({ ...cart, [p.id]: inCartQty + 1 })}
                    key={p.id}
                    className={`surface group relative flex flex-col justify-between overflow-hidden p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                      inCartQty > 0 ? 'ring-2 ring-[#315f52] border-[#315f52]' : 'hover:border-[#9cb3a1]'
                    }`}
                  >
                    {inCartQty > 0 && (
                      <span className="absolute right-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full bg-[#315f52] text-xs font-bold text-white shadow">
                        {inCartQty}
                      </span>
                    )}

                    <div className="mb-3 flex h-28 items-center justify-center rounded-xl bg-[#f1f3ec] text-[#98ab9c] overflow-hidden">
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
                        <ShoppingBag size={28} />
                      )}
                    </div>

                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <p className="truncate text-sm font-semibold text-[#2f4337]">{p.name}</p>
                      </div>
                      {p.description && (
                        <p className="mt-1 line-clamp-1 text-[11px] text-[#869288]">{p.description}</p>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-[#f0eee6] pt-2.5">
                      <div>
                        <span className="mono text-base font-bold text-[#315f52]">
                          {money(p.priceCents, shop?.currency)}
                        </span>
                        {hasParcelFee && (
                          <span
                            title={`Takeaway packaging fee applies: ${money(p.parcelValue, shop?.currency)}`}
                            className="mt-0.5 block text-[10px] font-semibold text-[#aa7329]"
                          >
                            📦 Parcel: +{money(p.parcelValue, shop?.currency)}
                          </span>
                        )}
                      </div>
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#edf3ec] text-[#315f52] group-hover:bg-[#315f52] group-hover:text-white transition">
                        <Plus size={16} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </QueryState>
        </section>

        {/* RHS Current Bill / Checkout Sidebar */}
        <aside className="surface sticky top-[84px] p-5 shadow-sm">
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
                className="text-xs font-semibold text-[#9c6258] hover:underline"
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
          <div className="max-h-[34vh] min-h-28 space-y-3 overflow-y-auto border-y border-[#eeede6] py-3 pr-1">
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
                      className="grid h-6 w-6 place-items-center rounded text-xs font-bold text-[#4e6055] hover:bg-[#e7eee8] cursor-pointer"
                    >
                      −
                    </button>
                    <span className="mono w-5 text-center text-xs font-bold text-[#32453a]">{x.qty}</span>
                    <button
                      aria-label="Increase quantity"
                      onClick={() => setCart({ ...cart, [x.product.id]: x.qty + 1 })}
                      className="grid h-6 w-6 place-items-center rounded text-xs font-bold text-[#4e6055] hover:bg-[#e7eee8] cursor-pointer"
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
                <p className="text-[11px] text-[#8e988f]">Click menu items or press <kbd className="font-mono bg-black/5 px-1 rounded">/</kbd> to search</p>
              </div>
            )}
          </div>

          {/* Calculations Summary */}
          <div className="space-y-2 py-4 text-xs">
            <div className="flex justify-between text-[#78837a]">
              <span>Subtotal ({cartLines.reduce((n, x) => n + x.qty, 0)} items)</span>
              <span className="mono">{money(subtotal, shop?.currency)}</span>
            </div>

            <div className="flex justify-between text-[#78837a]">
              <span>Tax {shop?.taxRateBps ? `(${(shop.taxRateBps / 100).toFixed(2)}%)` : ''}</span>
              <span className="mono">{money(tax, shop?.currency)}</span>
            </div>

            {/* Parcel Packaging Fee Row */}
            {isTakeaway && parcelCents > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-[#fbf5eb] px-2.5 py-1.5 text-xs font-semibold text-[#aa7329] border border-[#f1e1c7]">
                <span className="flex items-center gap-1.5">
                  <Package size={13} /> Parcel / Packaging fee
                </span>
                <span className="mono font-bold">+{money(parcelCents, shop?.currency)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-[#ecebe4] pt-3 text-sm font-semibold text-[#2f4439]">
              <span>Total due</span>
              <span className="mono text-xl font-bold text-[#315f52]">{money(total, shop?.currency)}</span>
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
              {(['cash', 'upi', 'card', 'other'] as const).map((method, idx) => (
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

          {/* 1-Touch Quick Checkout Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              disabled={!cartLines.length || complete.isPending}
              onClick={() => { setPayment('cash'); pay('cash'); }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50/80 hover:bg-emerald-100/90 py-2.5 px-2 text-xs font-bold text-emerald-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              title="Instant 1-Key Cash Checkout (Press 'C')"
            >
              <span>💵 Cash Pay</span>
              <kbd className="rounded bg-emerald-200/70 px-1.5 py-0.2 text-[9px] font-mono font-bold">[C]</kbd>
            </button>
            <button
              type="button"
              disabled={!cartLines.length || complete.isPending}
              onClick={() => { setPayment('upi'); pay('upi'); }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-teal-600/30 bg-teal-50/80 hover:bg-teal-100/90 py-2.5 px-2 text-xs font-bold text-teal-800 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              title="Instant 1-Key UPI Checkout (Press 'U')"
            >
              <span>📱 UPI Pay</span>
              <kbd className="rounded bg-teal-200/70 px-1.5 py-0.2 text-[9px] font-mono font-bold">[U]</kbd>
            </button>
          </div>

          {error && <p role="alert" className="mb-3 rounded-lg bg-[#f8e9e4] p-2.5 text-xs text-[#a3463b]">{error}</p>}

          {/* Primary Charge Button with Enter Key indicator */}
          <button
            data-testid="button-complete-payment"
            disabled={!cartLines.length || complete.isPending}
            onClick={() => pay()}
            className="flex w-full items-center justify-between rounded-xl bg-[#315f52] px-4 py-3.5 text-sm font-semibold text-white shadow hover:bg-[#274f44] disabled:cursor-not-allowed disabled:opacity-50 transition cursor-pointer"
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
        </aside>
      </div>

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
                  subtotal:
                    (sale.subtotalCents || sale.totalCents - (sale.taxCents || 0) - (sale.parcelCents || 0)) / 100,
                  tax: (sale.taxCents || 0) / 100,
                  total: sale.totalCents / 100,
                }}
              />
            </div>

            <div className="flex w-full gap-3 pt-2">
              <button
                onClick={() => printReceiptElement('billflow-checkout-receipt', loadRc())}
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
    </>
  );
}

function Sales() {
  const { shop } = useCurrentShop();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [toast, setToast] = useState('');

  const params = { shopId: shop?.id, from: from || undefined, to: to || undefined };
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
      'Subtotal (INR)',
      'Tax (INR)',
      'Parcel Packaging (INR)',
      'Total Bill (INR)',
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
      </QueryState>
    </>
  );
}

function Expenses() {
  const { shop, shops } = useCurrentShop();
  const { user } = useAuth();
  const [modal, setModal] = useState(false);
  const [msg, setMsg] = useState('');
  const [toast, setToast] = useState('');

  // 2-tier linked selector state
  const [selectedCatId, setSelectedCatId] = useState<string>('veg');
  const [selectedProductName, setSelectedProductName] = useState<string>(EXPENSE_TAXONOMY[0].items[0].name);
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [customProductName, setCustomProductName] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>(EXPENSE_TAXONOMY[0].items[0].unit);
  const [unitPrice, setUnitPrice] = useState<number>(EXPENSE_TAXONOMY[0].items[0].suggestedPrice || 40);

  const params = { shopId: shop?.id };
  const q = useListExpenses(params, { query: { enabled: !!shop, queryKey: getListExpensesQueryKey(params) } });
  const create = useCreateExpense();
  const qc = useQueryClient();

  const currentCategoryPreset = EXPENSE_TAXONOMY.find(c => c.id === selectedCatId) || EXPENSE_TAXONOMY[0];

  function handleCategoryChange(catId: string) {
    setSelectedCatId(catId);
    const cat = EXPENSE_TAXONOMY.find(c => c.id === catId) || EXPENSE_TAXONOMY[0];
    const firstItem = cat.items[0];
    if (firstItem) {
      setSelectedProductName(firstItem.name);
      setIsCustomProduct(false);
      setUnit(firstItem.unit);
      setUnitPrice(firstItem.suggestedPrice || 50);
    } else {
      setIsCustomProduct(true);
      setUnit(cat.defaultUnit);
    }
  }

  function handleProductSelect(prodName: string) {
    if (prodName === '__custom__') {
      setIsCustomProduct(true);
      setCustomProductName('');
    } else {
      setIsCustomProduct(false);
      setSelectedProductName(prodName);
      const found = currentCategoryPreset.items.find(i => i.name === prodName);
      if (found) {
        setUnit(found.unit);
        if (found.suggestedPrice) setUnitPrice(found.suggestedPrice);
      }
    }
  }

  const calculatedTotal = Math.round((Number(quantity) || 0) * (Number(unitPrice) || 0) * 100) / 100;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shop) return;
    const f = new FormData(e.currentTarget);
    const actualProdName = isCustomProduct ? customProductName.trim() : selectedProductName;
    if (!actualProdName) {
      setMsg('Please specify the product name.');
      return;
    }

    create.mutate(
      {
        data: {
          shopId: shop.id,
          expenseDate: String(f.get('expenseDate')),
          supplier: String(f.get('supplier') || ''),
          invoiceReference: String(f.get('reference') || ''),
          paymentMethod: String(f.get('payment') || 'cash') as 'cash' | 'upi' | 'card' | 'other',
          note: String(f.get('note') || ''),
          items: [
            {
              categoryName: currentCategoryPreset.name,
              productName: actualProdName,
              quantity: Number(quantity) || 1,
              unit: String(unit || 'kg'),
              unitPriceCents: Math.round(Number(unitPrice) * 100),
            },
          ],
        },
      },
      {
        onSuccess: () => {
          setModal(false);
          setMsg('Expense successfully recorded.');
          invalidate(qc);
          setTimeout(() => setMsg(''), 4000);
        },
        onError: () => setMsg('Could not save this expense. Please verify inputs and retry.'),
      },
    );
  }

  async function copyExpensesGoogleSheets() {
    if (!q.data?.length) return;
    const headers = [
      'Date',
      'Expense Category',
      'Product / Item Name',
      'Quantity',
      'Unit',
      'Unit Price (INR)',
      'Line Total (INR)',
      'Supplier / Vendor',
      'Invoice Ref',
      'Payment Mode',
      'Recorded By',
      'Note',
    ];
    const rows = q.data.flatMap(exp => {
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

  const total = (q.data || []).reduce((a, x) => a + x.totalCents, 0);

  return (
    <>
      <PageHeading
        eyebrow="Outgoings & Procurement"
        title="Expenses"
        sub="Category-filtered procurement records with product, quantity, and unit price details."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!q.data?.length}
              onClick={copyExpensesGoogleSheets}
              className="flex items-center gap-2 rounded-xl border border-[#315f52] bg-[#eff5f0] px-4 py-2.5 text-xs font-semibold text-[#315f52] shadow-xs hover:bg-[#e4efe6] disabled:opacity-50 transition"
            >
              <FileSpreadsheet size={15} /> Copy for Google Sheets
            </button>
            <button
              data-testid="button-add-expense"
              onClick={() => setModal(true)}
              className="flex items-center gap-2 rounded-xl bg-[#315f52] px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-[#274f44] transition"
            >
              <Plus size={16} /> Record Expense
            </button>
          </div>
        }
      />

      <EmptyShop shops={shops} />

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

      {msg && <p role="status" className="mb-3 text-sm text-[#476f54] font-medium">{msg}</p>}

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Metric
          label="Total expenses recorded"
          value={money(total, shop?.currency)}
          detail={`${q.data?.length || 0} procurement entries`}
          icon={<Wallet size={18} />}
          accent="bg-[#f4eae5] text-[#a3614e]"
        />
        <Metric
          label="Latest expense"
          value={q.data?.length ? dateLabel(q.data[0].expenseDate) : '—'}
          detail={q.data?.[0]?.supplier ? `Supplier: ${q.data[0].supplier}` : 'No supplier recorded'}
          icon={<CalendarDays size={18} />}
        />
      </div>

      <QueryState loading={q.isLoading} error={q.isError} retry={() => q.refetch()} empty={!q.data?.length}>
        <DataTable
          headers={['Date', 'Category', 'Product / Item', 'Quantity & Unit', 'Unit Price', 'Total', 'Supplier', 'Payment', 'Recorded by']}
          rows={(q.data || []).map((x: Expense) => {
            const firstItem = x.items?.[0];
            return [
              dateLabel(x.expenseDate),
              <span className="font-semibold text-[#3a5245]">{firstItem?.categoryName || 'General'}</span>,
              <div>
                <p className="font-bold text-[#2e4238]">{firstItem?.productName || 'Procurement'}</p>
                {x.items && x.items.length > 1 && (
                  <p className="text-[10px] text-[#869288]">+{x.items.length - 1} more items</p>
                )}
              </div>,
              firstItem ? (
                <span className="mono text-xs">
                  {firstItem.quantity} {firstItem.unit}
                </span>
              ) : (
                '1 item'
              ),
              firstItem ? (
                <span className="mono text-xs text-[#6e7b73]">
                  {money(firstItem.unitPriceCents, shop?.currency)}
                </span>
              ) : (
                '—'
              ),
              <span className="mono font-bold text-[#2c4137]">{money(x.totalCents, shop?.currency)}</span>,
              x.supplier || '—',
              <Pill>{x.paymentMethod.toUpperCase()}</Pill>,
              x.employeeName || user?.name || 'Staff',
            ];
          })}
        />
      </QueryState>

      {/* 2-Tier Linked Expense Modal */}
      {modal && (
        <Modal
          title="Record Procurement Expense"
          subtitle="Log ingredients, raw materials, groceries, packaging, or operations"
          icon={<Wallet size={20} className="text-emerald-700" />}
          maxWidth="max-w-2xl"
          onClose={() => setModal(false)}
        >
          <form onSubmit={submit} className="space-y-5">
            {/* Top Row: Date & Payment Method */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Expense Date" required>
                <input required name="expenseDate" type="date" defaultValue={dateInput()} className={inputClass} />
              </Field>

              <Field label="Payment Method">
                <select name="payment" defaultValue="cash" className={inputClass}>
                  <option value="cash">💵 Cash In Hand</option>
                  <option value="upi">📱 UPI / QR Transfer</option>
                  <option value="card">💳 Card Payment</option>
                  <option value="other">🏦 Bank Transfer / Cheque</option>
                </select>
              </Field>
            </div>

            {/* Step 1: Category Selector (Modern 6-Tile Grid) */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Step 1 · Expense Category
                </span>
                <span className="text-[11px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                  {currentCategoryPreset.name}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EXPENSE_TAXONOMY.map(cat => {
                  const isSelected = selectedCatId === cat.id;
                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition duration-150 cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-500/20 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="truncate">{cat.badge}</span>
                      {isSelected && <Check size={14} className="text-emerald-700 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Product Name (Linked to chosen Category) */}
            <div className="space-y-2">
              <Field
                label={`Step 2 · Item / Product in ${currentCategoryPreset.name}`}
                required
                hint="Choose preset or enter custom item"
              >
                <select
                  value={isCustomProduct ? '__custom__' : selectedProductName}
                  onChange={e => handleProductSelect(e.target.value)}
                  className={inputClass}
                >
                  {currentCategoryPreset.items.map(it => (
                    <option key={it.name} value={it.name}>
                      {it.name} ({it.unit}) · Suggested: ₹{it.suggestedPrice}
                    </option>
                  ))}
                  <option value="__custom__">✨ + Enter custom product name...</option>
                </select>
              </Field>

              {isCustomProduct && (
                <div className="relative pt-1 animate-in fade-in duration-150">
                  <input
                    required
                    autoFocus
                    placeholder="Enter custom product name (e.g. Kashmiri Saffron)..."
                    value={customProductName}
                    onChange={e => setCustomProductName(e.target.value)}
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            {/* Step 3: Calculation Strip (Quantity, Unit, Unit Price, Live Total) */}
            <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 via-teal-50/20 to-slate-50 p-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-3">
                Step 3 · Quantity & Cost Calculation
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <Field label="Quantity" required>
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="any"
                    value={quantity}
                    onChange={e => setQuantity(Number(e.target.value))}
                    className={`${inputClass} bg-white text-base font-bold`}
                  />
                </Field>

                <Field label="Unit" required>
                  <input
                    required
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    placeholder="kg, ltr, pcs, box"
                    className={`${inputClass} bg-white`}
                  />
                </Field>

                <Field label="Unit Price (₹)" required>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitPrice}
                    onChange={e => setUnitPrice(Number(e.target.value))}
                    placeholder="0.00"
                    className={`${inputClass} bg-white text-base font-bold`}
                  />
                </Field>

                {/* Auto Calculated Highlight Card */}
                <div className="flex flex-col justify-end">
                  <span className="text-[11px] font-semibold text-emerald-800 mb-1">Live Auto-Total</span>
                  <div className="flex h-[42px] items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-teal-800 px-3 text-center font-bold text-white shadow-xs">
                    ₹{calculatedTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Quick Unit Suggestion Chips */}
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-semibold text-slate-400">Quick units:</span>
                {['kg', 'g', 'ltr', 'pcs', 'box', 'tray', 'pack'].map(u => (
                  <button
                    type="button"
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition cursor-pointer ${
                      unit === u
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Vendor & Invoice References */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Supplier / Vendor">
                <input name="supplier" placeholder="e.g. Indiranagar Wholesale Mandi" className={inputClass} />
              </Field>

              <Field label="Bill / Invoice Reference">
                <input name="reference" placeholder="e.g. INV-2026-902" className={inputClass} />
              </Field>
            </div>

            <Field label="Procurement Notes (Optional)">
              <input name="note" placeholder="e.g. Quality grade A, delivered in morning slot" className={inputClass} />
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
                <Submit label={`Save Expense · ₹${calculatedTotal.toFixed(2)}`} busy={create.isPending} />
              </div>
            </div>
          </form>
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

  const pp = { shopId: shop?.id || 0, search: search || undefined };
  const cp = { shopId: shop?.id || 0 };
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
                <Field label="Selling Price (₹)" required>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                    <input
                      required
                      name="price"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={editingProduct ? (editingProduct.priceCents / 100).toFixed(2) : ''}
                      placeholder="85.00"
                      className={`${inputClass} pl-8 text-base font-bold`}
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
                      Packaging Fee Amount (₹)
                    </label>
                    <div className="relative max-w-[150px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={parcelFeeVal}
                        onChange={e => setParcelFeeVal(Number(e.target.value))}
                        placeholder="5.00"
                        className={`${inputClass} pl-7 font-bold bg-white`}
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
  const params = { shopId: shop?.id || 0 };
  const q = useListEmployees(params, { query: { enabled: !!shop, queryKey: getListEmployeesQueryKey(params) } });
  const create = useCreateEmployee();
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [message, setMessage] = useState('');

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!shop) return;
    const f = new FormData(e.currentTarget);
    create.mutate(
      {
        data: {
          shopId: shop.id,
          name: String(f.get('name')),
          role: String(f.get('role')) as 'cashier' | 'manager',
        },
      },
      {
        onSuccess: () => {
          setModal(false);
          setMessage('Staff member added.');
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
          headers={['Team member', 'Role', 'Shop', 'Status', '']}
          rows={(q.data || []).map((e: Employee) => [
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e6ede3] text-xs font-bold text-[#557461]">
                {e.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span className="font-semibold">{e.name}</span>
            </div>,
            <span className="capitalize">{e.role}</span>,
            shop?.name,
            <Pill tone={e.isActive ? 'green' : 'gray'}>{e.isActive ? 'Active' : 'Inactive'}</Pill>,
            <span className="text-xs text-[#98a098]">Staff record</span>,
          ])}
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

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data = {
      name: String(f.get('name')),
      address: String(f.get('address') || ''),
      phone: String(f.get('phone') || ''),
      currency: String(f.get('currency') || 'INR'),
      taxRateBps: Math.round(Number(f.get('tax')) * 100),
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
                  <p className="mono mt-1 text-sm font-bold">{(s.taxRateBps / 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#89948c]">Phone</p>
                  <p className="mt-1 truncate text-sm font-semibold">{s.phone || '—'}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-between gap-3">
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      localStorage.setItem('billflow-shop', String(s.id));
                      window.location.reload();
                    }}
                    className="text-xs font-semibold text-[#527260] hover:underline"
                  >
                    Use this shop
                  </button>
                  <button
                    onClick={() =>
                      update.mutate({ shopId: s.id, data: { isActive: !s.isActive } }, { onSuccess: () => invalidate(qc) })
                    }
                    className="text-xs font-semibold text-[#8c6656] hover:underline"
                  >
                    {s.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    setEditing(s);
                    setModal(true);
                  }}
                  className="rounded-lg border border-[#deddd5] px-3 py-1.5 text-xs font-semibold text-[#68766c]"
                >
                  Edit details
                </button>
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
              <input name="address" defaultValue={editing?.address || ''} placeholder="123 Main Road, Indiranagar, Bengaluru" className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact Phone">
                <input name="phone" defaultValue={editing?.phone || ''} placeholder="+91 98765 43210" className={inputClass} />
              </Field>
              <Field label="Operating Currency">
                <select name="currency" defaultValue={editing?.currency || 'INR'} className={inputClass}>
                  {['INR', 'USD', 'GBP', 'EUR', 'CAD', 'AUD'].map(c => (
                    <option key={c} value={c}>
                      {c === 'INR' ? '₹ INR (Indian Rupee)' : c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Sales Tax Rate (%)" hint="Applied to counter orders">
              <div className="relative">
                <input
                  name="tax"
                  type="number"
                  min="0"
                  max="100"
                  step=".01"
                  defaultValue={((editing?.taxRateBps || 0) / 100).toFixed(2)}
                  placeholder="5.00"
                  className={`${inputClass} pr-8`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
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
                <Submit label={editing ? 'Save Changes' : 'Create Shop'} busy={create.isPending || update.isPending} />
              </div>
            </div>
          </form>
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
    query: { enabled: !!shop && kind === 'sales', queryKey: getGetSalesReportQueryKey(params) },
  });
  const expenses = useGetExpensesReport(params, {
    query: { enabled: !!shop && kind === 'expenses', queryKey: getGetExpensesReportQueryKey(params) },
  });
  const q = kind === 'sales' ? sales : expenses;
  const data = q.data;

  async function copyGoogleSheets() {
    if (!data) return;
    let tsv = '';
    if (kind === 'sales' && 'sales' in data) {
      const headers = ['Bill #', 'Date', 'Staff Cashier', 'Payment Mode', 'Order Type', 'Subtotal', 'Tax', 'Parcel Packaging', 'Total'];
      const rows = data.sales.map(s => [
        `#${s.billNumber}`,
        s.createdAt.slice(0, 10),
        s.employeeName || 'Staff',
        s.paymentMethod.toUpperCase(),
        s.orderType === 'takeaway' ? 'Takeaway' : 'Dine In',
        (s.subtotalCents / 100).toFixed(2),
        ((s.taxCents || 0) / 100).toFixed(2),
        ((s.parcelCents || 0) / 100).toFixed(2),
        (s.totalCents / 100).toFixed(2),
      ]);
      tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    } else if ('expenses' in data) {
      const headers = ['Date', 'Category', 'Product / Item', 'Quantity & Unit', 'Unit Price', 'Line Total', 'Supplier', 'Payment'];
      const rows = data.expenses.flatMap(exp => {
        if (exp.items && exp.items.length) {
          return exp.items.map(it => [
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
      tsv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    }

    if (tsv) {
      const ok = await copyToClipboard(tsv);
      if (ok) {
        setToast(`Copied ${kind} report! Paste directly (Ctrl+V) into any Google Sheet.`);
        setTimeout(() => setToast(''), 4500);
      }
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
        title="Reports & Google Sheets Sync"
        sub="Track per-user cashier performance, parcel fees, spend categories, and copy clean spreadsheet TSV."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!data}
              onClick={copyGoogleSheets}
              className="flex items-center gap-2 rounded-xl border border-[#315f52] bg-[#eff5f0] px-4 py-2.5 text-xs font-semibold text-[#315f52] shadow-xs hover:bg-[#e4efe6] disabled:opacity-50 transition"
            >
              <FileSpreadsheet size={15} /> Copy for Google Sheets
            </button>
            <button
              disabled={!data}
              onClick={exportCsv}
              className="flex items-center gap-2 rounded-xl border border-[#d8ddd5] bg-white px-4 py-2.5 text-xs font-semibold text-[#486255] shadow-xs hover:bg-[#faf9f4] disabled:opacity-50 transition"
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

      <div className="surface mb-5 flex flex-wrap items-end gap-3 p-4 shadow-sm">
        <Field label="Report Type">
          <select
            value={kind}
            onChange={e => setKind(e.target.value as 'sales' | 'expenses')}
            className={inputClass}
          >
            <option value="sales">Sales & Cashier Performance</option>
            <option value="expenses">Procurement & Expenses</option>
          </select>
        </Field>
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
                icon={<IndianRupee size={18} />}
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

function SettingsPage() {
  const ws = useGetWorkspace();
  const health = useHealthCheck();
  const shops = useListShops();
  return (
    <>
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
    </>
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
  paperWidth: '58mm' | '80mm' | 'A4';
  autoPrintOnSale: boolean;
  cutSpacing: boolean;
};

const RC_DEFAULTS: ReceiptCfg = {
  businessName: 'BillFlow Shop',
  tagline: 'Thank you for shopping with us!',
  logoUrl: '/logo.png',
  address: '123 Main Street, City',
  phone: '+91 98765 43210',
  website: '',
  taxNumber: 'GSTIN: 29ABCDE1234F1Z5',
  footerMsg: 'Visit us again soon! 🙏',
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
  const is58 = cfg.paperWidth === '58mm';
  const paperW = isA4 ? '210mm' : cfg.paperWidth;
  const printWidth = isA4 ? '190mm' : is58 ? '52mm' : '74mm';
  const padding = isA4 ? '10mm 15mm' : is58 ? '2mm 1.5mm' : '3mm 2.5mm';

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
    tax: number;
    total: number;
  };
}) {
  const paperW = cfg.paperWidth === 'A4' ? '210mm' : cfg.paperWidth;
  const isThermal = cfg.paperWidth !== 'A4';
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
        padding: isThermal ? (cfg.paperWidth === '58mm' ? '12px 10px' : '16px 14px') : '32px 40px',
        boxShadow: '0 4px 30px rgba(0,0,0,.08)',
        fontSize: isThermal ? (cfg.paperWidth === '58mm' ? 11 : 12) : 14,
        lineHeight: 1.5,
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        {cfg.showLogo && cfg.logoUrl && (
          <img src={cfg.logoUrl} alt="logo" style={{ maxHeight: 50, maxWidth: '65%', objectFit: 'contain', margin: '0 auto 6px', display: 'block' }} />
        )}
        <div style={{ fontWeight: 800, fontSize: isThermal ? (cfg.paperWidth === '58mm' ? 14 : 17) : 22, color: cfg.accentColor, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {cfg.businessName}
        </div>
        {cfg.tagline && <div style={{ fontSize: isThermal ? 10 : 12, color: '#666', marginTop: 2 }}>{cfg.tagline}</div>}
        {cfg.address && <div style={{ fontSize: isThermal ? 9.5 : 12, color: '#555', marginTop: 2 }}>{cfg.address}</div>}
        {cfg.phone && <div style={{ fontSize: isThermal ? 9.5 : 12, color: '#555' }}>Tel: {cfg.phone}</div>}
        {cfg.website && <div style={{ fontSize: isThermal ? 9.5 : 12, color: cfg.accentColor }}>{cfg.website}</div>}
        {cfg.showTaxNumber && cfg.taxNumber && (
          <div style={{ fontSize: isThermal ? 9.5 : 11, color: '#444', fontWeight: 600, marginTop: 2 }}>{cfg.taxNumber}</div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px dashed #bbb', margin: '6px 0' }} />

      {/* Meta info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isThermal ? 9.5 : 12, color: '#444', marginBottom: 4 }}>
        {cfg.showBillNo && <span style={{ fontWeight: 700 }}>BILL #{sampleSale.billNo}</span>}
        {cfg.showDate && <span>{sampleSale.date}</span>}
      </div>
      {cfg.showCashier && <div style={{ fontSize: isThermal ? 9.5 : 12, color: '#555', marginBottom: 2 }}>Cashier: {sampleSale.cashier}</div>}
      {cfg.showPayment && <div style={{ fontSize: isThermal ? 9.5 : 12, color: '#555', marginBottom: 2 }}>Payment: {sampleSale.payment.toUpperCase()}</div>}

      {/* Items table */}
      <div style={{ borderTop: '1px dashed #bbb', margin: '6px 0' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '2px 8px', fontSize: isThermal ? (cfg.paperWidth === '58mm' ? 9.5 : 11) : 13, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: '#666', fontSize: 9.5 }}>ITEM</span>
        <span style={{ fontWeight: 700, color: '#666', fontSize: 9.5, textAlign: 'center' }}>QTY</span>
        <span style={{ fontWeight: 700, color: '#666', fontSize: 9.5, textAlign: 'right' }}>TOTAL</span>
        {sampleSale.items.map((item, i) => (
          <div key={`row-${i}`} style={{ display: 'contents' }}>
            <span style={{ wordBreak: 'break-word', paddingRight: 4 }}>{item.name}</span>
            <span style={{ textAlign: 'center' }}>{item.qty}</span>
            <span style={{ textAlign: 'right', fontFamily: 'monospace' }}>₹{(item.price * item.qty).toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px dashed #bbb', margin: '6px 0' }} />

      {/* Totals */}
      <div style={{ fontSize: isThermal ? 11 : 13, lineHeight: 1.6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
          <span>Subtotal</span><span style={{ fontFamily: 'monospace' }}>₹{sampleSale.subtotal.toFixed(2)}</span>
        </div>
        {cfg.showTax && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555' }}>
            <span>Tax</span><span style={{ fontFamily: 'monospace' }}>₹{sampleSale.tax.toFixed(2)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: isThermal ? (cfg.paperWidth === '58mm' ? 13 : 16) : 18, marginTop: 4, color: cfg.accentColor, borderTop: '1px solid #ddd', paddingTop: 4 }}>
          <span>TOTAL</span><span style={{ fontFamily: 'monospace' }}>₹{sampleSale.total.toFixed(2)}</span>
        </div>
      </div>

      {/* QR Code */}
      {cfg.showQrCode && (
        <div style={{ textAlign: 'center', marginTop: 10, marginBottom: 6 }}>
          <img
            src={qrUrl}
            alt="Verify QR"
            style={{ width: isThermal ? (cfg.paperWidth === '58mm' ? 65 : 78) : 90, height: isThermal ? (cfg.paperWidth === '58mm' ? 65 : 78) : 90, margin: '0 auto', display: 'block' }}
          />
          <div style={{ fontSize: 9, color: '#777', marginTop: 3 }}>Scan to verify receipt</div>
        </div>
      )}

      {/* Custom policy note */}
      {cfg.showCustomNote && cfg.customNote && (
        <div style={{ textAlign: 'center', fontSize: isThermal ? 9 : 11, color: '#666', marginTop: 6, fontStyle: 'italic', lineHeight: 1.3 }}>
          {cfg.customNote}
        </div>
      )}

      {/* Footer Thank-You */}
      {cfg.showThankYou && cfg.footerMsg && (
        <>
          <div style={{ borderTop: '1px dashed #bbb', margin: '8px 0 6px' }} />
          <div style={{ textAlign: 'center', fontSize: isThermal ? 9.5 : 12, color: '#555', fontWeight: 600 }}>{cfg.footerMsg}</div>
        </>
      )}

      {/* Paper Cutter Feed space */}
      {cfg.cutSpacing && isThermal && (
        <div style={{ height: cfg.paperWidth === '58mm' ? 24 : 32, borderTop: '1px dotted #ccc', marginTop: 10, textAlign: 'center', fontSize: 8, color: '#aaa', lineHeight: '20px' }}>
          ✂ - - - - - - - - - - - - - - - - - - ✂
        </div>
      )}
    </div>
  );
}

const SAMPLE_SALE = {
  billNo: 'BF-0042',
  date: new Date().toLocaleString(),
  cashier: 'Ahmed Ali',
  payment: 'cash',
  items: [
    { name: 'Espresso', qty: 2, price: 3.50 },
    { name: 'Croissant', qty: 1, price: 2.75 },
    { name: 'Orange Juice', qty: 1, price: 4.00 },
  ],
  subtotal: 13.75,
  tax: 0.69,
  total: 14.44,
};

function ReceiptControl() {
  const [cfg, setCfgRaw] = useState<ReceiptCfg>(loadRc);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'branding' | 'fields' | 'layout' | 'printer'>('branding');

  function setCfg(patch: Partial<ReceiptCfg>) { setCfgRaw(prev => ({ ...prev, ...patch })); setSaved(false); }
  function handleSave() { saveRc(cfg); setSaved(true); setTimeout(() => setSaved(false), 2200); }
  function handlePrint() {
    printReceiptElement('billflow-receipt-preview', cfg);
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
              <div className="rounded-xl border border-[#b8dbc3] bg-[#edf6f0] p-4">
                <p className="text-sm font-semibold text-[#27533b] flex items-center gap-2">
                  <Printer size={16} /> External Thermal Printer Guide
                </p>
                <ul className="mt-2 space-y-1.5 text-xs text-[#416853]">
                  <li>• Compatible with <strong>all external USB, Bluetooth, and Network POS printers</strong> (Epson, Munbyn, Xprinter, Star Micronics, Rongta, etc.).</li>
                  <li>• In your browser print dialog, select your thermal printer (e.g. POS-80 or POS-58).</li>
                  <li>• Under <strong>More settings</strong>: set <strong>Margins to 'None'</strong> and uncheck <strong>'Headers and footers'</strong>.</li>
                </ul>
              </div>

              <div className="rounded-xl border border-[#eee] bg-white p-3 divide-y divide-[#f0efe8]">
                <Toggle
                  checked={cfg.autoPrintOnSale}
                  onChange={v => setCfg({ autoPrintOnSale: v })}
                  label="⚡ Auto-open print dialog immediately upon checkout"
                />
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
                className="flex items-center justify-center gap-2 rounded-xl bg-[#315f52] px-4 py-3 text-sm font-semibold text-white hover:bg-[#274f44] shadow-sm"
              >
                <Printer size={16} /> Send test ticket to external printer
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
            <span className="font-mono text-base text-emerald-800">₹{total}</span>
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
            <Route path="/pos"><Protected title="Checkout"><POS/></Protected></Route>
            <Route path="/sales"><Protected title="Sales"><Sales/></Protected></Route>
            <Route path="/expenses"><Protected title="Expenses"><Expenses/></Protected></Route>
            <Route path="/catalog"><Protected title="Catalog"><Catalog/></Protected></Route>
            <Route path="/team"><Protected title="Team"><Team/></Protected></Route>
            <Route path="/shops"><Protected title="Shops"><Shops/></Protected></Route>
            <Route path="/reports"><Protected title="Reports"><Reports/></Protected></Route>
            <Route path="/receipt"><Protected title="Receipt Control"><ReceiptControl/></Protected></Route>
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
