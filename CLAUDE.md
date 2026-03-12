# Gestor de Turnos — Once Unidos

## Stack
- Next.js 16 (App Router) + TypeScript
- Supabase Postgres (proyecto: bxqnalryepkxdqmfosdt)
- Tailwind CSS
- date-fns v4
- Resend (emails de confirmación/cancelación)

## Comandos útiles
```bash
npm run dev      # dev server en localhost:3000
npm run build    # build de producción
npm run lint     # lint
```

## Variables de entorno
Están en `.env.local`. Las clave son:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_SECRET_KEY=admin123`
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL`
- `NEXT_PUBLIC_APP_URL`

## Base de datos (Supabase)
Tablas: `courts`, `users`, `bookings`, `fixed_bookings`
Migraciones en `supabase/migrations/`.

## Reglas de negocio
- Reservas: hoy + 7 días, bloques de 30 min, 08:00–23:00
- Duraciones: 60, 90 o 120 minutos
- Máximo 1 reserva por usuario (phone) por día
- Cancelación < 24h → `late_cancelled`
- Usuarios pueden estar bloqueados (`blocked_until`)
- Clases fijas (`fixed_bookings`) no son reservables

## Estructura principal
```
src/
  app/
    api/          # API routes (bookings, availability, admin)
    reservar/     # Grilla de turnos
    mis-reservas/ # Ver/cancelar reservas propias
    admin/        # Panel admin (reservas, clases fijas, usuarios)
  components/     # DayNav, CourtGrid, BookingModal
  lib/            # supabase/client.ts, supabase/server.ts, slots.ts, notifications.ts
  types/          # index.ts
```

## Preferencias
- Español rioplatense (vos, dale)
- Ejecutar comandos directamente cuando sea posible
- Explicar paso a paso cuando haya acciones en herramientas externas
