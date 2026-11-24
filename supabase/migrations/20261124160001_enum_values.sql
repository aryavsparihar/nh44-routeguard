-- New value lists for Round 3 (BUILD_PROMPT sections 7 and 9).
-- Postgres can't use a new enum value in the same transaction that adds it,
-- so the values come first, in their own migration.

-- Admins can post reports too.
alter type public.report_source add value if not exists 'admin';

-- A report can be resolved by an admin, or hidden (three flags or an admin).
alter type public.report_status add value if not exists 'resolved';
alter type public.report_status add value if not exists 'hidden';

-- How much we trust a person (section 9). Sign-in is by email code.
create type public.verification_level as enum (
  'none', 'email', 'agent_vouched', 'aadhaar_qr', 'official'
);

-- How a verification was done, and what came out of it.
create type public.verification_method as enum ('agent_vouch', 'aadhaar_qr', 'admin');
create type public.verification_verdict as enum ('verified', 'manual_review', 'rejected');

-- Police / TCU updates that an admin or police account copies in, with a source.
create type public.official_update_kind as enum ('closure', 'one_way', 'reopened', 'advisory');

-- Mughal Road and the rail parcel service: we never assume they are open.
create type public.road_state as enum ('open', 'closed', 'unknown');

-- Why someone flagged a report. Our own list; change it in a new migration.
create type public.flag_reason as enum ('not_there', 'wrong_place', 'duplicate', 'offensive', 'other');
