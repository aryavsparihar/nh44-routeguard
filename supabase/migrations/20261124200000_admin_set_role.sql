-- Admins change a user's role here, and only here (BUILD_PROMPT sections 8
-- and 10). police and admin are never self-service: an admin grants them
-- with a written reason, and the audit row is written in the same
-- transaction, so a role can't change without a record of who, why and when.
--
-- SECURITY DEFINER because a user token can't write users.role (column
-- grants in the rls_policies migration). The function checks the caller's
-- token role itself. The API also calls Clerk afterwards so the role reaches
-- the session token (src/server/users/users.service.ts).
--
-- Returns the old role, or null when the user had no row yet (for example
-- the demo police account, which can't onboard itself).

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
  is_official boolean := p_role in ('police', 'admin');
begin
  if private.jwt_role() is distinct from 'admin' then
    raise exception 'only admins can change roles' using errcode = '42501';
  end if;

  -- No locking yourself (or the last admin) out by accident.
  if p_target = private.jwt_sub() then
    raise exception 'admins can''t change their own role' using errcode = '42501';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) = 0 or char_length(p_reason) > 500 then
    raise exception 'a reason of 1 to 500 characters is required' using errcode = '22023';
  end if;

  select role into old_role from public.users where id = p_target for update;

  if found then
    update public.users
    set role = p_role,
        -- police/admin are "official". Moving someone off police/admin drops
        -- that; any other level (e.g. agent_vouched) stays.
        verification_level = case
          when is_official then 'official'::public.verification_level
          when verification_level = 'official' then 'email'::public.verification_level
          else verification_level
        end
    where id = p_target;
  else
    insert into public.users (id, role, verification_level)
    values (
      p_target,
      p_role,
      case when is_official then 'official'::public.verification_level
           else 'email'::public.verification_level end
    );
  end if;

  -- write_audit takes the actor from the token, so the entry can't be
  -- written in someone else's name.
  perform public.write_audit(
    'user.role_changed', 'user', p_target, p_reason, p_request_id,
    jsonb_build_object('from', old_role, 'to', p_role)
  );

  return old_role;
end;
$$;

revoke all on function public.admin_set_role(text, public.user_role, text, text) from public, anon;
grant execute on function public.admin_set_role(text, public.user_role, text, text) to authenticated;
