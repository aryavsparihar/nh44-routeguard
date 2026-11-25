-- Aadhaar Secure QR check (BUILD_PROMPT section 11, P1, FEATURE_AADHAAR_QR).
--
-- The server checks the QR (signature, layout, name) in memory and calls
-- this function with the result only. We store the verdict, the last 4
-- digits, the consent version and the certificate version: never the QR,
-- the name, date of birth, address or photo.
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
  if v_sub is null or private.jwt_role() not in ('driver', 'agent') then
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

revoke all on function private.record_aadhaar_check(text, text, text, text, text) from public, anon;
grant execute on function private.record_aadhaar_check(text, text, text, text, text) to authenticated;
