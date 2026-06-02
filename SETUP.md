# Iris Portaal — Setup instructies

## Stap 1: Google Spreadsheet aanmaken

Maak een nieuwe Google Spreadsheet aan en voeg de volgende tabbladen toe (in deze volgorde, rij 1 = headers):

| Tabblad | Headers (exact zo) |
|---|---|
| `users` | user_id, email, pin_hash, role, name, language, onesignal_player_id, invite_token, invite_expires, activated, onboarding_done, created_at, last_login |
| `sessions` | session_id, user_id, token, expires_at, created_at |
| `projects` | project_id, name, description, status, start_date, created_at, updated_at |
| `project_members` | member_id, project_id, user_id, added_at |
| `phases` | phase_id, project_id, name, order, status, budget_hours, hourly_rate, created_at, updated_at |
| `hours` | hour_id, phase_id, project_id, date, duration_minutes, category, description, created_at, updated_at, is_deleted |
| `hours_log` | log_id, hour_id, changed_at, changed_by, field_changed, old_value, new_value, reason |
| `travel_costs` | travel_id, phase_id, project_id, date, type, description, amount, km, km_rate, total, created_at |
| `expenses` | expense_id, phase_id, project_id, date, description, amount, receipt_file_id, created_at |
| `invoices` | invoice_id, phase_id, project_id, invoice_date, amount, description, pdf_file_id, visible_to_client, created_at |
| `documents` | document_id, project_id, phase_id, name, type, storage_type, file_id, external_url, uploaded_at, notification_sent |
| `terms` | terms_id, file_id, updated_at, updated_by |
| `settings` | key, value, updated_at |

### Eerste rijen toevoegen

**users** (rij 2 — Iris zelf):
```
usr_iris | iris@example.com | <SHA256 van pincode> | admin | Iris van Gelder | nl | | | | TRUE | TRUE | 2026-01-01 |
```

**settings** (rijen 2–6):
```
km_rate_default | 0.23 | 2026-01-01
onesignal_app_id | <jouw OneSignal App ID> | 2026-01-01
onesignal_api_key | <jouw OneSignal API Key> | 2026-01-01
admin_email | iris@example.com | 2026-01-01
session_duration_hours | 8 | 2026-01-01
```

---

## Stap 2: Google Apps Script aanmaken

1. Open de Spreadsheet
2. Extensies → Apps Script
3. Verwijder de bestaande `Code.gs`
4. Maak de volgende bestanden aan en plak de code vanuit `gas/`:
   - `Code.gs`
   - `Sheets.gs`
   - `Auth.gs`
   - `Projects.gs`
   - `Hours.gs`
   - `Finance.gs`
   - `Documents.gs`
   - `Notifications.gs`
   - `Backup.gs`

---

## Stap 3: Script Properties instellen

In GAS → Projectinstellingen → Scripteigenschappen:

| Key | Waarde |
|---|---|
| `SHEET_ID` | ID van jouw Google Spreadsheet (uit de URL) |
| `BACKUP_FOLDER_ID` | ID van een Google Drive map voor backups |
| `BASE_URL` | GitHub Pages URL, bijv. `https://jouwgebruiker.github.io/iris-portaal` |
| `ONESIGNAL_APP_ID` | OneSignal App ID (optioneel) |
| `ONESIGNAL_API_KEY` | OneSignal REST API Key (optioneel) |

---

## Stap 4: GAS deployen als Web App

1. GAS → Implementeren → Nieuwe implementatie
2. Type: **Webtoepassing**
3. Uitvoeren als: **Ik** (jouw Google-account)
4. Toegang: **Iedereen**
5. Klik op **Implementeren**
6. Kopieer de deployment URL

---

## Stap 5: Front-end configureren

Open `js/api.js` en vervang:
```javascript
'PASTE_YOUR_GAS_DEPLOYMENT_URL_HERE'
```
door de deployment URL uit stap 4.

Of sla de URL op in `localStorage` via de browser console:
```javascript
localStorage.setItem('gas_url', 'https://script.google.com/macros/s/.../exec');
```

---

## Stap 6: Hosten via GitHub Pages

1. Maak een GitHub repository aan
2. Push alle bestanden (alles behalve de `gas/` map) naar de `main` branch
3. Instellingen → Pages → Source: `main` / `root`
4. Wacht 1–2 minuten, dan is de app live op `https://jouwgebruiker.github.io/iris-portaal`

---

## Stap 7: PWA-iconen

Voeg toe in `assets/icons/`:
- `icon-192.png` — 192×192 px (bijv. logo op warm witte achtergrond)
- `icon-512.png` — 512×512 px

---

## Stap 8: Dagelijkse backup instellen

In GAS → Triggers → Trigger toevoegen:
- Functie: `runDailyBackup`
- Gebeurtenisbron: Tijdgebaseerd
- Type trigger: Dagtimer
- Tijdstip: 3:00–4:00

---

## Admin eerste login

Iris logt in met haar e-mailadres en pincode via de inlogpagina. Als admin wordt ze doorgestuurd naar het dashboard.

De SHA-256 hash van een pincode kun je berekenen via:
```javascript
// In de browser console:
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
sha256('1234').then(console.log);
```
