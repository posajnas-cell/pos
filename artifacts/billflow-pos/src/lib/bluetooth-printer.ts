// Direct Bluetooth Thermal Receipt Printer (ESC/POS) Engine for BillFlow POS
// Communicates directly with 50mm, 58mm, and 80mm Bluetooth thermal printers via Web Bluetooth API.

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  connected: boolean;
}

const COMMON_BT_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Common ESC/POS printer service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Hoin / Xprinter / Rongta
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard HM-10 / CC2541 BLE serial
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic serial profile
];

const BT_STORAGE_KEY = 'billflow_bt_printer_info';

let activeBluetoothDevice: any = null;
let activeWriteCharacteristic: any = null;

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export function getSavedPrinterInfo(): BluetoothDeviceInfo | null {
  try {
    const raw = localStorage.getItem(BT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSavedPrinter(): void {
  try {
    if (activeBluetoothDevice?.gatt?.connected) {
      activeBluetoothDevice.gatt.disconnect();
    }
  } catch {}
  activeBluetoothDevice = null;
  activeWriteCharacteristic = null;
  localStorage.removeItem(BT_STORAGE_KEY);
}

// Request and pair with a Bluetooth thermal printer
export async function connectBluetoothPrinter(): Promise<BluetoothDeviceInfo> {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth is not supported on this browser. Use Chrome, Edge, or an Android tablet.');
  }

  const nav = navigator as any;
  const device = await nav.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: COMMON_BT_SERVICES,
  });

  if (!device) {
    throw new Error('No printer selected.');
  }

  activeBluetoothDevice = device;
  const server = await device.gatt.connect();

  // Search for the writable characteristic across services
  let characteristic: any = null;
  for (const serviceUuid of COMMON_BT_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties?.write || c.properties?.writeWithoutResponse) {
          characteristic = c;
          break;
        }
      }
      if (characteristic) break;
    } catch {}
  }

  // If common services failed, inspect all available primary services
  if (!characteristic && server.getPrimaryServices) {
    try {
      const services = await server.getPrimaryServices();
      for (const s of services) {
        try {
          const chars = await s.getCharacteristics();
          for (const c of chars) {
            if (c.properties?.write || c.properties?.writeWithoutResponse) {
              characteristic = c;
              break;
            }
          }
          if (characteristic) break;
        } catch {}
      }
    } catch {}
  }

  if (!characteristic) {
    throw new Error('Could not find write characteristic on this Bluetooth device. Make sure it is an ESC/POS printer.');
  }

  activeWriteCharacteristic = characteristic;

  const info: BluetoothDeviceInfo = {
    id: device.id,
    name: device.name || 'Bluetooth Receipt Printer',
    connected: true,
  };

  localStorage.setItem(BT_STORAGE_KEY, JSON.stringify(info));
  return info;
}

// Ensure the characteristic is ready before printing
async function ensureConnected(): Promise<any> {
  if (activeWriteCharacteristic && activeBluetoothDevice?.gatt?.connected) {
    return activeWriteCharacteristic;
  }
  // Try reconnecting to the active device if remembered
  if (activeBluetoothDevice && !activeBluetoothDevice.gatt?.connected) {
    const server = await activeBluetoothDevice.gatt.connect();
    for (const serviceUuid of COMMON_BT_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const c of chars) {
          if (c.properties?.write || c.properties?.writeWithoutResponse) {
            activeWriteCharacteristic = c;
            return c;
          }
        }
      } catch {}
    }
  }
  // If not connected, request device
  const info = await connectBluetoothPrinter();
  if (!activeWriteCharacteristic) {
    throw new Error(`Printer "${info.name}" not ready.`);
  }
  return activeWriteCharacteristic;
}

// Low-level helper: write byte buffer in chunks (BLE characteristic MTU is typically 20-512 bytes)
async function sendBytes(characteristic: any, bytes: Uint8Array): Promise<void> {
  const CHUNK_SIZE = 100;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    // tiny delay between chunks for printer buffer stability
    await new Promise((r) => setTimeout(r, 20));
  }
}

// Convert string to Uint8Array (ASCII / Latin-1)
function encodeText(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

// ESC/POS Command Constants
const ESC = 0x1b;
const GS = 0x1d;

const CMD_INIT = new Uint8Array([ESC, 0x40]); // Initialize printer
const CMD_ALIGN_LEFT = new Uint8Array([ESC, 0x61, 0x00]);
const CMD_ALIGN_CENTER = new Uint8Array([ESC, 0x61, 0x01]);
const CMD_ALIGN_RIGHT = new Uint8Array([ESC, 0x61, 0x02]);

const CMD_BOLD_ON = new Uint8Array([ESC, 0x45, 0x01]);
const CMD_BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00]);

const CMD_DOUBLE_SIZE = new Uint8Array([GS, 0x21, 0x11]); // Double width & height
const CMD_DOUBLE_HEIGHT = new Uint8Array([GS, 0x21, 0x01]);
const CMD_NORMAL_SIZE = new Uint8Array([GS, 0x21, 0x00]);

const CMD_FEED_4 = new Uint8Array([ESC, 0x64, 0x04]); // Feed 4 lines
const CMD_CUT_PAPER = new Uint8Array([GS, 0x56, 0x41, 0x00]); // Full cut
const CMD_KICK_DRAWER = new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xfa]); // Pulse pin 2

function buildDivider(cols: number): string {
  return '-'.repeat(cols) + '\n';
}

function padLine(left: string, right: string, cols: number): string {
  const total = left.length + right.length;
  if (total >= cols) {
    const maxLeft = Math.max(0, cols - right.length - 1);
    left = left.substring(0, maxLeft);
  }
  const spaces = Math.max(1, cols - left.length - right.length);
  return left + ' '.repeat(spaces) + right + '\n';
}

function format4Cols(col1: string, col2: string, col3: string, col4: string, totalCols: number): string {
  if (totalCols >= 44) {
    // 80mm printer (48 cols)
    const w2 = 8;
    const w3 = 5;
    const w4 = 9;
    const w1 = Math.max(10, totalCols - w2 - w3 - w4 - 3);
    const c1 = col1.padEnd(w1).substring(0, w1);
    const c2 = col2.padStart(w2);
    const c3 = col3.padStart(w3);
    const c4 = col4.padStart(w4);
    return `${c1} ${c2} ${c3} ${c4}\n`;
  } else {
    // 58mm / 50mm printer (32 / 30 cols)
    const w2 = 6;
    const w3 = 3;
    const w4 = 7;
    const w1 = Math.max(8, totalCols - w2 - w3 - w4 - 3);
    const c1 = col1.padEnd(w1).substring(0, w1);
    const c2 = col2.padStart(w2);
    const c3 = col3.padStart(w3);
    const c4 = col4.padStart(w4);
    return `${c1} ${c2} ${c3} ${c4}\n`;
  }
}

// Build ESC/POS Byte stream for a bill
export function buildEscPosBill(
  sale: any,
  cfg: any,
  shop: any
): Uint8Array {
  const is50 = cfg.paperWidth === '50mm';
  const is58 = cfg.paperWidth === '58mm';
  const cols = is50 ? 30 : is58 ? 32 : 48; // 50mm=30 chars, 58mm=32 chars, 80mm=48 chars

  const parts: Uint8Array[] = [];

  const add = (cmdOrText: Uint8Array | string) => {
    if (typeof cmdOrText === 'string') {
      parts.push(encodeText(cmdOrText));
    } else {
      parts.push(cmdOrText);
    }
  };

  // 1. Reset / Init
  add(CMD_INIT);

  // 2. Header (Centered)
  add(CMD_ALIGN_CENTER);
  add(CMD_BOLD_ON);
  add(CMD_DOUBLE_SIZE);
  add((cfg.businessName || shop?.name || 'BillFlow Store') + '\n');
  add(CMD_NORMAL_SIZE);
  add(CMD_BOLD_OFF);

  if (cfg.tagline) {
    add(cfg.tagline + '\n');
  }
  if (cfg.address || shop?.address) {
    add((cfg.address || shop?.address) + '\n');
  }
  if (cfg.phone || shop?.phone) {
    add('Tel: ' + (cfg.phone || shop?.phone) + '\n');
  }
  if (cfg.taxNumber || shop?.taxNumber) {
    add((cfg.taxNumber || shop?.taxNumber) + '\n');
  }

  // Medium Size Centered Tax Invoice Heading
  add(CMD_ALIGN_CENTER);
  add(CMD_BOLD_ON);
  add('TAX INVOICE\n');
  add(CMD_BOLD_OFF);

  // 3. Bill Meta Info
  add(CMD_ALIGN_LEFT);
  add(buildDivider(cols));
  if (cfg.showBillNo !== false) {
    add(padLine('Bill No: ' + (sale.billNumber || sale.id || 'N/A'), (sale.paymentMethod || 'CASH').toUpperCase(), cols));
  }
  if (cfg.showDate !== false) {
    const dt = sale.createdAt ? new Date(sale.createdAt).toLocaleString() : new Date().toLocaleString();
    add(padLine('Date: ' + dt, '', cols));
  }
  if (cfg.showCashier !== false && sale.employeeName) {
    add(padLine('Cashier: ' + sale.employeeName, '', cols));
  }

  // 4. Items Table (ITEM | RATE | QTY | TOTAL)
  add(buildDivider(cols));
  add(format4Cols('ITEM', 'RATE', 'QTY', 'TOTAL', cols));
  add(buildDivider(cols));

  const items = sale.items || [];
  for (const it of items) {
    const qty = String(it.quantity || 1);
    const name = it.productName || it.name || 'Item';
    const totalItemPrice = ((it.totalPriceCents ?? (it.unitPriceCents * Number(qty))) / 100).toFixed(2);
    const unitPrice = ((it.unitPriceCents || 0) / 100).toFixed(2);

    const maxCol1 = cols >= 44 ? cols - 25 : Math.max(8, cols - 6 - 3 - 7 - 3);
    if (name.length > maxCol1) {
      add(CMD_BOLD_ON);
      add(name + '\n');
      add(CMD_BOLD_OFF);
      add(format4Cols('', unitPrice, qty, totalItemPrice, cols));
    } else {
      add(format4Cols(name, unitPrice, qty, totalItemPrice, cols));
    }

    if (it.parcelChargeCents && it.parcelChargeCents > 0) {
      const parcelTotal = ((it.parcelChargeCents * Number(qty)) / 100).toFixed(2);
      add(padLine('  Parcel Fee', `+${parcelTotal}`, cols));
    }
  }

  // 5. Totals & Tax (Numbers formatted cleanly without AED)
  add(buildDivider(cols));
  const subtotal = ((sale.subtotalCents || 0) / 100).toFixed(2);
  const tax = ((sale.taxCents || 0) / 100).toFixed(2);
  const discount = ((sale.discountCents || 0) / 100).toFixed(2);
  const total = ((sale.totalCents || 0) / 100).toFixed(2);

  add(padLine('Subtotal:', subtotal, cols));
  if (Number(discount) > 0) {
    add(padLine('Discount:', `-${discount}`, cols));
  }
  if (sale.parcelCents && Number(sale.parcelCents) > 0) {
    const parcelTotal = ((sale.parcelCents) / 100).toFixed(2);
    add(padLine('Parcel Fee:', `+${parcelTotal}`, cols));
  }
  if (cfg.showTax !== false && Number(tax) > 0) {
    const taxLabel = shop?.taxType === 'inclusive' ? 'VAT (Incl.):' : 'VAT / Tax:';
    add(padLine(taxLabel, tax, cols));
  }

  add(buildDivider(cols));
  add(CMD_BOLD_ON);
  add(CMD_DOUBLE_HEIGHT);
  add(padLine('TOTAL:', total, cols));
  add(CMD_NORMAL_SIZE);
  add(CMD_BOLD_OFF);
  add(buildDivider(cols));

  // 6. Footer Notes
  add(CMD_ALIGN_CENTER);
  if (cfg.customNote) {
    add(cfg.customNote + '\n');
  }
  if (cfg.footerMsg) {
    add(cfg.footerMsg + '\n');
  }
  if (cfg.showThankYou !== false) {
    add('*** THANK YOU! ***\n');
  }

  // 7. Paper Feed & Cut
  add(CMD_FEED_4);
  if (cfg.cutSpacing !== false) {
    add(CMD_CUT_PAPER);
  }

  // 8. Kick Drawer if enabled
  if (cfg.kickDrawerOnSale) {
    add(CMD_KICK_DRAWER);
  }

  // Combine all Uint8Arrays
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    combined.set(part, offset);
    offset += part.length;
  }

  return combined;
}

// Main high-level print function: Sends directly to paired Bluetooth printer
export async function printDirectBluetooth(
  sale: any,
  cfg: any,
  shop: any
): Promise<{ success: boolean; printerName: string }> {
  const printPromise = (async () => {
    const characteristic = await ensureConnected();
    const binaryBill = buildEscPosBill(sale, cfg, shop);
    await sendBytes(characteristic, binaryBill);
    return {
      success: true,
      printerName: activeBluetoothDevice?.name || 'Bluetooth Printer',
    };
  })();

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Bluetooth printer connection timed out')), 3000)
  );

  return Promise.race([printPromise, timeoutPromise]);
}

// Test Print
export async function testBluetoothPrint(cfg: any, shop: any): Promise<void> {
  const dummySale = {
    billNumber: 'TEST-001',
    createdAt: new Date().toISOString(),
    employeeName: 'Admin',
    paymentMethod: 'CASH',
    subtotalCents: 2500,
    taxCents: 125,
    discountCents: 0,
    totalCents: 2625,
    items: [
      { name: 'Test Coffee Item', quantity: 1, unitPriceCents: 1500, totalPriceCents: 1500 },
      { name: 'Test Croissant', quantity: 1, unitPriceCents: 1000, totalPriceCents: 1000 },
    ],
  };
  await printDirectBluetooth(dummySale, cfg, shop);
}

// Open Cash Drawer
export async function triggerCashDrawer(): Promise<void> {
  const characteristic = await ensureConnected();
  await sendBytes(characteristic, CMD_KICK_DRAWER);
}

