# Orthodontics Workflow Automation System (OWAS)

Client-only web system for orthodontic clinic workflows using:
- HTML
- CSS
- Vanilla JavaScript
- Supabase (Auth, Postgres, Storage, RLS, Realtime, Edge Functions)

## 1. Project Structure

```text
/owas
├── index.html
├── dashboard.html
├── patients.html
├── patient-details.html
├── dental-chart.html
├── appointments.html
├── queue.html
├── reports.html
├── logbook.html
├── materials.html
├── admin.html
├── css/
│   └── styles.css
├── js/
│   ├── supabaseClient.js
│   ├── auth.js
│   ├── rbac.js
│   ├── patients.js
│   ├── dentalChart.js
│   ├── appointments.js
│   ├── queue.js
│   ├── reports.js
│   ├── logbook.js
│   ├── materials.js
│   └── audit.js
└── supabase-schema.sql
```

## 2. Connect Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `supabase-schema.sql`.
3. In Supabase dashboard:
- `Authentication` -> enable Email/Password.
- `Storage` -> confirm `radiographs` bucket exists (SQL creates it).
- `Database` -> verify RLS is enabled and policies are created.
4. Open `index.html` in browser.
5. Enter:
- Supabase URL (`https://<project-ref>.supabase.co`)
- Anon Key
6. Save configuration. It is stored in browser localStorage as `owas_supabase_config`.

## 3. Add Users and Roles

1. Open `admin.html` as an Admin account.
2. Use **Create New User** and enter:
- `Email`
- `Temporary Password`
- `Full Name`
- `Role`
3. System auto-generates the Auth user ID and inserts profile into `public.users`.

Important:
- Deploy Edge Function `admin-create-user` first (section below), otherwise user creation in Admin Console will fail.

Default roles:
- Admin
- ConsultantOrthodontist
- DentalSurgeon
- Clinician
- Nurse
- Student

## 4. Configure RLS

RLS is already included in `supabase-schema.sql` for all required tables and storage objects.

Key restrictions:
- Patient editing: clinical roles only.
- Radiographs: role-restricted and uploader-aware.
- Reports: supervisors/admin only.
- Materials write: Admin and Nurse.
- Student cases/logbook: student submit + supervisor approval.
- Audit logs: all writes tied to logged-in user.

## 5. Edge Functions

### 5.1 Admin user creation function

This is required for Admin Console user creation. It uses Supabase Admin API safely instead of direct SQL inserts into `auth.*`.

Source file in this repo:
- `owas/supabase/functions/admin-create-user/index.ts`

Deploy:

```bash
supabase functions deploy admin-create-user
```

Set required secrets (if not already present):

```bash
supabase secrets set SUPABASE_URL=YOUR_URL
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### 5.2 Appointment reminder function

Create a Supabase Edge Function named `send-appointment-reminders`.

Example function stub:

```ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1) Load appointments in next 24h
  // 2) Send email via provider
  // 3) Update reminder_sent_at
  // 4) Return sent count

  return new Response(JSON.stringify({ sent: 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

Deploy:

```bash
supabase functions deploy send-appointment-reminders
```

## 6. Deploy to GitHub Pages

1. Push the `owas` folder to a GitHub repo.
2. In repo settings, enable GitHub Pages from `main` branch root (or `/docs` if you move files).
3. Ensure all page links remain `.html`.
4. Open deployed `index.html`, set Supabase URL + anon key, then sign in.

## 7. Security and Ops Notes

- Session inactivity timeout is implemented in `js/auth.js` (15 minutes).
- All business logic runs client-side with Supabase RLS as backend enforcement.
- Ensure anon key is used only with strict RLS policies (already included).
- Keep service role key out of frontend.

## 8. Performance Notes

- Patients list uses pagination (`10` rows/page).
- Indexed columns added for patient name, dates, foreign keys.
- Realtime queue uses Supabase Realtime channel (`queue-live`).
