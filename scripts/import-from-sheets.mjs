/**
 * import-from-sheets.mjs
 *
 * Lee la planilla de Google Sheets para la semana 06/04 – 12/04/2026
 * y carga los turnos en Supabase.
 *
 * Convención de colores en la planilla VIEJA:
 *   - Naranja  → clase fija  (se importa como fixed_booking)
 *   - Cualquier otro color con texto → turno casual (se importa como booking)
 *   - Blanco/vacío → ignorado
 *
 * Uso:
 *   node scripts/import-from-sheets.mjs
 *   node scripts/import-from-sheets.mjs --dry-run   (solo muestra, no escribe)
 */

import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Cargar .env.local ────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=');
  if (key && !key.startsWith('#') && rest.length) {
    process.env[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '');
  }
}

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('🔍 DRY RUN — no se escribirá nada en Supabase\n');

// ─── Config ───────────────────────────────────────────────────────────────────
const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const DATES = [
  '2026-04-06', // Lunes
  '2026-04-07', // Martes
  '2026-04-08', // Miércoles
  '2026-04-09', // Jueves
  '2026-04-10', // Viernes
  '2026-04-11', // Sábado
  '2026-04-12', // Domingo
];

const COURT_COLS = { B: 'Cancha 1', C: 'Cancha 2', D: 'Cancha 3' };
const COL_INDICES = { B: 1, C: 2, D: 3 }; // 0-based

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSheetName(dateStr) {
  const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return `${DAYS[d.getDay()]} ${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}`;
}

/** row (1-based) → "HH:MM:00" */
function rowToTime(row) {
  const totalMin = 480 + (row - 2) * 30;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/** "HH:MM:00" + minutes → "HH:MM:00" */
function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
}

/** Returns true if the cell background looks orange (clase fija en planilla vieja) */
function isOrange(color) {
  if (!color) return false;
  const r = color.red ?? 0;
  const g = color.green ?? 0;
  const b = color.blue ?? 0;
  return r > 0.8 && g > 0.3 && g < 0.8 && b < 0.3;
}

/** Returns true if the cell has any non-white / non-default background */
function hasColor(color) {
  if (!color) return false;
  const r = color.red ?? 1;
  const g = color.green ?? 1;
  const b = color.blue ?? 1;
  // Ignorar blanco y casi-blanco
  return !(r > 0.95 && g > 0.95 && b > 0.95);
}

/** Parsea el contenido de una celda: "Nombre\nHH:MM-HH:MM\nTeléfono" o "Nombre\nTeléfono" */
function parseCell(rawValue) {
  if (!rawValue) return null;
  const lines = rawValue.split('\n').map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const name = lines[0];
  // buscar teléfono (línea que tenga solo dígitos/guiones/espacios)
  const phoneIdx = lines.findIndex((l, i) => i > 0 && /^[\d\s\-+()]+$/.test(l));
  const phone = phoneIdx !== -1 ? lines[phoneIdx].replace(/\s/g, '') : null;
  return { name, phone };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Traer canchas
  const { data: courts } = await supabase.from('courts').select('id, name');
  const courtIdByName = Object.fromEntries(courts.map(c => [c.name, c.id]));
  console.log('Canchas:', courtIdByName);

  let totalFixed = 0;
  let totalBookings = 0;
  let totalSkipped = 0;

  for (const dateStr of DATES) {
    const sheetName = getSheetName(dateStr);
    console.log(`\n📅 ${sheetName} (${dateStr})`);

    // Leer hoja con datos de celdas (valores + colores)
    let spreadsheet;
    try {
      spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SHEET_ID,
        ranges: [`'${sheetName}'!A1:D31`],
        includeGridData: true,
      });
    } catch (e) {
      console.log(`  ⚠️  Hoja "${sheetName}" no encontrada, saltando.`);
      continue;
    }

    const sheetData = spreadsheet.data.sheets?.[0];
    if (!sheetData) { console.log('  ⚠️  Sin datos.'); continue; }

    const gridData = sheetData.data?.[0];
    const rows = gridData?.rowData ?? [];

    // Parsear por columna (B, C, D)
    for (const [colLetter, courtName] of Object.entries(COURT_COLS)) {
      const colIdx = COL_INDICES[colLetter];
      const courtId = courtIdByName[courtName];
      if (!courtId) continue;

      const [yyyy, mm, dd] = dateStr.split('-').map(Number);
      const weekday = new Date(yyyy, mm - 1, dd).getDay();

      // Agrupar celdas consecutivas con el mismo contenido
      let i = 1; // empezamos en row index 1 (row 2 = 08:00)
      while (i < rows.length) {
        const rowData = rows[i];
        const cell = rowData?.values?.[colIdx];
        const rawValue = cell?.formattedValue ?? cell?.userEnteredValue?.stringValue ?? '';

        if (!rawValue) { i++; continue; }

        const color = cell?.userEnteredFormat?.backgroundColor
                   ?? cell?.effectiveFormat?.backgroundColor;
        const orange = isOrange(color);
        const colored = hasColor(color);

        // Contar cuántas filas consecutivas tienen el mismo valor
        let spanRows = 1;
        while (
          i + spanRows < rows.length &&
          (rows[i + spanRows]?.values?.[colIdx]?.formattedValue ?? '') === rawValue
        ) {
          spanRows++;
        }

        const startTime = rowToTime(i + 1); // i es 0-based, rows 1-based → row = i+1, pero row 2 = 08:00 → usamos i+2?
        // row index 1 (0-based) = row 2 (1-based) = 08:00 → rowToTime(2)
        const startTimeStr = rowToTime(i + 2); // i es 0-based dentro del array, row en sheet = i+1 (pero header es row 1, datos desde row 2)
        const durationMin = spanRows * 30;
        const endTimeStr = addMinutes(startTimeStr, durationMin);
        const parsed = parseCell(rawValue);

        if (!parsed) { i += spanRows; continue; }

        if (orange) {
          // ── CLASE FIJA ──
          console.log(`  🟠 FIJO  | ${courtName} | ${startTimeStr.slice(0,5)}-${endTimeStr.slice(0,5)} | ${durationMin}min | "${parsed.name}"`);

          if (!DRY_RUN) {
            const { error } = await supabase.from('fixed_bookings').insert({
              court_id: courtId,
              weekday,
              start_time: startTimeStr,
              duration_minutes: durationMin,
              label: parsed.name,
            });
            if (error) {
              if (error.code === '23505') {
                console.log(`    ↳ Ya existe, saltando.`);
                totalSkipped++;
              } else {
                console.error(`    ↳ Error:`, error.message);
              }
            } else {
              totalFixed++;
            }
          } else {
            totalFixed++;
          }
        } else if (colored || parsed.phone) {
          // ── TURNO CASUAL ──
          console.log(`  🟡 TURNO | ${courtName} | ${dateStr} | ${startTimeStr.slice(0,5)}-${endTimeStr.slice(0,5)} | ${durationMin}min | "${parsed.name}" ${parsed.phone ?? '(sin tel)'}`);

          if (!DRY_RUN && parsed.phone) {
            // Upsert usuario
            let userId;
            const { data: existingUser } = await supabase
              .from('users')
              .select('id')
              .eq('phone', parsed.phone)
              .single();

            if (existingUser) {
              userId = existingUser.id;
            } else {
              const { data: newUser, error: userErr } = await supabase
                .from('users')
                .insert({ name: parsed.name, phone: parsed.phone })
                .select('id')
                .single();
              if (userErr) { console.error('    ↳ Error usuario:', userErr.message); i += spanRows; continue; }
              userId = newUser.id;
            }

            // Insertar booking
            const { error: bookErr } = await supabase.from('bookings').insert({
              court_id: courtId,
              user_id: userId,
              date: dateStr,
              start_time: startTimeStr,
              end_time: endTimeStr,
              duration_minutes: durationMin,
              status: 'confirmed',
            });

            if (bookErr) {
              if (bookErr.code === '23505') {
                console.log(`    ↳ Ya existe, saltando.`);
                totalSkipped++;
              } else {
                console.error(`    ↳ Error booking:`, bookErr.message);
              }
            } else {
              totalBookings++;
            }
          } else if (!parsed.phone) {
            console.log(`    ↳ Sin teléfono, saltando.`);
            totalSkipped++;
          } else {
            totalBookings++;
          }
        }

        i += spanRows;
      }
    }
  }

  console.log('\n─────────────────────────────────────');
  console.log(`✅ Clases fijas importadas : ${totalFixed}`);
  console.log(`✅ Turnos importados       : ${totalBookings}`);
  console.log(`⏭️  Saltados               : ${totalSkipped}`);
  if (DRY_RUN) console.log('\n(dry-run: no se escribió nada)');
}

main().catch(console.error);
