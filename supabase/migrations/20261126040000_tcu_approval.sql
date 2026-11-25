-- TCU approves every account (decision 26 Nov 2026, BUILD_PROMPT section 8).
--
-- 1. The admin role is TCU (Traffic Control Unit, J&K Traffic Police). It is
--    the only staff role: the police role is merged into it, and nobody can
--    be given admin or police from the app any more. A TCU account is set up
--    by the operator (scripts/seed-demo.mts for the demo), never in the app.
-- 2. Every new account waits for TCU. A self-signup row is 'pending'; TCU
--    approves or rejects it with public.tcu_review_user(), which also writes
--    the audit row. The API then puts the role into the Clerk token, so until
--    approval the account has no role anywhere (src/server/users).
-- 3. A second lock in the database: private.jwt_role() now returns the token
--    role only when the caller's users row has that same role, is approved
--    and not deleted. A token that says "driver" for a pending, rejected or
--    deleted account, or "police" for anyone, counts as no role in every RLS
--    policy and function below.

create type public.approval_status as enum ('pending', 'approved', 'rejected');

-- Existing accounts were already in use, so they start approved. The column
-- default is 'approved' for rows the server or the seed writes; a
-- self-signup is forced to 'pending' by the trigger below.
alter table public.users
  add column approval     public.approval_status not null default 'approved',
  add column reviewed_by  text references public.users (id) on delete set null,
  add column reviewed_at  timestamptz,
  add column review_note  text,
  add constraint users_review_note_length check (review_note is null or char_length(review_note) <= 500);

create index users_pending_idx on public.users (created_at) where approval = 'pending';

-- A row a user inserts for themselves (onboarding, as "authenticated") always
-- starts pending, whatever the insert says. Column grants already stop them
-- naming the approval columns; this holds even if a grant is added by mistake.
create or replace function private.users_signup_pending()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    new.approval    := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
  end if;
  return new;
end;
$$;

create trigger users_signup_pending
  before insert on public.users
  for each row execute function private.users_signup_pending();

-- The police role is merged into TCU. Existing police accounts are kept (no
-- data is deleted) but rejected, so they hold no role from now on.
update public.users
set approval = 'rejected',
    reviewed_at = now(),
    review_note = 'The police role was merged into TCU on 26 Nov 2026.'
where role = 'police';

-- ---------------------------------------------------------------------------
-- The caller's role, checked against the database (point 3 above).
-- SECURITY DEFINER so it can read public.users from inside a users policy
-- without going through RLS again.
-- ---------------------------------------------------------------------------
create or replace function private.jwt_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.role::text
  from public.users u
  where u.id = auth.jwt() ->> 'sub'
    and u.role::text = auth.jwt() -> 'metadata' ->> 'role'
    and u.role <> 'police'
    and u.approval = 'approved'
    and u.deleted_at is null
$$;

revoke all on function private.jwt_role() from public, anon;
grant execute on function private.jwt_role() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_role: TCU changes an approved user's role between the
-- self-service roles. admin and police can't be given from the app.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(
  p_target     text,
  p_role       public.user_role,
  p_reason     text,
  p_request_id text default null
)
returns public.user_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_role public.user_role;
begin
  if private.jwt_role() is distinct from 'admin' then
    raise exception 'only TCU can change roles' using errcode = '42501';
  end if;

  if p_target = private.jwt_sub() then
    raise exception 'TCU can''t change its own role' using errcode = '42501';
  end if;

  if p_role in ('police', 'admin') then
    raise exception 'TCU is the only admin; police and admin can''t be given' using errcode = '42501';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 or char_length(p_reason) > 500 then
    raise exception 'a reason of 1 to 500 characters is required' using errcode = '22023';
  end if;

  select role into old_role from public.users where id = p_target for update;

  if found then
    if old_role in ('police', 'admin') then
      raise exception 'TCU accounts are changed by the operator, not in the app' using errcode = '42501';
    end if;
    update public.users
    set role = p_role,
        verification_level = case
          when verification_level = 'official' then 'email'::public.verification_level
          else verification_level
        end
    where id = p_target;
  else
    -- Someone who signed in but never picked a role: TCU picks it, which
    -- also approves them.
    insert into public.users (id, role, verification_level, approval, reviewed_by, reviewed_at, review_note)
    values (p_target, p_role, 'email', 'approved', private.jwt_sub(), now(), p_reason);
  end if;

  perform public.write_audit(
    'user.role_changed', 'user', p_target, p_reason, p_request_id,
    jsonb_build_object('from', old_role, 'to', p_role)
  );

  return old_role;
end;
$$;

revoke all on function public.admin_set_role(text, public.user_role, text, text) from public, anon;
grant execute on function public.admin_set_role(text, public.user_role, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- tcu_review_user: TCU approves or rejects a waiting account. Approving
-- needs no reason; rejecting needs one (the person sees it on /me). A
-- rejected account can be approved later; an approved one can't be
-- "rejected" here (use admin_set_role or remove the account).
-- Returns the user's role, so the API can put it into Clerk.
-- ---------------------------------------------------------------------------
create or replace function public.tcu_review_user(
  p_target     text,
  p_decision   public.approval_status,
  p_note       text default null,
  p_request_id text default null
)
returns public.user_role
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users%rowtype;
begin
  if private.jwt_role() is distinct from 'admin' then
    raise exception 'only TCU can review accounts' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;

  if p_note is not null and char_length(p_note) > 500 then
    raise exception 'the note is at most 500 characters' using errcode = '22023';
  end if;

  if p_decision = 'rejected' and (p_note is null or char_length(btrim(p_note)) = 0) then
    raise exception 'a rejection needs a reason' using errcode = '22023';
  end if;

  select * into v_user from public.users where id = p_target and deleted_at is null for update;
  if not found then
    raise exception 'no such account' using errcode = 'P0002';
  end if;

  if v_user.role in ('police', 'admin') then
    raise exception 'TCU and police accounts are not reviewed here' using errcode = '42501';
  end if;

  if v_user.approval = p_decision then
    return v_user.role; -- a repeat: nothing to change, nothing to log
  end if;

  if v_user.approval = 'approved' then
    raise exception 'this account is already approved' using errcode = '55000';
  end if;

  update public.users
  set approval    = p_decision,
      reviewed_by = private.jwt_sub(),
      reviewed_at = now(),
      review_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = p_target;

  perform public.write_audit(
    'user.' || p_decision::text, 'user', p_target, nullif(btrim(coalesce(p_note, '')), ''), p_request_id,
    jsonb_build_object('role', v_user.role, 'from', v_user.approval)
  );

  return v_user.role;
end;
$$;

revoke all on function public.tcu_review_user(text, public.approval_status, text, text) from public, anon;
grant execute on function public.tcu_review_user(text, public.approval_status, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- record_aadhaar_check said "jwt_role() not in (...)", which lets a null role
-- through (null not in (...) is null, not true). jwt_role() is now null for
-- waiting and rejected accounts, so the check must treat null as "no".
-- Same function as 20261125220000_aadhaar_qr.sql with that one line changed.
-- ---------------------------------------------------------------------------
create or replace function private.record_aadhaar_check(
  p_verdict         text,
  p_last4           text,
  p_consent_version text,
  p_cert_version    text,
  p_request_id      text default null
)
returns table (verification_level text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sub  text := private.jwt_sub();
  v_user public.users%rowtype;
begin
  if v_sub is null or coalesce(private.jwt_role(), '') not in ('driver', 'agent') then
    raise exception 'only drivers and agents use the Aadhaar check' using errcode = '42501';
  end if;
  if p_verdict not in ('verified', 'manual_review', 'rejected') then
    raise exception 'bad verdict' using errcode = '22023';
  end if;
  if p_last4 is not null and p_last4 !~ '^[0-9]{4}$' then
    raise exception 'bad last4' using errcode = '22023';
  end if;
  if p_consent_version is null or length(p_consent_version) > 40 then
    raise exception 'consent version needed' using errcode = '22023';
  end if;

  select * into v_user from public.users u where u.id = v_sub for update;
  if not found then
    raise exception 'finish setting up your account first' using errcode = 'P0002';
  end if;

  insert into public.verifications (user_id, method, verdict, last4, consent_version, cert_version)
  values (v_sub, 'aadhaar_qr', p_verdict::public.verification_verdict,
          case when p_verdict = 'rejected' then null else p_last4 end,
          p_consent_version, p_cert_version);

  -- Only a clean match raises the level; official accounts keep theirs.
  if p_verdict = 'verified' and v_user.verification_level::text <> 'official' then
    update public.users u set verification_level = 'aadhaar_qr' where u.id = v_sub;
    v_user.verification_level := 'aadhaar_qr';
  end if;

  perform public.write_audit('verification.aadhaar_qr', 'user', v_sub, null, p_request_id,
                             jsonb_build_object('verdict', p_verdict, 'cert_version', p_cert_version));
  return query select v_user.verification_level::text;
end;
$$;
