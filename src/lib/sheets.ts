import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];

const COURT_COLUMNS: Record<string, string> = {
  'Cancha 1': 'B',
  'Cancha 2': 'C',
  'Cancha 3': 'D',
};

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

/** Generates time slot labels for column A: ["8:00-8:30", "8:30-9:00", ..., "22:30-23:00"] */
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
 * Ensures a sheet tab with the given name exists.
 * If it doesn't, creates it and populates headers + time slots.
 */
async function ensureSheet(
  sheets: ReturnType<typeof google.sheets>,
  sheetName: string,
): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const exists = meta.data.sheets?.some(
    (s) => s.properties?.title === sheetName,
  );

  if (exists) return;

  // Create the tab
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [{ addSheet: { properties: { title: sheetName } } }],
    },
  });

  // Populate header row + time slots in column A
  const timeSlots = generateTimeSlots();
  const headerRow = [sheetName, 'Cancha 1', 'Cancha 2', 'Cancha 3'];
  const values = [headerRow, ...timeSlots.map((t) => [t])];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A1:D1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headerRow] },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `'${sheetName}'!A2:A${1 + timeSlots.length}`,
    valueInputOption: 'RAW',
    requestBody: { values: timeSlots.map((t) => [t]) },
  });

  // Suppress unused variable warning
  void values;
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
  if (!col) return;

  const sheetName = getSheetName(params.date);
  const startRow = timeToRow(params.start_time.slice(0, 5));
  const numRows = params.duration_minutes / 30;
  const endRow = startRow + numRows - 1;

  const startTime = params.start_time.slice(0, 5);
  const endTime = params.end_time.slice(0, 5);
  const cellValue = `${params.user_name}\n${startTime}-${endTime}\n${params.phone}`;

  const range = `'${sheetName}'!${col}${startRow}:${col}${endRow}`;

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  await ensureSheet(sheets, sheetName);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: Array(numRows).fill([cellValue]) },
  });
}

export async function clearBookingFromSheet(params: {
  date: string;
  start_time: string;
  duration_minutes: number;
  court_name: string;
}): Promise<void> {
  const col = COURT_COLUMNS[params.court_name];
  if (!col) return;

  const sheetName = getSheetName(params.date);
  const startRow = timeToRow(params.start_time.slice(0, 5));
  const numRows = params.duration_minutes / 30;
  const endRow = startRow + numRows - 1;

  const range = `'${sheetName}'!${col}${startRow}:${col}${endRow}`;

  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range,
  });
}
