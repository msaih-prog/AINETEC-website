-- AINETEC 2027 — schema initial (Supabase, remplace un flux manuel Sheets/Gmail)
-- A coller tel quel dans Supabase → SQL Editor → New query → Run

create extension if not exists pgcrypto;

-- =====================
-- TABLES
-- =====================

create table reviewers (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  email text not null unique,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

create table papers (
  id uuid primary key default gen_random_uuid(),
  paper_id text not null unique,
  titre text not null,
  email_auteur text not null,
  nom_auteur text,
  prenom_auteur text,
  ithenticate numeric,
  decision text check (decision in ('Accepted','Rejected')),
  statut text not null default 'En attente' check (statut in ('En attente','Complet','Envoyé')),
  date_envoi_decision timestamptz,
  attestation_envoyee boolean not null default false,
  created_at timestamptz not null default now()
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers(id) on delete cascade,
  reviewer_id uuid not null references reviewers(id) on delete cascade,
  num_reviewer int not null,
  score text,
  commentaire text,
  statut text not null default 'En attente' check (statut in ('En attente','Review reçue')),
  date_envoi timestamptz,
  nb_relances int not null default 0,
  date_reponse timestamptz,
  created_at timestamptz not null default now(),
  unique (paper_id, reviewer_id)
);
create index assignments_reviewer_idx on assignments(reviewer_id);
create index assignments_paper_idx on assignments(paper_id);

create table participants (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  prenom text not null,
  email text,
  categorie text not null check (categorie in ('Chairs','Comite_Organisation','Comite_Scientifique','Participants')),
  envoye boolean not null default false,
  date_envoi timestamptz,
  created_at timestamptz not null default now()
);

create table programme (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete set null,
  nom_candidat text not null,
  session text,
  date date,
  heure time,
  presente boolean not null default false,
  attestation_envoyee boolean not null default false,
  created_at timestamptz not null default now()
);

create table config (
  id int primary key default 1,
  review_session_ouverte boolean not null default true
);
insert into config (id, review_session_ouverte) values (1, true);

-- liste blanche des comptes admin (lié à Supabase Auth)
create table admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- =====================
-- ROW LEVEL SECURITY — accès admin uniquement depuis le navigateur.
-- Le flux reviewer (token) passe par des Edge Functions avec la clé secrète (service_role),
-- qui contourne RLS, donc les reviewers n'ont jamais besoin d'accès direct ici.
-- =====================

alter table reviewers enable row level security;
alter table papers enable row level security;
alter table assignments enable row level security;
alter table participants enable row level security;
alter table programme enable row level security;
alter table config enable row level security;
alter table admins enable row level security;

create policy "admins full access reviewers" on reviewers for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins full access papers" on papers for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins full access assignments" on assignments for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins full access participants" on participants for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins full access programme" on programme for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

create policy "admins full access config" on config for all
  using (exists (select 1 from admins where user_id = auth.uid()))
  with check (exists (select 1 from admins where user_id = auth.uid()));

-- Pas de sous-requête sur admins ici : ça créerait une récursion infinie
-- (cette policy elle-même serait ré-évaluée à chaque fois qu'elle interroge admins).
create policy "admins can view own row" on admins for select
  using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;

-- =====================
-- STORAGE BUCKETS (tous privés — accès admin via RLS, accès reviewer via Edge Function/clé secrète)
-- =====================

insert into storage.buckets (id, name, public) values
  ('papers', 'papers', false),
  ('attestations', 'attestations', false),
  ('forms', 'forms', false);

create policy "admins access papers bucket" on storage.objects for all
  using (bucket_id = 'papers' and exists (select 1 from admins where user_id = auth.uid()))
  with check (bucket_id = 'papers' and exists (select 1 from admins where user_id = auth.uid()));

create policy "admins access attestations bucket" on storage.objects for all
  using (bucket_id = 'attestations' and exists (select 1 from admins where user_id = auth.uid()))
  with check (bucket_id = 'attestations' and exists (select 1 from admins where user_id = auth.uid()));

create policy "admins access forms bucket" on storage.objects for all
  using (bucket_id = 'forms' and exists (select 1 from admins where user_id = auth.uid()))
  with check (bucket_id = 'forms' and exists (select 1 from admins where user_id = auth.uid()));
