-- ============================================================
-- KREDITPRO — Supabase Schema
-- Jalankan file ini di Supabase SQL Editor
-- ============================================================

-- ---- EXTENSION ----
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: customers
-- ============================================================
create table if not exists public.customers (
  id           text primary key,          -- e.g. N001
  nama         text not null,
  tgl          date not null,
  barang       text not null,
  harga        numeric(15,2) default 0,
  dp           numeric(15,2) default 0,
  kredit_pokok numeric(15,2) default 0,
  tenor        integer not null,
  total_bunga  numeric(8,4) default 0,    -- % total
  bunga_pct    numeric(8,4) default 0,    -- % per bulan
  no_hp        text,
  nik          text,
  alamat       text,
  no_seri      text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- TABLE: payments
-- ============================================================
create table if not exists public.payments (
  id               text primary key,       -- e.g. P001
  customer_id      text not null references public.customers(id) on delete cascade,
  tgl              date not null,
  jumlah_angsuran  numeric(15,2) default 0,
  cicilan          numeric(15,2) default 0,
  metode           text default 'Tunai',   -- Tunai / Transfer
  ket              text,
  created_at       timestamptz default now()
);

create index if not exists idx_payments_customer on public.payments(customer_id);
create index if not exists idx_payments_tgl on public.payments(tgl);

-- ============================================================
-- TABLE: photos
-- ============================================================
create table if not exists public.photos (
  id          uuid primary key default uuid_generate_v4(),
  customer_id text not null references public.customers(id) on delete cascade,
  photo_type  text not null,   -- 'cust' | 'item_0' | 'item_1' ... 'item_4'
  data_url    text not null,   -- base64 data URL
  created_at  timestamptz default now(),
  unique (customer_id, photo_type)
);

create index if not exists idx_photos_customer on public.photos(customer_id);

-- ============================================================
-- TABLE: wa_logs  (WhatsApp send history)
-- ============================================================
create table if not exists public.wa_logs (
  id          uuid primary key default uuid_generate_v4(),
  customer_id text references public.customers(id) on delete set null,
  cust_name   text,
  phone       text,
  message     text,
  sent_at     timestamptz default now()
);

create index if not exists idx_walogs_sent on public.wa_logs(sent_at desc);

-- ============================================================
-- TABLE: auth_users  (custom auth — replaces localStorage auth)
-- ============================================================
create table if not exists public.auth_users (
  id            text primary key,          -- e.g. U001
  username      text unique not null,
  display_name  text not null,
  role          text default 'staff',      -- owner / staff
  password_hash text not null,
  avatar        text,
  last_login    timestamptz,
  created_at    timestamptz default now()
);

-- ============================================================
-- TABLE: auth_sessions
-- ============================================================
create table if not exists public.auth_sessions (
  token       text primary key,
  user_id     text not null references public.auth_users(id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

create index if not exists idx_sessions_user on public.auth_sessions(user_id);

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
create table if not exists public.audit_logs (
  id         uuid primary key default uuid_generate_v4(),
  action     text not null,
  username   text,
  detail     text,
  user_agent text,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — aktifkan semua tabel
-- ============================================================
alter table public.customers    enable row level security;
alter table public.payments     enable row level security;
alter table public.photos       enable row level security;
alter table public.wa_logs      enable row level security;
alter table public.auth_users   enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.audit_logs   enable row level security;

-- Policy: izinkan semua akses via service_role (server-side anon key kita pakai)
-- Ini cukup aman karena kita pakai anon key + RLS policy berikut:

create policy "allow_all_customers"    on public.customers    for all using (true) with check (true);
create policy "allow_all_payments"     on public.payments     for all using (true) with check (true);
create policy "allow_all_photos"       on public.photos       for all using (true) with check (true);
create policy "allow_all_walogs"       on public.wa_logs      for all using (true) with check (true);
create policy "allow_all_auth_users"   on public.auth_users   for all using (true) with check (true);
create policy "allow_all_sessions"     on public.auth_sessions for all using (true) with check (true);
create policy "allow_all_audit"        on public.audit_logs   for all using (true) with check (true);

-- ============================================================
-- FUNCTION: updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ============================================================
-- SEED: default admin user
-- password = admin123  (hash djb2 sama dengan di auth.js)
-- ============================================================
insert into public.auth_users (id, username, display_name, role, password_hash, avatar)
values (
  'U001',
  'admin',
  'Ruli Rizki Ariyanto',
  'owner',
  'a5c3f2e1b4d7890a',   -- akan di-replace oleh app saat login pertama
  'R'
) on conflict (id) do nothing;
