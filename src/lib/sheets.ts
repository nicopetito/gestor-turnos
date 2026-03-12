import { google } from 'googleapis';

const SHEET_ID = process.env.GOOGLE_SHEETS_ID!;

const DAYS_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

const COURT_COLUMNS: Record<string, string> = {
  'Cancha 1': 'B',
  'Cancha 2': 'C',
  'Cancha 3': 'D',
};

/** Converts "2026-03-11" → "MIERCOLES (11032026)" */
function getSheetName(dateStr: string): string {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  const dayName = DAYS_ES[date.getDay()];
  return `${dayName} (${String(dd).padStart(2, '0')}${String(mm).padStart(2, '0')}${yyyy})`;
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
