import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

const COURT_COLUMNS: Record<string, string> = {
  'Cancha 1': 'B',
  'Cancha 2': 'C',
  'Cancha 3': 'D',
};

// 0-based column indices for formatting API
const COURT_COL_INDICES: Record<string, number> = {
  'Cancha 1': 1,
  'Cancha 2': 2,
  'Cancha 3': 3,
};

const COLOR_FIXED   = { red: 0.576, green: 0.769, blue: 0.490 }; // verde  — TURNO FIJO
const COLOR_ONCE    = { red: 1.0,   green: 0.651, blue: 0.110 }; // naranja — TURNO UNA VEZ
const COLOR_CLOSURE = { red: 0.878, green: 0.192, blue: 0.192 }; // rojo   — CIERRE/MANTENIMIENTO
const COLOR_CLEAR   = { red: 1.0,   green: 1.0,   blue: 1.0   }; // blanco — vacío

/** Converts "2026-04-08" → "Miercoles 08/04" */
function getSheetName(dateStr: string): string {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  const dayName = DAYS_ES[date.getDay()];
  return `${dayName} ${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}`;
}

/** Converts "17:00" → row number (row 2 = 08:00, each 30 min = +1) */
function timeToRow(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return 2 + (h * 60 + m - 480) / 30;
}

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

type RgbColor = { red: number; green: number; blue: number };

type ColorRequest = {
  sheetId: number;
  colIndex: number;  // 0-based
  startRow: number;  // 0-based
  numRows: number;
  color: RgbColor;
};

/** Applies background colors to multiple ranges in a single API call. */
async function applyBgColors(
  sheets: ReturnType<typeof google.sheets>,
  requests: ColorRequest[],
): Promise<void> {
  if (requests.length === 0) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: requests.map(({ sheetId, colIndex, startRow, numRows, color }) => ({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: startRow,
            endRowIndex: startRow + numRows,
            startColumnIndex: colIndex,
            endColumnIndex: colIndex + 1,
          },
          cell: { userEnteredFormat: { backgroundColor: color } },
          fields: 'userEnteredFormat.backgroundColor',
        },
      })),
    },
  });
}

/** Generates time slot labels: ["8:00-8:30", ..., "22:30-23:00"] */
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  for (let min = 480; min < 23 * 60; min += 30) {
    const hStart = Math.floor(min / 60);
    const mStart = min % 60;
    const hEnd = Math.floor((min + 30) / 60);
    const mEnd = (min + 30) % 60;
    const fmt = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')}`;
    slots.push(`${fmt(hStart, mStart)}-${fmt(hEnd, mEnd)}`);
  }
  return slots;
}

/**
 * Ensures a sheet tab exists. If not, creates it with:
 * - Row 1: headers (day, Cancha 1, Cancha 2, Cancha 3)
 * - Column A: time slots from 8:00 to 23:00
 * - Fixed bookings and closures for that date pre-filled (with colors)
 */
/**
 * Ensures a sheet tab exists. Returns the numeric sheetId of the tab (existing or newly created).
 */
async function ensureSheet(
  sheets: ReturnType<typeof google.sheets>,
  sheetName: string,
  dateStr: string,
): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const existing = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (existing) return existing.properties!.sheetId!;

  // Create the tab — response contains the new sheet's numeric id
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  });
  const newSheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;

  // Write header row
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A1:D1`,
    valueInputOption: 'RAW',
    requestBody: { values: [[sheetName, 'Cancha 1', 'Cancha 2', 'Cancha 3']] },
  });

  // Write time slots in column A
  const timeSlots = generateTimeSlots();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A2:A${1 + timeSlots.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: timeSlots.map((t) => [t]) },
  });

  // Pre-fill fixed bookings and closures (with colors)
  await prefillFixedAndClosures(sheets, sheetName, newSheetId, dateStr);

  return newSheetId;
}

/**
 * Queries Supabase for fixed bookings (by weekday) and closures (by date)
 * and writes them (values + colors) to the sheet tab.
 */
async function prefillFixedAndClosures(
  sheets: ReturnType<typeof google.sheets>,
  sheetName: string,
  sheetId: number,
  dateStr: string,
): Promise<void> {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const weekday = new Date(yyyy, mm - 1, dd).getDay();
  const supabase = getSupabase();

  const { data: courts } = await supabase.from('courts').select('id, name');
  const courtNameById: Record<number, string> = {};
  for (const c of courts ?? []) courtNameById[c.id] = c.name;

  const { data: fixedBookings } = await supabase
    .from('fixed_bookings')
    .select('*')
    .eq('weekday', weekday);

  const { data: closures } = await supabase
    .from('court_closures')
    .select('*')
    .lte('date_from', dateStr)
    .gte('date_to', dateStr);

  type ValueUpdate = { range: string; numRows: number; value: string };
  const valueUpdates: ValueUpdate[] = [];
  const colorRequests: ColorRequest[] = [];

  for (const fb of fixedBookings ?? []) {
    const courtName = courtNameById[fb.court_id];
    const col = COURT_COLUMNS[courtName];
    const colIdx = COURT_COL_INDICES[courtName];
    if (!col || colIdx === undefined) continue;
    const startRow = timeToRow(fb.start_time.slice(0, 5));
    const numRows = fb.duration_minutes / 30;
    const endRow = startRow + numRows - 1;
    valueUpdates.push({ range: `'${sheetName}'!${col}${startRow}:${col}${endRow}`, numRows, value: fb.label ?? 'Clase' });
    colorRequests.push({ sheetId, colIndex: colIdx, startRow: startRow - 1, numRows, color: COLOR_FIXED });
  }

  for (const cl of closures ?? []) {
    const courtName = courtNameById[cl.court_id];
    const col = COURT_COLUMNS[courtName];
    const colIdx = COURT_COL_INDICES[courtName];
    if (!col || colIdx === undefined) continue;
    const startRow = timeToRow(cl.start_time.slice(0, 5));
    const endRow = timeToRow(cl.end_time.slice(0, 5)) - 1;
    if (endRow < startRow) continue;
    const numRows = endRow - startRow + 1;
    valueUpdates.push({ range: `'${sheetName}'!${col}${startRow}:${col}${endRow}`, numRows, value: cl.reason ?? 'Mantenimiento' });
    colorRequests.push({ sheetId, colIndex: colIdx, startRow: startRow - 1, numRows, color: COLOR_CLOSURE });
  }

  if (valueUpdates.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: valueUpdates.map(({ range, numRows, value }) => ({
        range,
        values: Array(numRows).fill([value]),
      })),
    },
  });

  await applyBgColors(sheets, colorRequests);
}

/**
 * Parses "Miercoles 08/04" → "2026-04-08".
 * Picks current year; if the date is >60 days in the past, assumes next year.
 */
function parseDateFromSheetName(tabTitle: string): string | null {
  const match = tabTitle.match(/(\d{2})\/(\d{2})$/);
  if (!match) return null;
  const dd = parseInt(match[1]);
  const mm = parseInt(match[2]);
  const now = new Date();
  const year = now.getFullYear();
  const candidate = new Date(year, mm - 1, dd);
  const diffDays = (candidate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const actualYear = diffDays < -60 ? year + 1 : year;
  return `${actualYear}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/**
 * Writes a fixed booking label (+ green color) to all existing tabs matching the weekday.
 */
export async function writeFixedBookingToSheets(params: {
  weekday: number;
  court_name: string;
  start_time: string;
  duration_minutes: number;
  label: string;
}): Promise<void> {
  const col = COURT_COLUMNS[params.court_name];
  const colIdx = COURT_COL_INDICES[params.court_name];
  if (!col || colIdx === undefined) return;

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tabs = meta.data.sheets ?? [];

  const startRow = timeToRow(params.start_time.slice(0, 5));
  const numRows = params.duration_minutes / 30;
  const endRow = startRow + numRows - 1;

  const matchingTabs = tabs
    .filter((s) => {
      const title = s.properties?.title ?? '';
      const dateStr = parseDateFromSheetName(title);
      if (!dateStr) return false;
      const [yyyy, mm, dd] = dateStr.split('-').map(Number);
      return new Date(yyyy, mm - 1, dd).getDay() === params.weekday;
    });

  if (matchingTabs.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: matchingTabs.map((s) => ({
        range: `'${s.properties!.title}'!${col}${startRow}:${col}${endRow}`,
        values: Array(numRows).fill([params.label]),
      })),
    },
  });

  await applyBgColors(
    sheets,
    matchingTabs.map((s) => ({
      sheetId: s.properties!.sheetId!,
      colIndex: colIdx,
      startRow: startRow - 1, // 0-based
      numRows,
      color: COLOR_FIXED,
    })),
  );
}

/**
 * Clears a fixed booking (values + color) from all existing tabs matching the weekday.
 */
export async function clearFixedBookingFromSheets(params: {
  weekday: number;
  court_name: string;
  start_time: string;
  duration_minutes: number;
}): Promise<void> {
  const col = COURT_COLUMNS[params.court_name];
  const colIdx = COURT_COL_INDICES[params.court_name];
  if (!col || colIdx === undefined) return;

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tabs = meta.data.sheets ?? [];

  const startRow = timeToRow(params.start_time.slice(0, 5));
  const numRows = params.duration_minutes / 30;
  const endRow = startRow + numRows - 1;

  const matchingTabs = tabs
    .filter((s) => {
      const title = s.properties?.title ?? '';
      const dateStr = parseDateFromSheetName(title);
      if (!dateStr) return false;
      const [yyyy, mm, dd] = dateStr.split('-').map(Number);
      return new Date(yyyy, mm - 1, dd).getDay() === params.weekday;
    });

  for (const s of matchingTabs) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${s.properties!.title}'!${col}${startRow}:${col}${endRow}`,
    });
  }

  await applyBgColors(
    sheets,
    matchingTabs.map((s) => ({
      sheetId: s.properties!.sheetId!,
      colIndex: colIdx,
      startRow: startRow - 1,
      numRows,
      color: COLOR_CLEAR,
    })),
  );
}

/**
 * Writes a closure label (+ yellow color) to all existing tabs within the date range.
 */
export async function writeClosureToSheets(params: {
  date_from: string;
  date_to: string;
  court_name: string;
  start_time: string;
  end_time: string;
  reason: string;
}): Promise<void> {
  const col = COURT_COLUMNS[params.court_name];
  const colIdx = COURT_COL_INDICES[params.court_name];
  if (!col || colIdx === undefined) return;

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tabs = meta.data.sheets ?? [];

  const startRow = timeToRow(params.start_time.slice(0, 5));
  const endRow = timeToRow(params.end_time.slice(0, 5)) - 1;
  if (endRow < startRow) return;
  const numRows = endRow - startRow + 1;

  const matchingTabs = tabs
    .filter((s) => {
      const title = s.properties?.title ?? '';
      const dateStr = parseDateFromSheetName(title);
      if (!dateStr) return false;
      return dateStr >= params.date_from && dateStr <= params.date_to;
    });

  if (matchingTabs.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: matchingTabs.map((s) => ({
        range: `'${s.properties!.title}'!${col}${startRow}:${col}${endRow}`,
        values: Array(numRows).fill([params.reason]),
      })),
    },
  });

  await applyBgColors(
    sheets,
    matchingTabs.map((s) => ({
      sheetId: s.properties!.sheetId!,
      colIndex: colIdx,
      startRow: startRow - 1,
      numRows,
      color: COLOR_CLOSURE,
    })),
  );
}

/**
 * Clears a closure (values + color) from all existing tabs within the date range.
 */
export async function clearClosureFromSheets(params: {
  date_from: string;
  date_to: string;
  court_name: string;
  start_time: string;
  end_time: string;
}): Promise<void> {
  const col = COURT_COLUMNS[params.court_name];
  const colIdx = COURT_COL_INDICES[params.court_name];
  if (!col || colIdx === undefined) return;

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const tabs = meta.data.sheets ?? [];

  const startRow = timeToRow(params.start_time.slice(0, 5));
  const endRow = timeToRow(params.end_time.slice(0, 5)) - 1;
  if (endRow < startRow) return;
  const numRows = endRow - startRow + 1;

  const matchingTabs = tabs
    .filter((s) => {
      const title = s.properties?.title ?? '';
      const dateStr = parseDateFromSheetName(title);
      if (!dateStr) return false;
      return dateStr >= params.date_from && dateStr <= params.date_to;
    });

  for (const s of matchingTabs) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: `'${s.properties!.title}'!${col}${startRow}:${col}${endRow}`,
    });
  }

  await applyBgColors(
    sheets,
    matchingTabs.map((s) => ({
      sheetId: s.properties!.sheetId!,
      colIndex: colIdx,
      startRow: startRow - 1,
      numRows,
      color: COLOR_CLEAR,
    })),
  );
}

export async function writeBookingToSheet(params: {
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  court_name: string;
  user_name: string;
  phone: string;
}): Promise<void> {
  const col = COURT_COLUMNS[params.court_name];
  const colIdx = COURT_COL_INDICES[params.court_name];
  if (!col || colIdx === undefined) return;

  const sheetName = getSheetName(params.date);
  const startRow = timeToRow(params.start_time.slice(0, 5));
  const numRows = params.duration_minutes / 30;
  const endRow = startRow + numRows - 1;

  const cellValue = `${params.user_name}\n${params.phone}`;
  const range = `'${sheetName}'!${col}${startRow}:${col}${endRow}`;

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const sheetId = await ensureSheet(sheets, sheetName, params.date);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: Array(numRows).fill([cellValue]) },
  });

  await applyBgColors(sheets, [{
    sheetId,
    colIndex: colIdx,
    startRow: startRow - 1, // 0-based
    numRows,
    color: COLOR_ONCE,
  }]);
}

export async function clearBookingFromSheet(params: {
  date: string;
  start_time: string;
  duration_minutes: number;
  court_name: string;
}): Promise<void> {
  const col = COURT_COLUMNS[params.court_name];
  const colIdx = COURT_COL_INDICES[params.court_name];
  if (!col || colIdx === undefined) return;

  const sheetName = getSheetName(params.date);
  const startRow = timeToRow(params.start_time.slice(0, 5));
  const numRows = params.duration_minutes / 30;
  const endRow = startRow + numRows - 1;

  const range = `'${sheetName}'!${col}${startRow}:${col}${endRow}`;

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === sheetName)?.properties?.sheetId;

  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range });

  if (sheetId !== undefined && sheetId !== null) {
    await applyBgColors(sheets, [{
      sheetId,
      colIndex: colIdx,
      startRow: startRow - 1,
      numRows,
      color: COLOR_CLEAR,
    }]);
  }
}
