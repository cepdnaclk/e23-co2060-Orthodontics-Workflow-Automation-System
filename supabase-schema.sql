-- OWAS Supabase schema + RBAC + RLS
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- ---------------------------
-- RBAC tables
-- ---------------------------
create table if not exists public.roles (
  id smallserial primary key,
  name text unique not null
);

insert into public.roles (name)
values
  ('Admin'),
  ('ConsultantOrthodontist'),
  ('DentalSurgeon'),
  ('Clinician'),
  ('Nurse'),
  ('Student')
on conflict (name) do nothing;

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id smallint not null references public.roles(id),
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_role_id on public.users(role_id);

-- ---------------------------
-- Core clinic tables
-- ---------------------------
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_number text unique not null,
  full_name text not null,
  date_of_birth date,
  sex text,
  phone text,
  email text,
  address text,
  medical_history text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patients_full_name on public.patients(full_name);

create table if not exists public.visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  clinician_id uuid references public.users(id),
  visit_date timestamptz not null,
  chief_complaint text,
  status text not null default 'Open',
  created_at timestamptz not null default now()
);

create index if not exists idx_visits_patient_id on public.visits(patient_id);
create index if not exists idx_visits_visit_date on public.visits(visit_date);
create index if not exists idx_visits_clinician_id on public.visits(clinician_id);

create table if not exists public.dental_charts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid not null unique references public.visits(id) on delete cascade,
  visit_date date not null,
  chart_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_dental_charts_patient_id on public.dental_charts(patient_id);

create table if not exists public.treatment_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  author_id uuid not null references public.users(id),
  note_html text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_treatment_notes_visit_id on public.treatment_notes(visit_id);

create table if not exists public.radiographs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  uploaded_by uuid not null references public.users(id),
  file_name text not null,
  file_path text not null unique,
  file_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_radiographs_patient_id on public.radiographs(patient_id);
create index if not exists idx_radiographs_uploaded_by on public.radiographs(uploaded_by);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_at timestamptz not null,
  reason text,
  status text not null default 'Scheduled',
  reminder_sent_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_patient_id on public.appointments(patient_id);
create index if not exists idx_appointments_appointment_at on public.appointments(appointment_at);

create table if not exists public.queue (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  status text not null default 'Open',
  priority int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_queue_status on public.queue(status);

create table if not exists public.student_cases (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id),
  patient_id uuid references public.patients(id),
  title text not null,
  description text,
  status text not null default 'Submitted',
  created_at timestamptz not null default now()
);

create index if not exists idx_student_cases_student_id on public.student_cases(student_id);

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.student_cases(id) on delete cascade,
  supervisor_id uuid not null references public.users(id),
  status text not null,
  comments text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_approvals_case_id on public.approvals(case_id);

create table if not exists public.logbook_entries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id),
  procedure_name text not null,
  procedure_date date not null,
  details text,
  status text not null default 'Pending',
  verified_by uuid references public.users(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_logbook_entries_student_id on public.logbook_entries(student_id);

create table if not exists public.reports_cache (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  from_date date not null,
  to_date date not null,
  generated_by uuid not null references public.users(id),
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reports_cache_created_at on public.reports_cache(created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  current_stock numeric(12,2) not null default 0,
  threshold numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_materials_name on public.materials(name);

create table if not exists public.material_usage (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  used_qty numeric(12,2) not null,
  used_by uuid not null references public.users(id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_material_usage_material_id on public.material_usage(material_id);

-- ---------------------------
-- Helper functions for policies
-- ---------------------------
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.name
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = auth.uid()
  limit 1
$$;

create or replace function public.has_any_role(allowed text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role_name() = any(allowed), false)
$$;

-- ---------------------------
-- RLS enable
-- ---------------------------
alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.patients enable row level security;
alter table public.visits enable row level security;
alter table public.dental_charts enable row level security;
alter table public.treatment_notes enable row level security;
alter table public.radiographs enable row level security;
alter table public.appointments enable row level security;
alter table public.queue enable row level security;
alter table public.student_cases enable row level security;
alter table public.approvals enable row level security;
alter table public.logbook_entries enable row level security;
alter table public.reports_cache enable row level security;
alter table public.audit_logs enable row level security;
alter table public.materials enable row level security;
alter table public.material_usage enable row level security;

-- roles
create policy "roles read" on public.roles
for select to authenticated
using (true);

-- users
create policy "users read own or admin" on public.users
for select to authenticated
using (id = auth.uid() or public.has_any_role(array['Admin']));

create policy "users upsert admin" on public.users
for all to authenticated
using (public.has_any_role(array['Admin']))
with check (public.has_any_role(array['Admin']));

-- patients
create policy "patients read all authenticated" on public.patients
for select to authenticated
using (true);

create policy "patients create clinical roles" on public.patients
for insert to authenticated
with check (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']));

create policy "patients update clinical roles" on public.patients
for update to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']))
with check (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']));

-- visits
create policy "visits read all" on public.visits
for select to authenticated
using (true);

create policy "visits write clinical" on public.visits
for all to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']))
with check (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']));

-- dental charts
create policy "dental charts read all" on public.dental_charts
for select to authenticated
using (true);

create policy "dental charts write clinical" on public.dental_charts
for all to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']))
with check (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']));

-- treatment notes
create policy "notes read all" on public.treatment_notes
for select to authenticated
using (true);

create policy "notes insert authenticated" on public.treatment_notes
for insert to authenticated
with check (author_id = auth.uid());

create policy "notes update author or admin" on public.treatment_notes
for update to authenticated
using (author_id = auth.uid() or public.has_any_role(array['Admin']))
with check (author_id = auth.uid() or public.has_any_role(array['Admin']));

-- radiographs metadata
create policy "radiographs read by role or uploader" on public.radiographs
for select to authenticated
using (
  public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Nurse'])
  or uploaded_by = auth.uid()
);

create policy "radiographs insert by role or self" on public.radiographs
for insert to authenticated
with check (
  public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Student'])
  and uploaded_by = auth.uid()
);

create policy "radiographs update admin or uploader" on public.radiographs
for update to authenticated
using (public.has_any_role(array['Admin']) or uploaded_by = auth.uid())
with check (public.has_any_role(array['Admin']) or uploaded_by = auth.uid());

-- appointments
create policy "appointments read all" on public.appointments
for select to authenticated
using (true);

create policy "appointments write staff" on public.appointments
for all to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Nurse']))
with check (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Nurse']));

-- queue
create policy "queue read all" on public.queue
for select to authenticated
using (true);

create policy "queue write staff" on public.queue
for all to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Nurse']))
with check (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Nurse']));

-- student cases
create policy "student cases read own or supervisors" on public.student_cases
for select to authenticated
using (
  student_id = auth.uid()
  or public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician'])
);

create policy "student cases submit" on public.student_cases
for insert to authenticated
with check (
  student_id = auth.uid() and public.has_any_role(array['Student'])
);

create policy "student cases approve update" on public.student_cases
for update to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']))
with check (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']));

-- approvals
create policy "approvals read own or supervisors" on public.approvals
for select to authenticated
using (
  supervisor_id = auth.uid()
  or public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician'])
  or exists (
    select 1 from public.student_cases sc
    where sc.id = approvals.case_id and sc.student_id = auth.uid()
  )
);

create policy "approvals insert supervisors" on public.approvals
for insert to authenticated
with check (
  supervisor_id = auth.uid()
  and public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician'])
);

-- logbook
create policy "logbook read own or supervisors" on public.logbook_entries
for select to authenticated
using (
  student_id = auth.uid()
  or public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician'])
);

create policy "logbook insert student" on public.logbook_entries
for insert to authenticated
with check (student_id = auth.uid() and public.has_any_role(array['Student']));

create policy "logbook verify supervisor" on public.logbook_entries
for update to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']))
with check (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']));

-- reports
create policy "reports read supervisors" on public.reports_cache
for select to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']));

create policy "reports insert supervisors" on public.reports_cache
for insert to authenticated
with check (generated_by = auth.uid() and public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician']));

-- audit logs
create policy "audit insert authenticated" on public.audit_logs
for insert to authenticated
with check (user_id = auth.uid());

create policy "audit read admins" on public.audit_logs
for select to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist']));

-- materials
create policy "materials read staff" on public.materials
for select to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Nurse']));

create policy "materials write admin nurse" on public.materials
for all to authenticated
using (public.has_any_role(array['Admin','Nurse']))
with check (public.has_any_role(array['Admin','Nurse']));

-- material usage
create policy "material usage read staff" on public.material_usage
for select to authenticated
using (public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Nurse']));

create policy "material usage insert admin nurse" on public.material_usage
for insert to authenticated
with check (
  used_by = auth.uid()
  and public.has_any_role(array['Admin','Nurse'])
);

-- ---------------------------
-- Storage bucket and RLS for radiographs
-- ---------------------------
insert into storage.buckets (id, name, public)
values ('radiographs', 'radiographs', false)
on conflict (id) do nothing;

create policy "storage radiographs read" on storage.objects
for select to authenticated
using (
  bucket_id = 'radiographs'
  and (
    owner = auth.uid()
    or public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Nurse'])
  )
);

create policy "storage radiographs upload" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'radiographs'
  and (
    owner = auth.uid()
    and public.has_any_role(array['Admin','ConsultantOrthodontist','DentalSurgeon','Clinician','Student'])
  )
);

create policy "storage radiographs update delete" on storage.objects
for all to authenticated
using (
  bucket_id = 'radiographs'
  and (owner = auth.uid() or public.has_any_role(array['Admin']))
)
with check (
  bucket_id = 'radiographs'
  and (owner = auth.uid() or public.has_any_role(array['Admin']))
);

-- ---------------------------
-- Admin user creation RPC (Auth + public.users)
-- ---------------------------
create or replace function public.admin_create_user_with_role(
  p_email text,
  p_temp_password text,
  p_full_name text,
  p_role_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := gen_random_uuid();
  v_role_id smallint;
  v_email text := lower(trim(p_email));
begin
  if public.current_role_name() <> 'Admin' then
    raise exception 'Only Admin can create users';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Email is required';
  end if;

  if p_temp_password is null or length(p_temp_password) < 8 then
    raise exception 'Temporary password must be at least 8 characters';
  end if;

  select id into v_role_id
  from public.roles
  where name = p_role_name;

  if v_role_id is null then
    raise exception 'Invalid role name: %', p_role_name;
  end if;

  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'User already exists for email: %', v_email;
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  values (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_temp_password, extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    '{}'::jsonb
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_uid,
    jsonb_build_object(
      'sub', v_uid::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    v_uid::text,
    now(),
    now()
  );

  insert into public.users (id, role_id, full_name, email, created_at)
  values (
    v_uid,
    v_role_id,
    coalesce(nullif(trim(p_full_name), ''), split_part(v_email, '@', 1)),
    v_email,
    now()
  );

  return v_uid;
end;
$$;

-- Backward-compatible wrapper (old 3-argument signature).
create or replace function public.admin_create_user_with_role(
  p_email text,
  p_temp_password text,
  p_role_name text
)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select public.admin_create_user_with_role(p_email, p_temp_password, null, p_role_name)
$$;

-- Compatibility wrapper for clients sending arguments in this order:
-- (p_email, p_full_name, p_role_name, p_temp_password)
create or replace function public.admin_create_user_with_role(
  p_email text,
  p_full_name text,
  p_role_name text,
  p_temp_password text
)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select public.admin_create_user_with_role(p_email, p_temp_password, p_full_name, p_role_name)
$$;

revoke all on function public.admin_create_user_with_role(text, text, text, text) from public;
grant execute on function public.admin_create_user_with_role(text, text, text, text) to authenticated;
revoke all on function public.admin_create_user_with_role(text, text, text) from public;
grant execute on function public.admin_create_user_with_role(text, text, text) to authenticated;
