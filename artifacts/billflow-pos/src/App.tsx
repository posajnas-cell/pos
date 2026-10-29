import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Boxes, BriefcaseBusiness,
  CalendarDays, Check, CircleDollarSign, ClipboardList, CreditCard, Download,
  FileSliders, FileText, IndianRupee, KeyRound, LayoutDashboard, LoaderCircle, Lock, LogOut, Palette, Plus, Printer,
  QrCode, Search, Settings, ShieldCheck, ShoppingBag, Sliders, Store, ToggleLeft, ToggleRight, Type, UserCheck, Users, Wallet, X,
} from 'lucide-react';
import {
  getGetDashboardQueryKey, getGetExpensesReportQueryKey, getGetSalesReportQueryKey,
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

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const money = (cents: number, currency = 'INR') => {
  const curr = (!currency || currency === 'USD') ? 'INR' : currency;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: curr, maximumFractionDigits: 2 }).format((cents || 0) / 100);
};
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const dateInput = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const freshKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
const invalidate = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries();

export type LocalUser = {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'cashier';
  avatarInitials: string;
};

const LOCAL_USER_KEY = 'billflow-local-user';

const PRESET_OPERATORS: LocalUser[] = [
  { id: 'admin', name: 'Store Owner', role: 'owner', avatarInitials: 'SO' },
  { id: 'manager', name: 'Shift Manager', role: 'manager', avatarInitials: 'SM' },
  { id: 'cashier', name: 'Cashier 1', role: 'cashier', avatarInitials: 'C1' },
];

interface AuthContextType {
  user: LocalUser | null;
  login: (operator: LocalUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<LocalUser | null>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_USER_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    // Default to Store Owner if not explicitly set
    const defaultUser = PRESET_OPERATORS[0];
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(defaultUser));
    return defaultUser;
  });

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
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return useContext(AuthContext);
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#315f52] text-white">
        <span className="mono text-sm font-bold">bf</span>
      </span>
      <span className="text-lg font-bold tracking-[-.04em] text-[#2c443b]">
        billflow<span className="text-[#aa8250]">.</span>
      </span>
    </div>
  );
}

function LocalLoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedOp, setSelectedOp] = useState<LocalUser>(PRESET_OPERATORS[0]);
  const [pin, setPin] = useState('');
  const [customName, setCustomName] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  function handleLogin() {
    const opToLogin = isCustom && customName.trim()
      ? {
          id: customName.trim().toLowerCase().replace(/\s+/g, '_'),
          name: customName.trim(),
          role: 'cashier' as const,
          avatarInitials: customName.trim().slice(0, 2).toUpperCase(),
        }
      : selectedOp;

    login(opToLogin);
    setLocation('/dashboard');
  }

  function handleNumKey(num: string) {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  }

  function handleBackspace() {
    setPin(prev => prev.slice(0, -1));
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f7f5ee] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <Brand />
          <p className="mt-2 text-xs font-semibold uppercase tracking-[.18em] text-[#71897c]">
            Point of Sale · Local Login
          </p>
        </div>

        <div className="rounded-2xl border border-[#e2e1d7] bg-[#fffefa] p-6 shadow-xl sm:p-8">
          <div className="mb-5 flex items-center justify-between border-b border-[#efeee7] pb-4">
            <div>
              <h2 className="text-base font-semibold text-[#2c4339]">Select operator</h2>
              <p className="text-xs text-[#828f86]">Tap your profile to unlock register</p>
            </div>
            <span className="rounded-full bg-[#edf4ec] px-2.5 py-1 text-[11px] font-semibold text-[#48705c]">
              Offline ready
            </span>
          </div>

          {/* Operator Grid */}
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {PRESET_OPERATORS.map(op => {
              const active = !isCustom && selectedOp.id === op.id;
              return (
                <button
                  type="button"
                  key={op.id}
                  onClick={() => { setSelectedOp(op); setIsCustom(false); setPin(''); }}
                  className={`flex flex-col items-center rounded-xl p-3 text-center border transition ${
                    active
                      ? 'border-[#315f52] bg-[#eff5f0] shadow-sm'
                      : 'border-[#eae8df] bg-[#faf9f4] hover:border-[#cbd7cf]'
                  }`}
                >
                  <span className={`grid h-10 w-10 place-items-center rounded-full text-xs font-bold mb-2 ${
                    active ? 'bg-[#315f52] text-white' : 'bg-[#e3eae3] text-[#426052]'
                  }`}>
                    {op.avatarInitials}
                  </span>
                  <span className="text-xs font-semibold text-[#2d4239] line-clamp-1">{op.name}</span>
                  <span className="text-[10px] capitalize text-[#8a958e]">{op.role}</span>
                </button>
              );
            })}
          </div>

          {/* Custom operator option */}
          {isCustom ? (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#495b51] mb-1">Staff / Cashier Name</label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Alex"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                className="w-full rounded-xl border border-[#d5d4cb] bg-white px-3.5 py-2.5 text-sm text-[#31443b] outline-none focus:border-[#315f52]"
              />
              <button
                type="button"
                onClick={() => setIsCustom(false)}
                className="mt-1 text-[11px] font-medium text-[#75847b] hover:underline"
              >
                ← Back to standard profiles
              </button>
            </div>
          ) : (
            <div className="text-center mb-4">
              <button
                type="button"
                onClick={() => setIsCustom(true)}
                className="text-xs font-semibold text-[#4a6c5b] hover:underline"
              >
                + Enter custom staff name
              </button>
            </div>
          )}

          {/* Quick PIN Pad */}
          <div className="rounded-xl bg-[#f7f6f0] p-3 border border-[#e8e7de] text-center mb-4">
            <p className="text-xs font-semibold text-[#54685d] mb-1.5 flex items-center justify-center gap-1.5">
              <KeyRound size={13} /> Optional Quick PIN
            </p>
            <div className="flex justify-center gap-2 mb-1">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-3 w-3 rounded-full border ${
                    pin.length > i
                      ? 'bg-[#315f52] border-[#315f52]'
                      : 'bg-white border-[#d0cdc4]'
                  }`}
                />
              ))}
            </div>
            <p className="text-[10.5px] text-[#8e9890]">
              Default: <strong className="mono">1234</strong> (or tap Enter directly)
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-5">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(k => (
              <button
                type="button"
                key={k}
                onClick={() => {
                  if (k === 'C') setPin('');
                  else if (k === '⌫') handleBackspace();
                  else handleNumKey(k);
                }}
                className="h-10 rounded-lg border border-[#e2e1d7] bg-white text-sm font-semibold text-[#32483e] hover:bg-[#f3f6f2] active:scale-95 transition"
              >
                {k}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleLogin}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#315f52] py-3.5 text-sm font-semibold text-white shadow hover:bg-[#274f44] transition"
          >
            Enter POS Register →
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-[#8c978f]">
          All POS data is saved directly in your Supabase PostgreSQL database.
        </p>
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
  {href:'/settings',label:'Settings',icon:Settings},
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
      <div className="sidebar-brand px-2 pb-7"><Brand/></div>
      <div className="sidebar-shop mb-5 rounded-xl border border-white/10 bg-white/[.06] p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#93ada0]">Workspace</p><label className="flex items-center gap-2"><Store size={15} className="shrink-0 text-[#d2b17d]"/><select data-testid="select-active-shop" aria-label="Active shop" className="w-full bg-transparent text-sm font-semibold text-white outline-none" value={active?.id ?? ''} onChange={e=>{setSelected(Number(e.target.value));localStorage.setItem('billflow-shop',e.target.value);}}>{shops.data?.map((s:Shop)=><option className="text-[#203d37]" key={s.id} value={s.id}>{s.name}</option>)}</select></label><p className="mt-2 truncate text-[11px] text-[#a6b8af]">{ws.data?.businessName ?? 'Business workspace'}</p></div>
      <p className="sidebar-caption px-3 pb-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#829c90]">Operations</p>
      <nav className="sidebar-nav flex flex-1 flex-col gap-1">{nav.map(item=>{const Icon=item.icon;return <Link data-testid={`link-nav-${item.label.toLowerCase()}`} key={item.href} href={item.href} className={`sidebar-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium ${path===item.href?'active':''}`}><Icon size={17}/><span>{item.label}</span></Link>;})}</nav>
      <div className="sidebar-bottom border-t border-white/10 pt-4">
        <div className="mb-3 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#c9d9c8] text-xs font-bold text-[#315f52]">
            {user?.avatarInitials || 'SO'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{user?.name || 'Store Owner'}</p>
            <p className="text-[10px] capitalize text-[#9db0a6]">{user?.role || 'owner'}</p>
          </div>
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
function useCurrentShop() { const shops=useListShops(); const [id,setId]=useState(()=>Number(localStorage.getItem('billflow-shop')||0)); useEffect(()=>{if(!id&&shops.data?.length){setId(shops.data[0].id);localStorage.setItem('billflow-shop',String(shops.data[0].id));}},[id,shops.data]); return {shop:shops.data?.find(x=>x.id===id)||shops.data?.[0],shops:shops.data||[],loading:shops.isLoading,error:shops.isError}; }
function QueryState({loading,error,empty,retry,children}: {loading:boolean;error:boolean;empty?:boolean;retry?:()=>void;children:ReactNode}) {
  if(loading)return <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="skeleton h-14 w-full"/>)}<span className="sr-only">Loading records</span></div>;
  if(error)return <div className="surface flex flex-col items-center p-10 text-center"><span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#f8e9e4] text-[#ad5146]"><Activity size={19}/></span><h3 className="font-semibold">Couldn’t load this view</h3><p className="mt-1 text-sm text-[#78827a]">Check your connection and try again.</p><button onClick={retry} className="mt-4 rounded-lg bg-[#315f52] px-4 py-2 text-sm font-semibold text-white">Try again</button></div>;
  if(empty)return <div className="surface flex flex-col items-center p-12 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#edf2e9] text-[#567661]"><FileText size={21}/></span><h3 className="mt-4 font-semibold text-[#344a40]">A clean slate</h3><p className="mt-1 max-w-sm text-sm text-[#78827a]">Records will show here as your shop gets moving.</p></div>;
  return <>{children}</>;
}
function Metric({label,value,detail,icon,accent}: {label:string;value:string;detail:string;icon:ReactNode;accent?:string}) {return <div className="surface p-5"><div className="flex items-start justify-between"><span className="text-[12px] font-medium text-[#748078]">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${accent||'bg-[#edf2e9] text-[#527260]'}`}>{icon}</span></div><p className="mono mt-4 text-[25px] font-bold tracking-[-.05em] text-[#2e463b]">{value}</p><p className="mt-1 text-xs text-[#929a92]">{detail}</p></div>;}
function DataTable({headers,rows}: {headers:string[];rows:ReactNode[][]}) {return <div className="surface overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead className="border-b border-[#eeede6] bg-[#fbfaf6]"><tr>{headers.map(x=><th key={x} className="px-5 py-3 text-[10px] font-bold uppercase tracking-[.13em] text-[#8a958d]">{x}</th>)}</tr></thead><tbody className="divide-y divide-[#efeee8]">{rows.map((r,i)=><tr className="hover:bg-[#fbfaf6]" key={i}>{r.map((cell,j)=><td key={j} className="px-5 py-3.5 text-sm text-[#405148]">{cell}</td>)}</tr>)}</tbody></table></div></div>;}
function Pill({children,tone='green'}:{children:ReactNode;tone?:'green'|'amber'|'gray'}) {return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone==='green'?'bg-[#e9f2e9] text-[#52785f]':tone==='amber'?'bg-[#f7efdf] text-[#92703c]':'bg-[#efefea] text-[#747d76]'}`}>{children}</span>;}
function Field({label,children}: {label:string;children:ReactNode}) {return <label className="grid gap-1.5 text-xs font-semibold text-[#526158]">{label}{children}</label>;}
const inputClass='w-full rounded-lg border border-[#dddcd3] bg-[#fffefa] px-3 py-2.5 text-sm text-[#31463c] outline-none transition focus:border-[#779886] focus:ring-2 focus:ring-[#d8e5dc]';
function Modal({title,onClose,children}: {title:string;onClose:()=>void;children:ReactNode}) {return <div className="fixed inset-0 z-50 grid place-items-center bg-[#203d37]/40 p-4 backdrop-blur-[2px]" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e4e3db] bg-[#fffefa] p-5 shadow-xl md:p-7"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold text-[#30463b]">{title}</h2><button data-testid="button-close-modal" onClick={onClose} className="rounded-lg p-2 text-[#7d8880] hover:bg-[#f1f0e9]"><X size={18}/></button></div>{children}</section></div>;}
function Submit({label,busy}: {label:string;busy:boolean}) {return <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#315f52] px-4 py-3 text-sm font-semibold text-white hover:bg-[#274f44] disabled:opacity-60">{busy&&<LoaderCircle className="animate-spin" size={15} />}{label}</button>;}
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
  const {shop,shops}=useCurrentShop(); const [category,setCategory]=useState<number|undefined>(); const [search,setSearch]=useState(''); const [cart,setCart]=useState<Record<number,number>>({}); const [payment,setPayment]=useState<'cash'|'upi'|'card'|'other'>('cash'); const [order,setOrder]=useState<'dine-in'|'takeaway'>('dine-in'); const [sale,setSale]=useState<Sale|null>(null); const [error,setError]=useState('');
  const cp={shopId:shop?.id||0}; const pp={shopId:shop?.id||0,categoryId:category,search:search||undefined};
  const cats=useListCategories(cp,{query:{enabled:!!shop,queryKey:getListCategoriesQueryKey(cp)}}); const products=useListProducts(pp,{query:{enabled:!!shop,queryKey:getListProductsQueryKey(pp)}});
  const complete=useCompleteSale(); const qc=useQueryClient(); const active=(products.data||[]).filter(p=>p.isAvailable);
  const cartLines=Object.entries(cart).map(([id,qty])=>({product:active.find(p=>p.id===Number(id))||(products.data||[]).find(p=>p.id===Number(id)),qty})).filter(x=>x.product);
  const subtotal=cartLines.reduce((a,x)=>a+(x.product?.priceCents||0)*x.qty,0);
  const tax=Math.round(subtotal*(shop?.taxRateBps||0)/10000);
  const total=subtotal+tax;
  async function pay(){
    if(!shop||!cartLines.length)return;
    setError('');
    complete.mutate({
      data:{shopId:shop.id,idempotencyKey:freshKey(),orderType:order,paymentMethod:payment,discountCents:0,items:cartLines.map(x=>({productId:x.product!.id,quantity:x.qty,discountCents:0}))}
    },{
      onSuccess:r=>{
        setSale(r);
        setCart({});
        invalidate(qc);
        const curCfg = loadRc();
        if (curCfg.autoPrintOnSale) {
          setTimeout(() => printReceiptElement('billflow-checkout-receipt', curCfg), 400);
        }
      },
      onError:()=>setError('Payment could not be completed. Check the connection and retry; the cart is unchanged.')
    });
  }
  return <><PageHeading eyebrow="Counter / checkout" title="Checkout" sub="A focused sale flow with the total always in view."/><EmptyShop shops={shops}/>
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_370px]"><section className="min-w-0"><div className="mb-4 flex flex-wrap gap-2"><button onClick={()=>setCategory(undefined)} className={`rounded-full px-4 py-2 text-xs font-semibold ${!category?'bg-[#315f52] text-white':'border border-[#dddcd3] bg-white text-[#66736a]'}`}>All items</button>{cats.data?.map((c:Category)=><button key={c.id} onClick={()=>setCategory(c.id)} className={`rounded-full px-4 py-2 text-xs font-semibold ${category===c.id?'bg-[#315f52] text-white':'border border-[#dddcd3] bg-white text-[#66736a]'}`}>{c.name}</button>)}</div><div className="relative mb-4"><Search size={16} className="absolute left-3 top-3 text-[#97a098]"/><input data-testid="input-search-products" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a product by name or SKU" className={`${inputClass} pl-9`}/></div><QueryState loading={products.isLoading} error={products.isError} retry={()=>products.refetch()} empty={!active.length}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{active.map((p:Product)=><button data-testid={`button-add-cart-${p.id}`} onClick={()=>setCart({...cart,[p.id]:(cart[p.id]||0)+1})} key={p.id} className="surface group text-left p-4 transition hover:-translate-y-0.5 hover:border-[#9cb3a1]"><div className="mb-4 flex h-24 items-center justify-center rounded-xl bg-[#f1f3ec] text-[#98ab9c]">{p.imageUrl?<img src={p.imageUrl} alt="" className="h-full w-full rounded-xl object-cover"/>:<ShoppingBag size={27}/>}</div><p className="truncate text-sm font-semibold text-[#394d42]">{p.name}</p><div className="mt-2 flex items-center justify-between"><span className="mono text-sm font-bold text-[#315f52]">{money(p.priceCents,shop?.currency)}</span><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#edf2e9] text-[#527260]"><Plus size={15}/></span></div></button>)}</div></QueryState></section>
      <aside className="surface sticky top-[84px] p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-[#334a3f]">Current bill</h2><p className="mt-1 text-[11px] text-[#8a958d]">{shop?.name||'Select a shop'}</p></div><button onClick={()=>setCart({})} className="text-xs font-semibold text-[#9c6258]">Clear</button></div><div className="mb-4 grid grid-cols-2 gap-2"><button onClick={()=>setOrder('dine-in')} className={`rounded-lg border py-2 text-xs font-semibold ${order==='dine-in'?'border-[#315f52] bg-[#edf3ec] text-[#315f52]':'border-[#e5e3db] text-[#77827a]'}`}>Dine in</button><button onClick={()=>setOrder('takeaway')} className={`rounded-lg border py-2 text-xs font-semibold ${order==='takeaway'?'border-[#315f52] bg-[#edf3ec] text-[#315f52]':'border-[#e5e3db] text-[#77827a]'}`}>Takeaway</button></div>
        <div className="max-h-[34vh] min-h-28 space-y-3 overflow-auto border-y border-[#eeede6] py-3">{cartLines.map(x=><div key={x.product!.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#43544a]">{x.product!.name}</p><p className="mono mt-1 text-[10px] text-[#89948c]">{money(x.product!.priceCents,shop?.currency)} ea.</p></div><div className="flex items-center gap-2"><button aria-label="Decrease quantity" onClick={()=>setCart({...cart,[x.product!.id]:Math.max(0,x.qty-1)})} className="grid h-6 w-6 place-items-center rounded border border-[#deddd5] text-sm">−</button><span className="mono w-4 text-center text-xs">{x.qty}</span><button aria-label="Increase quantity" onClick={()=>setCart({...cart,[x.product!.id]:x.qty+1})} className="grid h-6 w-6 place-items-center rounded border border-[#deddd5] text-sm">+</button></div><span className="mono w-16 text-right text-xs font-bold">{money(x.product!.priceCents*x.qty,shop?.currency)}</span></div>)}{!cartLines.length&&<div className="flex h-24 flex-col items-center justify-center text-center text-xs text-[#98a098]"><ShoppingBag size={18} className="mb-2"/>Add an item to begin</div>}</div>
        <div className="space-y-2 py-4 text-xs"><div className="flex justify-between text-[#78837a]"><span>Subtotal</span><span className="mono">{money(subtotal,shop?.currency)}</span></div><div className="flex justify-between text-[#78837a]"><span>Tax {shop?.taxRateBps?`(${(shop.taxRateBps/100).toFixed(2)}%)`:''}</span><span className="mono">{money(tax,shop?.currency)}</span></div><div className="flex justify-between border-t border-[#ecebe4] pt-3 text-sm font-semibold text-[#344a40]"><span>Total due</span><span className="mono text-lg">{money(total,shop?.currency)}</span></div></div>
        <div className="mb-4 grid grid-cols-4 gap-1.5">{(['cash','upi','card','other'] as const).map(method=><button key={method} onClick={()=>setPayment(method)} className={`rounded-md border py-2 text-[10px] font-semibold capitalize ${payment===method?'border-[#315f52] bg-[#edf3ec] text-[#315f52]':'border-[#e5e3db] text-[#758078]'}`}>{method}</button>)}</div>{error&&<p role="alert" className="mb-3 rounded-lg bg-[#f8e9e4] p-2 text-xs text-[#a3463b]">{error}</p>}<button data-testid="button-complete-payment" disabled={!cartLines.length||complete.isPending} onClick={pay} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#315f52] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#274f44] disabled:cursor-not-allowed disabled:opacity-50">{complete.isPending?<LoaderCircle className="animate-spin" size={16}/>:<CreditCard size={16}/>}Charge {money(total,shop?.currency)}</button><p className="mt-2 text-center text-[10px] text-[#9aa29b]">Sale is recorded securely with a unique transaction key.</p>
      </aside>
    </div>
    {sale && (
      <Modal title="Payment complete" onClose={() => setSale(null)}>
        <div className="flex flex-col items-center">
          <div className="mb-3 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#e5f1e6] text-[#4e8060]">
              <Check size={20} />
            </div>
            <h3 className="mt-2 text-base font-semibold text-[#30463b]">Payment received</h3>
            <p className="text-xs text-[#829087]">Bill #{sale.billNumber} · {sale.paymentMethod.toUpperCase()}</p>
          </div>
          <div className="max-h-[50vh] overflow-y-auto w-full flex justify-center p-3 rounded-xl bg-[#f5f4ee] border border-[#e5e4dc]">
            <ReceiptPreview
              id="billflow-checkout-receipt"
              cfg={loadRc()}
              sampleSale={{
                billNo: sale.billNumber,
                date: `${dateLabel(sale.createdAt)} ${new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                cashier: sale.employeeName || 'Staff',
                payment: sale.paymentMethod,
                items: sale.items.map(it => ({
                  name: it.productName,
                  qty: it.quantity,
                  price: (it.unitPriceCents || Math.round(it.lineTotalCents / (it.quantity || 1))) / 100,
                })),
                subtotal: (sale.subtotalCents || (sale.totalCents - (sale.taxCents || 0))) / 100,
                tax: (sale.taxCents || 0) / 100,
                total: sale.totalCents / 100,
              }}
            />
          </div>
          <div className="mt-4 flex w-full gap-2">
            <button
              onClick={() => printReceiptElement('billflow-checkout-receipt', loadRc())}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#315f52] py-2.5 text-sm font-semibold text-white hover:bg-[#274f44]"
            >
              <Printer size={15} /> Print external printer
            </button>
            <button
              onClick={() => setSale(null)}
              className="flex-1 rounded-lg border border-[#dcdcd3] py-2.5 text-sm font-semibold text-[#526258] hover:bg-[#f6f5f0]"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    )}
  </>;
}

function Sales() {
  const {shop}=useCurrentShop(); const [from,setFrom]=useState('');const [to,setTo]=useState('');const params={shopId:shop?.id,from:from||undefined,to:to||undefined};
  const q=useListSales(params,{query:{enabled:!!shop,queryKey:getListSalesQueryKey(params)}});
  return <><PageHeading eyebrow="Transactions" title="Sales history" sub="Every completed bill, ready to review."/><div className="surface mb-4 flex flex-wrap items-end gap-3 p-4"><Field label="From"><input aria-label="From date" type="date" value={from} onChange={e=>setFrom(e.target.value)} className={inputClass}/></Field><Field label="To"><input aria-label="To date" type="date" value={to} onChange={e=>setTo(e.target.value)} className={inputClass}/></Field><button onClick={()=>{setFrom('');setTo('');}} className="rounded-lg border border-[#deddd5] px-4 py-2.5 text-xs font-semibold text-[#617066]">Reset dates</button><span className="ml-auto text-xs text-[#8a958d]">{q.data?.length||0} bills</span></div><QueryState loading={q.isLoading} error={q.isError} retry={()=>q.refetch()} empty={!q.data?.length}><DataTable headers={['Bill','Date & time','Staff','Order','Payment','Items','Total']} rows={(q.data||[]).map((s:Sale)=>[<span className="mono text-xs font-bold">#{s.billNumber}</span>,<span>{dateLabel(s.createdAt)}<small className="block text-[10px] text-[#8f9991]">{new Date(s.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></span>,s.employeeName,<Pill tone="gray">{s.orderType==='dine-in'?'Dine in':'Takeaway'}</Pill>,<Pill>{s.paymentMethod.toUpperCase()}</Pill>,String(s.items.reduce((n,x)=>n+x.quantity,0)),<span className="mono font-bold">{money(s.totalCents,shop?.currency)}</span>])}/></QueryState></>;
}
function Expenses() {
  const {shop,shops}=useCurrentShop(); const [modal,setModal]=useState(false);const [msg,setMsg]=useState('');
  const params={shopId:shop?.id};const q=useListExpenses(params,{query:{enabled:!!shop,queryKey:getListExpensesQueryKey(params)}});
  const create=useCreateExpense();const qc=useQueryClient();
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!shop)return;const f=new FormData(e.currentTarget);create.mutate({data:{shopId:shop.id,expenseDate:String(f.get('expenseDate')),supplier:String(f.get('supplier')||''),invoiceReference:String(f.get('reference')||''),paymentMethod:String(f.get('payment')||'cash') as 'cash'|'upi'|'card'|'other',note:String(f.get('note')||''),items:[{categoryName:String(f.get('category')),productName:String(f.get('item')),quantity:Number(f.get('quantity')),unit:String(f.get('unit')),unitPriceCents:Math.round(Number(f.get('unitPrice'))*100)}]}},{onSuccess:()=>{setModal(false);setMsg('Expense recorded.');invalidate(qc);},onError:()=>setMsg('Could not save this expense. Please try again.')});}
  const total=(q.data||[]).reduce((a,x)=>a+x.totalCents,0);
  return <><PageHeading eyebrow="Outgoings" title="Expenses" sub="Capture the cost of keeping things moving." action={<button data-testid="button-add-expense" onClick={()=>setModal(true)} className="flex items-center gap-2 rounded-lg bg-[#315f52] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/>Record expense</button>}/><EmptyShop shops={shops}/>{msg&&<p role="status" className="mb-3 text-sm text-[#52785f]">{msg}</p>}<div className="mb-5 grid gap-3 sm:grid-cols-2"><Metric label="Expenses in view" value={money(total,shop?.currency)} detail={`${q.data?.length||0} recorded entries`} icon={<Wallet size={18}/>} accent="bg-[#f4eae5] text-[#a3614e]"/><Metric label="Most recent" value={q.data?.length?dateLabel(q.data[0].expenseDate):'—'} detail={q.data?.[0]?.supplier||'No expense recorded'} icon={<CalendarDays size={18}/>} /></div><QueryState loading={q.isLoading} error={q.isError} retry={()=>q.refetch()} empty={!q.data?.length}><DataTable headers={['Date','Supplier','Reference','Details','Payment','Recorded by','Total']} rows={(q.data||[]).map((x:Expense)=>[dateLabel(x.expenseDate),x.supplier||'—',x.invoiceReference||'—',<span>{x.items.map(i=>i.productName).join(', ')}<small className="block text-[10px] text-[#8c968e]">{x.items.map(i=>i.categoryName).join(', ')}</small></span>,<Pill>{x.paymentMethod.toUpperCase()}</Pill>,x.employeeName,<span className="mono font-bold">{money(x.totalCents,shop?.currency)}</span>])}/></QueryState>
    {modal&&<Modal title="Record an expense" onClose={()=>setModal(false)}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><Field label="Expense date"><input required name="expenseDate" type="date" defaultValue={dateInput()} className={inputClass}/></Field><Field label="Supplier"><input name="supplier" placeholder="Supplier or store" className={inputClass}/></Field><Field label="Invoice reference"><input name="reference" placeholder="Optional" className={inputClass}/></Field><Field label="Payment method"><select name="payment" className={inputClass}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="other">Other</option></select></Field><Field label="Expense category"><input required name="category" placeholder="e.g. Ingredients" className={inputClass}/></Field><Field label="Item / description"><input required name="item" placeholder="What was purchased?" className={inputClass}/></Field><Field label="Quantity"><input required name="quantity" type="number" min="0.01" step="any" defaultValue="1" className={inputClass}/></Field><Field label="Unit"><input required name="unit" defaultValue="item" className={inputClass}/></Field><Field label="Unit price"><input required name="unitPrice" type="number" min="0" step="0.01" placeholder="0.00" className={inputClass}/></Field><Field label="Note"><input name="note" placeholder="Optional note" className={inputClass}/></Field><div className="sm:col-span-2"><Submit label="Save expense" busy={create.isPending}/></div></form></Modal>}
  </>;
}

function Catalog() {
  const {shop,shops}=useCurrentShop();const [tab,setTab]=useState<'products'|'categories'>('products');const [modal,setModal]=useState(false);const [search,setSearch]=useState('');const [message,setMessage]=useState('');
  const pp={shopId:shop?.id||0,search:search||undefined};const cp={shopId:shop?.id||0};
  const products=useListProducts(pp,{query:{enabled:!!shop,queryKey:getListProductsQueryKey(pp)}});const categories=useListCategories(cp,{query:{enabled:!!shop,queryKey:getListCategoriesQueryKey(cp)}});
  const createP=useCreateProduct();const updateP=useUpdateProduct();const createC=useCreateCategory();const updateC=useUpdateCategory();const qc=useQueryClient();
  function create(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!shop)return;const f=new FormData(e.currentTarget);if(tab==='products'){createP.mutate({data:{shopId:shop.id,name:String(f.get('name')),description:String(f.get('description')||''),priceCents:Math.round(Number(f.get('price'))*100),sku:String(f.get('sku')||''),categoryId:f.get('category')?Number(f.get('category')):null,isAvailable:true,parcelType:'none',parcelValue:0}},{onSuccess:()=>{setModal(false);setMessage('Product added.');invalidate(qc);},onError:()=>setMessage('Could not add product.')});}else{createC.mutate({data:{shopId:shop.id,name:String(f.get('name')),color:String(f.get('color')||'#6b8c76'),sortOrder:categories.data?.length||0}},{onSuccess:()=>{setModal(false);setMessage('Category added.');invalidate(qc);},onError:()=>setMessage('Could not add category.')});}}
  return <><PageHeading eyebrow="Product setup" title="Catalog" sub="Keep your counter assortment organized." action={<button data-testid="button-add-catalog" onClick={()=>setModal(true)} className="flex items-center gap-2 rounded-lg bg-[#315f52] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/>Add {tab==='products'?'product':'category'}</button>}/><EmptyShop shops={shops}/>{message&&<p role="status" className="mb-3 text-sm text-[#52785f]">{message}</p>}<div className="mb-4 flex gap-2 border-b border-[#e5e4db]"><button onClick={()=>setTab('products')} className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab==='products'?'border-[#315f52] text-[#315f52]':'border-transparent text-[#8a958d]'}`}>Products <span className="ml-1 text-xs">{products.data?.length||0}</span></button><button onClick={()=>setTab('categories')} className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab==='categories'?'border-[#315f52] text-[#315f52]':'border-transparent text-[#8a958d]'}`}>Categories <span className="ml-1 text-xs">{categories.data?.length||0}</span></button></div>
    {tab==='products'?<><div className="relative mb-4 max-w-sm"><Search size={15} className="absolute left-3 top-3 text-[#97a098]"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products" className={`${inputClass} pl-9`}/></div><QueryState loading={products.isLoading} error={products.isError} retry={()=>products.refetch()} empty={!products.data?.length}><DataTable headers={['Product','SKU','Category','Price','Availability','']} rows={(products.data||[]).map((p:Product)=>[<div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f1f3ec] text-[#8ba18f]">{p.imageUrl?<img src={p.imageUrl} alt="" className="h-9 w-9 rounded-lg object-cover"/>:<ShoppingBag size={16}/>}</span><div><p className="font-semibold">{p.name}</p><p className="text-[10px] text-[#8f9991]">{p.description||'No description'}</p></div></div>,p.sku||'—',categories.data?.find(c=>c.id===p.categoryId)?.name||'Uncategorized',<span className="mono font-bold">{money(p.priceCents,shop?.currency)}</span>,<Pill tone={p.isAvailable?'green':'gray'}>{p.isAvailable?'Available':'Hidden'}</Pill>,<button data-testid={`button-toggle-product-${p.id}`} onClick={()=>updateP.mutate({productId:p.id,data:{isAvailable:!p.isAvailable}},{onSuccess:()=>invalidate(qc)})} className="text-xs font-semibold text-[#527260]">{p.isAvailable?'Hide':'Show'}</button>])}/></QueryState></>:<QueryState loading={categories.isLoading} error={categories.isError} retry={()=>categories.refetch()} empty={!categories.data?.length}><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(categories.data||[]).map((c:Category)=><div key={c.id} className="surface flex items-center gap-3 p-4"><span className="h-10 w-10 rounded-xl" style={{backgroundColor:c.color||'#9ab2a0'}}/><div className="min-w-0 flex-1"><p className="font-semibold text-[#3d5146]">{c.name}</p><p className="mt-1 text-xs text-[#879189]">{(products.data||[]).filter(p=>p.categoryId===c.id).length} products</p></div><Pill tone={c.isActive?'green':'gray'}>{c.isActive?'Active':'Hidden'}</Pill><button onClick={()=>updateC.mutate({categoryId:c.id,data:{isActive:!c.isActive}},{onSuccess:()=>invalidate(qc)})} className="text-xs font-semibold text-[#527260]">{c.isActive?'Hide':'Show'}</button></div>)}</div></QueryState>}
    {modal&&<Modal title={tab==='products'?'Add product':'Add category'} onClose={()=>setModal(false)}><form onSubmit={create} className="grid gap-4"><Field label={tab==='products'?'Product name':'Category name'}><input required name="name" autoFocus className={inputClass}/></Field>{tab==='products'?<><Field label="Description"><input name="description" className={inputClass}/></Field><div className="grid grid-cols-2 gap-3"><Field label="Price"><input required name="price" type="number" min="0" step=".01" className={inputClass}/></Field><Field label="SKU"><input name="sku" className={inputClass}/></Field></div><Field label="Category"><select name="category" className={inputClass}><option value="">Uncategorized</option>{categories.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></>:<Field label="Color"><input name="color" type="color" defaultValue="#6b8c76" className={`${inputClass} h-11 p-1`}/></Field>}<Submit label={`Save ${tab==='products'?'product':'category'}`} busy={createP.isPending||createC.isPending}/></form></Modal>}
  </>;
}

function Team() {
  const {shop,shops}=useCurrentShop();const params={shopId:shop?.id||0};const q=useListEmployees(params,{query:{enabled:!!shop,queryKey:getListEmployeesQueryKey(params)}});const create=useCreateEmployee();const qc=useQueryClient();const [modal,setModal]=useState(false);const [message,setMessage]=useState('');
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!shop)return;const f=new FormData(e.currentTarget);create.mutate({data:{shopId:shop.id,name:String(f.get('name')),role:String(f.get('role')) as 'cashier'|'manager'}},{onSuccess:()=>{setModal(false);setMessage('Staff member added.');invalidate(qc);},onError:()=>setMessage('Could not add staff member.')});}
  return <><PageHeading eyebrow="People" title="Your team" sub="A clear view of who’s on the floor." action={<button onClick={()=>setModal(true)} className="flex items-center gap-2 rounded-lg bg-[#315f52] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/>Add staff</button>}/><EmptyShop shops={shops}/>{message&&<p role="status" className="mb-3 text-sm text-[#52785f]">{message}</p>}<div className="mb-5 grid gap-3 sm:grid-cols-2"><Metric label="Active staff" value={String(q.data?.filter(x=>x.isActive).length||0)} detail="Assigned to this shop" icon={<Users size={18}/>} /><Metric label="Shop" value={shop?.name||'—'} detail={shop?.address||'No address on file'} icon={<Store size={18}/>} accent="bg-[#f7efdf] text-[#9b7844]"/></div><QueryState loading={q.isLoading} error={q.isError} retry={()=>q.refetch()} empty={!q.data?.length}><DataTable headers={['Team member','Role','Shop','Status','']} rows={(q.data||[]).map((e:Employee)=>[<div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#e6ede3] text-xs font-bold text-[#557461]">{e.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span><span className="font-semibold">{e.name}</span></div>,<span className="capitalize">{e.role}</span>,shop?.name,<Pill tone={e.isActive?'green':'gray'}>{e.isActive?'Active':'Inactive'}</Pill>,<span className="text-xs text-[#98a098]">Staff record</span>])}/></QueryState>{modal&&<Modal title="Add team member" onClose={()=>setModal(false)}><form onSubmit={submit} className="grid gap-4"><Field label="Full name"><input required name="name" className={inputClass}/></Field><Field label="Role"><select name="role" className={inputClass}><option value="cashier">Cashier</option><option value="manager">Manager</option></select></Field><Submit label="Add to team" busy={create.isPending}/></form></Modal>}</>;
}

function Shops() {
  const q=useListShops();const create=useCreateShop();const update=useUpdateShop();const qc=useQueryClient();const [modal,setModal]=useState(false);const [editing,setEditing]=useState<Shop|null>(null);const [message,setMessage]=useState('');
  function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const data={name:String(f.get('name')),address:String(f.get('address')||''),phone:String(f.get('phone')||''),currency:String(f.get('currency')||'INR'),taxRateBps:Math.round(Number(f.get('tax'))*100)};if(editing)update.mutate({shopId:editing.id,data},{onSuccess:()=>{setModal(false);setEditing(null);setMessage('Shop details updated.');invalidate(qc);},onError:()=>setMessage('Could not update the shop.')});else create.mutate({data},{onSuccess:s=>{localStorage.setItem('billflow-shop',String(s.id));setModal(false);setMessage('Shop created.');invalidate(qc);},onError:()=>setMessage('Could not create the shop.')});}
  return <><PageHeading eyebrow="Locations" title="Shops" sub="Manage the places your business runs." action={<button onClick={()=>{setEditing(null);setModal(true);}} className="flex items-center gap-2 rounded-lg bg-[#315f52] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16}/>Add shop</button>}/>{message&&<p role="status" className="mb-3 text-sm text-[#52785f]">{message}</p>}<QueryState loading={q.isLoading} error={q.isError} retry={()=>q.refetch()} empty={!q.data?.length}><div className="grid gap-4 lg:grid-cols-2">{(q.data||[]).map((s:Shop)=> <article key={s.id} className="surface p-5 md:p-6"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf2e9] text-[#547762]"><Store size={19}/></span><div><h2 className="font-semibold text-[#344a40]">{s.name}</h2><p className="mt-1 text-xs text-[#89948c]">{s.address||'Address not added'}</p></div></div><Pill tone={s.isActive?'green':'gray'}>{s.isActive?'Active':'Inactive'}</Pill></div><div className="mt-5 grid grid-cols-3 gap-2 border-y border-[#efeee7] py-4"><div><p className="text-[10px] text-[#89948c]">Currency</p><p className="mono mt-1 text-sm font-bold">{s.currency}</p></div><div><p className="text-[10px] text-[#89948c]">Sales tax</p><p className="mono mt-1 text-sm font-bold">{(s.taxRateBps/100).toFixed(2)}%</p></div><div><p className="text-[10px] text-[#89948c]">Phone</p><p className="mt-1 truncate text-sm font-semibold">{s.phone||'—'}</p></div></div><div className="mt-4 flex flex-wrap justify-between gap-3"><div className="flex gap-4"><button onClick={()=>{localStorage.setItem('billflow-shop',String(s.id));window.location.reload();}} className="text-xs font-semibold text-[#527260]">Use this shop</button><button onClick={()=>update.mutate({shopId:s.id,data:{isActive:!s.isActive}},{onSuccess:()=>invalidate(qc)})} className="text-xs font-semibold text-[#8c6656]">{s.isActive?'Deactivate':'Activate'}</button></div><button onClick={()=>{setEditing(s);setModal(true);}} className="rounded-lg border border-[#deddd5] px-3 py-1.5 text-xs font-semibold text-[#68766c]">Edit details</button></div></article>)}</div></QueryState>{modal&&<Modal title={editing?'Edit shop':'Add a shop'} onClose={()=>setModal(false)}><form onSubmit={submit} className="grid gap-4"><Field label="Shop name"><input required name="name" defaultValue={editing?.name||''} className={inputClass}/></Field><Field label="Address"><input name="address" defaultValue={editing?.address||''} className={inputClass}/></Field><div className="grid grid-cols-2 gap-3"><Field label="Phone"><input name="phone" defaultValue={editing?.phone||''} className={inputClass}/></Field><Field label="Currency"><select name="currency" defaultValue={editing?.currency||'INR'} className={inputClass}>{['INR','USD','GBP','EUR','CAD','AUD'].map(c=><option key={c}>{c}</option>)}</select></Field></div><Field label="Tax rate (%)"><input name="tax" type="number" min="0" max="100" step=".01" defaultValue={((editing?.taxRateBps||0)/100).toFixed(2)} className={inputClass}/></Field><Submit label={editing?'Save changes':'Create shop'} busy={create.isPending||update.isPending}/></form></Modal>}</>;
}

function Reports() {
  const {shop}=useCurrentShop();const [from,setFrom]=useState(dateInput(new Date(Date.now()-6*86400000)));const [to,setTo]=useState(dateInput());const [kind,setKind]=useState<'sales'|'expenses'>('sales');
  const params={shopId:shop?.id,from:from||undefined,to:to||undefined};
  const sales=useGetSalesReport(params,{query:{enabled:!!shop&&kind==='sales',queryKey:getGetSalesReportQueryKey(params)}});
  const expenses=useGetExpensesReport(params,{query:{enabled:!!shop&&kind==='expenses',queryKey:getGetExpensesReportQueryKey(params)}});
  const q=kind==='sales'?sales:expenses;const data=q.data;
  function exportCsv(){if(!data)return;let lines:string[];if(kind==='sales'&&'sales'in data){lines=[['Bill','Date','Employee','Payment','Order','Subtotal','Discount','Tax','Parcel','Total'].join(','),...data.sales.map(s=>[s.billNumber,s.createdAt,s.employeeName,s.paymentMethod,s.orderType,s.subtotalCents/100,s.discountCents/100,s.taxCents/100,s.parcelCents/100,s.totalCents/100].map(csvCell).join(','))];}else if('expenses'in data){lines=[['Date','Supplier','Reference','Employee','Payment','Total'].join(','),...data.expenses.map(x=>[x.expenseDate,x.supplier||'',x.invoiceReference||'',x.employeeName,x.paymentMethod,x.totalCents/100].map(csvCell).join(','))];}else return;const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`billflow-${kind}-${from}-to-${to}.csv`;a.click();URL.revokeObjectURL(a.href);}
  return <><PageHeading eyebrow="Business intelligence" title="Reports" sub="Choose a period. Keep the detail." action={<button disabled={!data} onClick={exportCsv} className="flex items-center gap-2 rounded-lg border border-[#d8ddd5] bg-white px-4 py-2.5 text-sm font-semibold text-[#486255] disabled:opacity-50"><Download size={15}/>Export CSV</button>}/><div className="surface mb-5 flex flex-wrap items-end gap-3 p-4"><Field label="Report"><select value={kind} onChange={e=>setKind(e.target.value as 'sales'|'expenses')} className={inputClass}><option value="sales">Sales report</option><option value="expenses">Expenses report</option></select></Field><Field label="From"><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className={inputClass}/></Field><Field label="To"><input type="date" value={to} onChange={e=>setTo(e.target.value)} className={inputClass}/></Field><span className="ml-auto pb-2 text-xs text-[#8a958d]">{from} — {to}</span></div><QueryState loading={q.isLoading} error={q.isError} retry={()=>q.refetch()} empty={!data||(kind==='sales'?'sales'in data?data.sales.length===0:true:'expenses'in data?data.expenses.length===0:true)}>{kind==='sales'&&data&&'byEmployee'in data?<><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Sales total" value={money(data.totalCents,shop?.currency)} detail={`${data.billCount} completed bills`} icon={<IndianRupee size={18}/>} /><Metric label="Discounts" value={money(data.discountCents,shop?.currency)} detail="Across selected period" icon={<ArrowDownRight size={18}/>} accent="bg-[#f7efdf] text-[#9b7844]"/><Metric label="Parcel charges" value={money(data.parcelCents,shop?.currency)} detail="Included in sales" icon={<ShoppingBag size={18}/>} /><Metric label="Sales bills" value={String(data.billCount)} detail="For selected dates" icon={<ClipboardList size={18}/>} accent="bg-[#f4eae5] text-[#a3614e]"/></div><div className="mt-5 grid gap-5 xl:grid-cols-2"><section><h2 className="mb-3 font-semibold text-[#344a40]">By team member</h2><DataTable headers={['Employee','Bills','Sales']} rows={data.byEmployee.map(x=>[x.employeeName,String(x.billCount),<span className="mono font-bold">{money(x.totalCents,shop?.currency)}</span>])}/></section><section><h2 className="mb-3 font-semibold text-[#344a40]">By payment method</h2><DataTable headers={['Method','Sales total','Share']} rows={data.byPayment.map(x=>[<span className="capitalize">{x.method}</span>,<span className="mono font-bold">{money(x.totalCents,shop?.currency)}</span>,`${data.totalCents?Math.round(x.totalCents/data.totalCents*100):0}%`])}/></section></div></>:kind==='expenses'&&data&&'byCategory'in data?<><div className="grid gap-3 sm:grid-cols-2"><Metric label="Expense total" value={money(data.totalCents,shop?.currency)} detail={`${data.expenses.length} recorded entries`} icon={<Wallet size={18}/>} accent="bg-[#f4eae5] text-[#a3614e]"/><Metric label="Categories" value={String(data.byCategory.length)} detail="Expense categories in view" icon={<Boxes size={18}/>} /></div><div className="mt-5 grid gap-5 xl:grid-cols-[.8fr_1.2fr]"><section><h2 className="mb-3 font-semibold text-[#344a40]">Spend by category</h2><DataTable headers={['Category','Total','Share']} rows={data.byCategory.map(x=>[x.categoryName,<span className="mono font-bold">{money(x.totalCents,shop?.currency)}</span>,`${data.totalCents?Math.round(x.totalCents/data.totalCents*100):0}%`])}/></section><section><h2 className="mb-3 font-semibold text-[#344a40]">Expense records</h2><DataTable headers={['Date','Supplier','Category','Payment','Total']} rows={data.expenses.map(x=>[dateLabel(x.expenseDate),x.supplier||'—',x.items[0]?.categoryName||'—',<Pill>{x.paymentMethod.toUpperCase()}</Pill>,<span className="mono font-bold">{money(x.totalCents,shop?.currency)}</span>])}/></section></div></>:null}</QueryState></>;
}
function csvCell(value: unknown) { return `"${String(value??'').replaceAll('"','""')}"`; }
function SettingsPage() {
  const ws=useGetWorkspace();const health=useHealthCheck();const shops=useListShops();
  return <><PageHeading eyebrow="Workspace" title="Settings" sub="Business details and service connections."/><div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><section className="surface p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf2e9] text-[#527260]"><BriefcaseBusiness size={18}/></span><div><h2 className="font-semibold text-[#344a40]">Business profile</h2><p className="text-xs text-[#89948c]">Workspace identity and access</p></div></div><div className="divide-y divide-[#efeee7]">{[['Business name',ws.data?.businessName||'Loading…'],['Signed-in user',ws.data?.userName||'—'],['Access role',ws.data?.role||'—'],['Connected shops',String(shops.data?.length||0)]].map(([k,v])=><div className="flex justify-between gap-4 py-3 text-sm" key={k}><span className="text-[#77827a]">{k}</span><span className="font-semibold capitalize text-[#3e5147]">{v}</span></div>)}</div><Link href="/shops" className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#d9ddd4] px-3 py-2 text-xs font-semibold text-[#527260]">Manage shops <ArrowRight size={13}/></Link></section><section className="surface p-5 md:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7efdf] text-[#9b7844]"><Activity size={18}/></span><div><h2 className="font-semibold text-[#344a40]">Service status</h2><p className="text-xs text-[#89948c]">Connections for this workspace</p></div></div><div className="space-y-3">{[['BillFlow API',health.data?.status||'Checking',health.isError],['Clerk sign-in','Connected',false],['Shop data',shops.isError?'Unavailable':shops.isLoading?'Checking':'Connected',shops.isError]].map(([label,status,failed])=><div key={String(label)} className="flex items-center justify-between rounded-xl border border-[#eeede6] px-4 py-3"><div><p className="text-sm font-semibold text-[#47584e]">{label}</p><p className="mt-0.5 text-[11px] text-[#8b958e]">Live connection</p></div><Pill tone={failed?'amber':'green'}>{String(status)}</Pill></div>)}</div><p className="mt-5 rounded-lg bg-[#f7f6f0] p-3 text-xs leading-5 text-[#7b877e]">Your sales and staff data are scoped to your signed-in workspace. Payment processing is recorded by BillFlow; this app does not retain card details.</p></section></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e1e1d8] bg-[#f1f1e9] p-4"><div><p className="text-sm font-semibold text-[#415248]">Need another location?</p><p className="mt-1 text-xs text-[#829087]">Add a shop and keep its sales and tax settings separate.</p></div><Link href="/shops" className="text-xs font-semibold text-[#527260]">Shop management <ArrowRight size={13} className="inline"/></Link></div></>;
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
  logoUrl: '',
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
  qrCodeData: 'https://billflow.app/verify',
  showThankYou: true,
  paperWidth: '80mm',
  autoPrintOnSale: false,
  cutSpacing: true,
};

function loadRc(): ReceiptCfg {
  try { return { ...RC_DEFAULTS, ...JSON.parse(localStorage.getItem(RC_KEY) || '{}') }; }
  catch { return RC_DEFAULTS; }
}

function saveRc(cfg: ReceiptCfg) { localStorage.setItem(RC_KEY, JSON.stringify(cfg)); }

function printReceiptElement(elementId: string, cfg: ReceiptCfg) {
  const prevTitle = document.title;
  document.title = `Receipt_${cfg.businessName.replace(/[^a-zA-Z0-9]/g, '_')}`;
  
  const printWidth = cfg.paperWidth === 'A4' ? '210mm' : cfg.paperWidth;
  const padding = cfg.paperWidth === '58mm' ? '2mm 2.5mm' : cfg.paperWidth === '80mm' ? '3mm 4mm' : '15mm';
  
  const style = document.createElement('style');
  style.id = '__rc_print_sheet';
  style.innerHTML = `
    @page {
      size: ${cfg.paperWidth === 'A4' ? 'A4 portrait' : `${cfg.paperWidth} auto`};
      margin: 0mm;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body * {
        visibility: hidden !important;
      }
      #${elementId}, #${elementId} * {
        visibility: visible !important;
      }
      #${elementId} {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: ${printWidth} !important;
        max-width: ${printWidth} !important;
        padding: ${padding} !important;
        margin: 0 auto !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        background: #fff !important;
      }
    }
  `;
  document.head.appendChild(style);
  window.print();
  document.head.removeChild(style);
  document.title = prevTitle;
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
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=0&data=${encodeURIComponent(cfg.qrCodeData || ('https://billflow.app/b/' + sampleSale.billNo))}`;

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
              <Field label="Logo URL (optional)">
                <input value={cfg.logoUrl} onChange={e => setCfg({ logoUrl: e.target.value })} className={inputClass} placeholder="https://your-site.com/logo.png" />
              </Field>
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

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in" component={LocalLoginPage} />
            <Route path="/sign-up" component={LocalLoginPage} />
            <Route path="/dashboard"><Protected title="Overview"><Dashboard/></Protected></Route>
            <Route path="/pos"><Protected title="Checkout"><POS/></Protected></Route>
            <Route path="/sales"><Protected title="Sales"><Sales/></Protected></Route>
            <Route path="/expenses"><Protected title="Expenses"><Expenses/></Protected></Route>
            <Route path="/catalog"><Protected title="Catalog"><Catalog/></Protected></Route>
            <Route path="/team"><Protected title="Team"><Team/></Protected></Route>
            <Route path="/shops"><Protected title="Shops"><Shops/></Protected></Route>
            <Route path="/reports"><Protected title="Reports"><Reports/></Protected></Route>
            <Route path="/receipt"><Protected title="Receipt Control"><ReceiptControl/></Protected></Route>
            <Route path="/settings"><Protected title="Settings"><SettingsPage/></Protected></Route>
            <Route component={NotFound} />
          </Switch>
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}
export default App;
