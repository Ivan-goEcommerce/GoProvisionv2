# GoProvision v2

GoProvision ist eine webbasierte Provisionsplattform fuer Unternehmen mit Vertriebs- oder Partnerprovisionsmodell.  
Die Anwendung vereint:

- **Authentifizierung und Rollensteuerung** ueber Supabase Auth
- **Mitarbeiter-Sicht** auf eigene Provisionen
- **Admin-Sicht** fuer Verwaltung, Statusaenderungen und Export
- **Webhook-Ingestion** fuer externe Systeme, die Provisionsfaelle liefern

Der Fokus liegt auf einem klaren, operativen Workflow zwischen Fachabteilung (Admin), Mitarbeitenden und externen Quellsystemen.

## Projektueberblick

### Was die Anwendung ist

Eine Full-Stack-Anwendung mit:

- **Web-Frontend** (Next.js) fuer Login, Passwort-Reset, Mitarbeiter- und Admin-Dashboard
- **Backend-API** (FastAPI) fuer geschuetzte Admin-Operationen, Webhook-Verarbeitung und Health-Checks
- **Supabase** als Auth- und Datenplattform (Tabellenabfragen aus Code: `employees`, `commissions`)

### Welches Problem sie loest

GoProvision digitalisiert den Prozess, Provisionen:

- aus externen Ereignissen zu erzeugen (Webhook),
- den richtigen Mitarbeitenden zuzuordnen,
- im Lebenszyklus zu verfolgen (`open`, `in_progress`, `paid`, `cancelled`),
- transparent fuer Mitarbeitende und Admins bereitzustellen,
- fuer nachgelagerte Prozesse als CSV zu exportieren.

### Fuer wen sie gedacht ist

- **Mitarbeitende**: sehen ihre eigenen Provisionsfaelle und Summen.
- **Admins/Operations/Finance-nahe Rollen**: steuern Status, verwalten Mitarbeiter-Rollen/Aktivitaet, exportieren Vormonatsdaten.
- **Externe Integrationen**: liefern Provisionsevents ueber einen geschuetzten Webhook-Endpunkt.

## Hauptfunktionen

- Login mit E-Mail/Passwort (Supabase Auth)
- Passwort-Reset via E-Mail-Link und dedizierter Reset-Seite
- Rollenbasierte Weiterleitung (`/admin` vs. `/employee`)
- Mitarbeiter-Dashboard mit Filtern (Status/Monat) und Summen (open/paid)
- Admin-Dashboard mit:
  - Provisionsliste inkl. Mitarbeiterbezug
  - Statusaenderung einzelner Provisionen
  - Mitarbeiterverwaltung (Rolle/Aktiv)
  - CSV-Export fuer offene Vormonats-Provisionen (im Export auf `paid` projiziert, ohne DB-Update)
- Webhook-Endpunkt zur Erstellung mehrerer Provisionseintraege auf Basis von Teilnehmern
- Health-Endpunkt fuer Betriebspruefung

## Architekturueberblick

### High-Level

- **`web/`**: Next.js Frontend (Client Components), Supabase Browser Client, API-Aufrufe
- **`backend/`**: FastAPI API, Services (Business-Logik), Schemas (Pydantic), Error Handling, Logging
- **Supabase**:
  - Authentifizierung (User/Session)
  - Persistenz fuer `employees` und `commissions`
- **`nginx/` + `docker-compose.yml`**: Reverse Proxy (Routing `/api` -> Backend, `/` -> Web), optional HTTPS je nach vorhandenem Zertifikat

### Wichtige Verzeichnisse

- `backend/main.py`: App-Setup, Middleware, Router-Registrierung
- `backend/api/routes/`: HTTP-Endpunkte (`health`, `webhooks`, `admin`)
- `backend/services/`: Business-Logik (`commission_service`, `admin_service`, `admin_export_service`)
- `backend/schemas/`: Request-/Response-Modelle und Validierung
- `backend/core/`: Konfiguration, Logging, Fehlerbehandlung, Request-Kontext
- `web/src/app/`: Seiten (`/`, `/admin`, `/employee`, `/reset-password`)
- `web/src/lib/`: Auth-, Supabase- und Backend-Clientlogik
- `web/src/components/`: UI-Bausteine (u. a. Dashboard-Shell)

## Datenmodell-/Konzeptueberblick (aus Code ableitbar)

> Hinweis: SQL-Migrationen/DDL sind im Repository nicht eindeutig ersichtlich. Felder unten basieren auf den im Code selektierten/geschriebenen Spalten.

### Tabelle `employees` (verwendete Felder)

- `id`
- `auth_user_id`
- `name`
- `email`
- `role` (`admin` oder `employee`)
- `active` (bool)

### Tabelle `commissions` (verwendete Felder)

- `id`
- `employee_id`
- `reason`
- `description`
- `revenue_amount`
- `commission_rate`
- `commission_amount`
- `status` (`open`, `in_progress`, `paid`, `cancelled`)
- `source` (z. B. `webhook`)
- `source_url`
- `external_id`
- `created_at`
- `paid_at`

### Geschaeftsregeln (aus Services)

- Webhook erzeugt **eine Provision pro Teilnehmer**.
- Teilnehmer-E-Mails muessen in `employees` existieren und `active=true` sein.
- `external_id`-Kollision wird als Konflikt behandelt (HTTP 409).
- Bei Statuswechsel auf `paid` wird `paid_at` gesetzt, sonst `paid_at=None`.
- CSV-Export nimmt offene Vormonatsprovisionen und projiziert sie im CSV auf `paid` + aktuelles `paid_at` (kein DB-Schreibvorgang im Export-Flow).

## Typische User-Flows

### 1) Login und Routing

1. User meldet sich im Frontend an.
2. Profil wird ueber `employees.auth_user_id` geladen.
3. Bei `active=false` wird Session beendet.
4. Weiterleitung je Rolle zu `/admin` oder `/employee`.

### 2) Mitarbeiter-Dashboard

1. Auth-Session pruefen.
2. Eigene Provisionen laden (nach `employee_id`).
3. Filter anwenden (Status/Monat).
4. Summen fuer offene und bezahlte Provisionen anzeigen.

### 3) Admin-Dashboard

1. Access Token aus Supabase Session holen.
2. Backend prueft, ob User in `employees` aktiv und `role=admin` ist.
3. Admin kann Provisionen filtern, Status aendern, Mitarbeiterdaten aktualisieren.
4. CSV-Export fuer Vormonat ausloesen.

### 4) Externe Webhook-Integration

1. Externes System sendet POST auf `/api/webhooks/commissions`.
2. Backend validiert Bearer-Token gegen `WEBHOOK_SECRET`.
3. Payload wird validiert, Provisionszeilen berechnet und gespeichert.
4. API gibt erzeugte Provisionseintraege zurueck.

## Voraussetzungen

- **Python 3.13** (gem. `backend/Dockerfile`)
- **Node.js 22** und **npm** (gem. `web/Dockerfile`)
- Zugriff auf ein konfiguriertes **Supabase-Projekt** (Auth + Tabellen)
- Optional: **Docker** + **Docker Compose** fuer Containerbetrieb

## Lokales Setup (Schritt fuer Schritt)

### 1) Repository klonen und ins Root wechseln

```bash
git clone <repo-url>
cd GoProvisionv2
```

### 2) Frontend-Umgebung vorbereiten

Im Projektroot liegt `.env.example` mit Frontend-Variablen:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key
NEXT_PUBLIC_API_URL=
```

Diese Werte als lokale Umgebungsvariablen setzen (oder in eine passende env-Datei fuer dein Setup uebernehmen).

### 3) Backend-Abhaengigkeiten installieren

```bash
pip install -r backend/requirements.txt
```

### 4) Frontend-Abhaengigkeiten installieren

```bash
cd web
npm install
cd ..
```

## Konfiguration / Umgebungsvariablen

### Sicher aus Code ableitbar

**Backend (`backend/core/config.py`)**

- `SUPABASE_URL` (erforderlich)
- `SUPABASE_SERVICE_ROLE_KEY` (optional, aber fuer privilegierte Backend-Zugriffe vorgesehen)
- `SUPABASE_KEY` (Fallback, wenn `SUPABASE_SERVICE_ROLE_KEY` leer ist)
- `WEBHOOK_SECRET` (Webhook-Authentifizierung)
- `CORS_ALLOW_ORIGINS` (CSV-Liste, Default auf localhost:3000/127.0.0.1:3000)
- `APP_NAME`, `APP_ENV`, `APP_VERSION`, `LOG_LEVEL` (mit Defaults)

**Web (`web/src/lib/supabase.ts`, `web/src/lib/auth.ts`)**

- `NEXT_PUBLIC_SUPABASE_URL` (erforderlich)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (erforderlich)
- `NEXT_PUBLIC_API_URL` (optional; falls leer, Fallback-Logik aktiv)

### Nicht eindeutig im Code ersichtlich

- Vollstaendige, produktive `.env`-Beispiele fuer das Backend (Datei fehlt im Root/Backend).
- Exakte Supabase-RLS-Policies und SQL-Schema-Definitionen.

## Starten von Backend und Web

### Variante A: Lokal ohne Docker

**Backend starten (aus Repo-Root):**

```bash
uvicorn backend.main:app --reload --port 8000
```

**Web starten (zweites Terminal):**

```bash
cd web
npm run dev
```

Danach:

- Web: `http://localhost:3000`
- Backend-Health: `http://localhost:8000/api/health`

### Variante B: Mit Docker Compose

```bash
docker compose up --build
```

Routing laut Nginx:

- `/api/*` -> Backend (`backend:8000`)
- `/` -> Web (`web:3000`)

## Tests und Linting

### Im Repository ersichtlich

- **Web Linting:** `npm run lint` (ESLint)
- **Backend:** keine expliziten Testdateien/pytest-Konfiguration im aktuellen Stand gefunden

### Nicht eindeutig im Code ersichtlich

- Standardisierter Backend-Lint/Formatter-Command (z. B. `ruff`, `black`) als projektweiter Task.

## API- und Integrationshinweise

### Health

- `GET /api/health`  
  Liefert Service-Metadaten (`status`, `service`, `environment`, `version`).

### Webhook

- `POST /api/webhooks/commissions`
- Header: `Authorization: Bearer <WEBHOOK_SECRET>`
- Erstellt Provisionen aus einem Payload mit `revenue`, `reason`, optional `description/source_url/external_id`, `status` und `participants[]`.

### Admin API (Bearer Token aus Supabase Session erforderlich)

- `GET /api/admin/commissions`
- `PATCH /api/admin/commissions/{commission_id}/status`
- `GET /api/admin/employees`
- `PATCH /api/admin/employees/{employee_id}`
- `POST /api/admin/commissions/export-previous-month`

## Bekannte Grenzen / TODOs (belegbar)

- Root-README war nicht vorhanden; Dokumentation war bisher auf `backend/README.md` und `web/README.md` verteilt.
- Datenbank-Schema und Migrationen sind nicht im Repository dokumentiert; Tabellenstruktur ist nur indirekt aus Code ableitbar.
- Automatisierte Backend-Tests sind im aktuellen Stand nicht ersichtlich.
- CSV-Export projiziert Statusaenderungen nur in der Exportdatei, nicht in der DB (fachlich relevant bei Weiterverarbeitung).

## Lizenz

Nicht eindeutig im Code ersichtlich (keine Lizenzdatei im Repository gefunden).
