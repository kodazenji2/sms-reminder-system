-- ==========================================================
-- NICTM SMS Timetable Reminder System — Database Schema
-- ==========================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------
-- 1. PROFILES
-- ----------------------------------------------------------
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text not null,
  phone       text,
  email       text,
  role        text not null default 'lecturer'
              check (role in ('admin', 'lecturer')),
  active      boolean not null default true,
  network     text
              check (network in ('MTN', 'Glo', 'Airtel', '9Mobile')),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------
-- 2. TIMETABLE
-- ----------------------------------------------------------
create table if not exists public.timetable (
  id           uuid primary key default gen_random_uuid(),
  course_code  text not null,
  course_name  text not null,
  lecturer_id  uuid not null references public.profiles(id) on delete cascade,
  day_of_week  text not null
               check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  start_time   time not null,
  end_time     time not null,
  venue        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint end_after_start check (end_time > start_time)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger timetable_updated_at
  before update on public.timetable
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------
-- 3. CHANGE REQUESTS
-- ----------------------------------------------------------
create table if not exists public.change_requests (
  id               uuid primary key default gen_random_uuid(),
  lecturer_id      uuid not null references public.profiles(id) on delete cascade,
  timetable_id     uuid not null references public.timetable(id) on delete cascade,
  reason           text not null,
  requested_date   date,
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  admin_note       text,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------
-- 4. NOTIFICATIONS (SMS Log)
-- ----------------------------------------------------------
create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  lecturer_id         uuid not null references public.profiles(id) on delete cascade,
  timetable_id        uuid references public.timetable(id) on delete set null,
  phone               text not null,
  message             text not null,
  status              text not null default 'pending'
                      check (status in ('delivered', 'failed', 'pending')),
  termii_message_id   text,
  sent_at             timestamptz not null default now(),
  class_date          date
);

-- Prevent duplicate reminders for the same class on the same day
create unique index if not exists notifications_no_duplicate_reminder
  on public.notifications (timetable_id, class_date)
  where status = 'delivered';

-- ----------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ----------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.timetable       enable row level security;
alter table public.change_requests enable row level security;
alter table public.notifications   enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Profiles
create policy "Admins read all profiles"      on public.profiles for select using (public.is_admin());
create policy "Lecturers read own profile"    on public.profiles for select using (auth.uid() = id);
create policy "Admins update all profiles"    on public.profiles for update using (public.is_admin());
create policy "Users update own profile"      on public.profiles for update using (auth.uid() = id);

-- Timetable
create policy "Admins full access timetable"  on public.timetable for all    using (public.is_admin());
create policy "Lecturers read own timetable"  on public.timetable for select using (lecturer_id = auth.uid());

-- Change requests
create policy "Admins full access requests"   on public.change_requests for all    using (public.is_admin());
create policy "Lecturers read own requests"   on public.change_requests for select using (lecturer_id = auth.uid());
create policy "Lecturers create own requests" on public.change_requests for insert with check (lecturer_id = auth.uid());

-- Notifications (cron uses service role, bypasses RLS)
create policy "Admins read notifications"     on public.notifications for select using (public.is_admin());

-- ----------------------------------------------------------
-- 6. AFTER RUNNING THIS SCHEMA:
-- 1. We create admin user in Supabase Auth (Dashboard > Authentication > Users > Add User)
-- 2. Run the UPDATE below with that user's email to grant admin role:
--
-- THen we update public.profiles set role = 'admin', full_name = 'Administrator'
-- where email = 'your-admin@nictm.edu.ng';
-- ----------------------------------------------------------
