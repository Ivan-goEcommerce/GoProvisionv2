# GoProvisions Web (GUI only)

Dieser Ordner enthaelt nur das Frontend (Login, Admin GUI, Employee GUI).

## Environment

Nutze nur Frontend-Variablen mit `NEXT_PUBLIC_` Prefix:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Wichtig:

- Niemals `SUPABASE_SERVICE_ROLE_KEY` im `web`-Ordner verwenden.
- Backend-Secrets gehoeren nur in `backend/.env`.

## Local Development

```bash
npm install
npm run dev
```

Dann: `http://localhost:3000`

## Frontend Routes

- `/` Login
- `/admin` Admin-Dashboard
- `/employee` Employee-Dashboard

## Docker

Der Root-`docker-compose.yml` baut und startet diesen Ordner als `web` Service.
