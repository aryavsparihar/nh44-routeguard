-- Users now come from Clerk, not Supabase Auth (BUILD_PROMPT sections 7 and 8).
-- Clerk ids are text like "user_2abc...", so users.id and every column that
-- points at it change from uuid to text. users, reports and shipments were
-- empty when this was written (checked 24 Nov 2026), so no data is converted.

-- 1. Drop the links to users.id (and to auth.users) so the types can change.
alter table public.users     drop constraint users_id_fkey;        -- to auth.users
alter table public.users     drop constraint users_agent_id_fkey;
alter table public.users     drop constraint users_agent_not_self;
alter table public.reports   drop constraint reports_user_id_fkey;
alter table public.shipments drop constraint shipments_agent_id_fkey;
alter table public.shipments drop constraint shipments_driver_id_fkey;

-- 2. uuid → text.
alter table public.users
  alter column id type text using id::text,
  alter column agent_id type text using agent_id::text;
alter table public.reports
  alter column user_id type text using user_id::text;
alter table public.shipments
  alter column agent_id type text using agent_id::text,
  alter column driver_id type text using driver_id::text;

-- 3. Put the links back (users only; nothing points at auth.users any more).
alter table public.users
  add constraint users_agent_id_fkey foreign key (agent_id)
    references public.users (id) on delete set null,
  add constraint users_agent_not_self check (agent_id is null or agent_id <> id),
  add constraint users_id_is_clerk_id check (id ~ '^user_[A-Za-z0-9]+$');
alter table public.reports
  add constraint reports_user_id_fkey foreign key (user_id)
    references public.users (id) on delete set null;
alter table public.shipments
  add constraint shipments_agent_id_fkey foreign key (agent_id)
    references public.users (id) on delete set null,
  add constraint shipments_driver_id_fkey foreign key (driver_id)
    references public.users (id) on delete set null;

-- 4. Profile columns. Phone numbers stay in Clerk only, so phone goes.
--    "verified" becomes a level (section 9).
alter table public.users rename column name to display_name;
alter table public.users
  drop column phone,
  drop column verified,
  add constraint users_display_name_length check (char_length(display_name) <= 60),
  add column language text not null default 'en' check (language in ('en', 'hi', 'ur')),
  -- A users row is only created after an email-code sign-in, so it starts at "email".
  add column verification_level public.verification_level not null default 'email',
  add column location_consent boolean not null default false,
  add column consent_version text check (char_length(consent_version) <= 20),
  add column deleted_at timestamptz;

comment on column public.users.id is 'Clerk user id (user_...). Phone numbers and emails stay in Clerk.';
comment on column public.users.role is 'Mirrors Clerk publicMetadata.role. Written only by the server.';
