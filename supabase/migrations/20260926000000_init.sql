-- 성경 친구 — initial schema
--
-- Account model
--   auth.users (1) ── guardians (1)   : the signed-in adult (보호자, 법정대리인)
--   guardians  (1) ── children  (N)   : child profiles; children never sign in themselves
--   children   (1) ── chat/prayer/favorites/treasures/growth (N)
--
-- Security model
--   * Every table has RLS enabled. A guardian can only reach rows of their own children.
--   * AI chat history, growth state and quota counters are written only by Edge Functions
--     (service role), so the app cannot forge rewards or conversation records.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guardians
-- ---------------------------------------------------------------------------

create table public.guardians (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  -- 만 14세 미만 아동의 개인정보 처리에 대한 법정대리인 동의 (PIPA §22-2)
  consented_at timestamptz,
  consent_version text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger guardians_updated_at
  before update on public.guardians
  for each row execute function public.set_updated_at();

-- Create the guardian row automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guardians (id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Children
-- ---------------------------------------------------------------------------

create table public.children (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  birth_year int check (birth_year between 2005 and 2035),
  avatar text not null default 'wave' check (avatar in ('wave', 'listen', 'teach')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index children_guardian_id_idx on public.children (guardian_id);

create trigger children_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

-- Keep a guardian's family small; also blocks runaway inserts.
create or replace function public.limit_children_per_guardian()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.children where guardian_id = new.guardian_id) >= 6 then
    raise exception 'too many child profiles' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger children_limit
  before insert on public.children
  for each row execute function public.limit_children_per_guardian();

-- True when the signed-in guardian owns the child. SECURITY DEFINER avoids RLS recursion.
create or replace function public.owns_child(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.children c
    where c.id = p_child_id and c.guardian_id = (select auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- Child activity
-- ---------------------------------------------------------------------------

create table public.chat_messages (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.children (id) on delete cascade,
  role text not null check (role in ('child', 'friend')),
  content text not null check (char_length(content) between 1 and 2000),
  story_id text,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create index chat_messages_child_created_idx on public.chat_messages (child_id, created_at desc);

create table public.prayer_notes (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  verse_ref text check (char_length(verse_ref) <= 60),
  verse_text text check (char_length(verse_text) <= 300),
  status text not null default 'praying' check (status in ('praying', 'answered')),
  gratitude text check (char_length(gratitude) <= 300),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create index prayer_notes_child_created_idx on public.prayer_notes (child_id, created_at desc);

create table public.favorite_verses (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  verse_ref text not null check (char_length(verse_ref) between 1 and 60),
  verse_text text not null check (char_length(verse_text) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (child_id, verse_ref)
);

create table public.treasure_cards (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  card_id text not null check (char_length(card_id) between 1 and 40),
  collected_at timestamptz not null default now(),
  unique (child_id, card_id)
);

create table public.growth_profiles (
  child_id uuid primary key references public.children (id) on delete cascade,
  profile jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger growth_profiles_updated_at
  before update on public.growth_profiles
  for each row execute function public.set_updated_at();

create table public.growth_events (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.children (id) on delete cascade,
  event_key text not null,
  activity text not null,
  source_id text not null,
  reward jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (child_id, event_key)
);

create index growth_events_child_created_idx on public.growth_events (child_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AI usage quota (per guardian, per Korean calendar day)
-- ---------------------------------------------------------------------------

create table public.ai_usage (
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  usage_date date not null,
  kind text not null check (kind in ('chat', 'tts_chars', 'transcribe')),
  units int not null default 0 check (units >= 0),
  primary key (guardian_id, usage_date, kind)
);

-- Atomically adds `p_units` and returns whether the guardian is still within `p_limit`.
-- Called by Edge Functions with the service role only.
create or replace function public.consume_ai_quota(
  p_guardian_id uuid,
  p_kind text,
  p_units int,
  p_limit int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_total int;
begin
  insert into public.ai_usage as u (guardian_id, usage_date, kind, units)
  values (p_guardian_id, v_today, p_kind, p_units)
  on conflict (guardian_id, usage_date, kind)
    do update set units = u.units + excluded.units
  returning units into v_total;

  if v_total > p_limit then
    -- Roll the increment back so a rejected request doesn't consume budget.
    update public.ai_usage
       set units = units - p_units
     where guardian_id = p_guardian_id and usage_date = v_today and kind = p_kind;
    return false;
  end if;
  return true;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, text, int, int) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.guardians enable row level security;
alter table public.children enable row level security;
alter table public.chat_messages enable row level security;
alter table public.prayer_notes enable row level security;
alter table public.favorite_verses enable row level security;
alter table public.treasure_cards enable row level security;
alter table public.growth_profiles enable row level security;
alter table public.growth_events enable row level security;
alter table public.ai_usage enable row level security;

-- guardians: read and update your own row (created by trigger).
create policy "guardian reads self" on public.guardians
  for select to authenticated using (id = (select auth.uid()));
create policy "guardian updates self" on public.guardians
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- children: full control of your own children, only after consent was recorded.
create policy "guardian reads children" on public.children
  for select to authenticated using (guardian_id = (select auth.uid()));
create policy "guardian adds children" on public.children
  for insert to authenticated with check (
    guardian_id = (select auth.uid())
    and exists (
      select 1 from public.guardians g
      where g.id = (select auth.uid()) and g.consented_at is not null
    )
  );
create policy "guardian updates children" on public.children
  for update to authenticated
  using (guardian_id = (select auth.uid()))
  with check (guardian_id = (select auth.uid()));
create policy "guardian deletes children" on public.children
  for delete to authenticated using (guardian_id = (select auth.uid()));

-- chat_messages: read and delete (history clearing); writes come from the chat function.
create policy "guardian reads chat" on public.chat_messages
  for select to authenticated using (public.owns_child(child_id));
create policy "guardian deletes chat" on public.chat_messages
  for delete to authenticated using (public.owns_child(child_id));

-- prayer_notes / favorite_verses / treasure_cards: owned by the child's guardian.
create policy "guardian manages prayer notes" on public.prayer_notes
  for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));
create policy "guardian manages favorites" on public.favorite_verses
  for all to authenticated
  using (public.owns_child(child_id)) with check (public.owns_child(child_id));
create policy "guardian reads treasures" on public.treasure_cards
  for select to authenticated using (public.owns_child(child_id));

-- growth: read-only for the app; the growth function is the only writer.
create policy "guardian reads growth" on public.growth_profiles
  for select to authenticated using (public.owns_child(child_id));
create policy "guardian reads growth events" on public.growth_events
  for select to authenticated using (public.owns_child(child_id));

-- ai_usage: guardians may see their own usage (for a parent dashboard).
create policy "guardian reads usage" on public.ai_usage
  for select to authenticated using (guardian_id = (select auth.uid()));

-- Explicit grants (Supabase is moving table grants to opt-in).
grant select, update on public.guardians to authenticated;
grant select, insert, update, delete on public.children to authenticated;
grant select, delete on public.chat_messages to authenticated;
grant select, insert, update, delete on public.prayer_notes to authenticated;
grant select, insert, update, delete on public.favorite_verses to authenticated;
grant select on public.treasure_cards to authenticated;
grant select on public.growth_profiles to authenticated;
grant select on public.growth_events to authenticated;
grant select on public.ai_usage to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private cache of synthesized speech (served through signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts-cache', 'tts-cache', false, 5242880, array['audio/wav'])
on conflict (id) do nothing;
