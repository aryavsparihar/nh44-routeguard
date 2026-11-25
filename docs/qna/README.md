# Shared Q&A bank

Short answers every member should be able to give. Each points to where the proof is. Personal notes go in `docs/qna/<name>.md`: what I built, one request I can trace, one test and what it proves, one decision and what we rejected, one limitation and how I'd fix it.

**Why rules, not machine learning?**
We have 27 verified incidents from 2018 to 2026 (`data/incidents.csv`). That is too few to train a model honestly. Rules are explainable: every score comes with a reason a driver can read. We'd switch to ML only if it beats the rules in the backtest (`docs/backtest.md`, `jobs/backtest.py`).

**Why no rerouting?**
There is no heavy-truck bypass in the Ramban gorge. Mughal Road takes light trucks in season only, and its status is set by an admin with a source; when nobody has set it, the advisor says "unknown, check with TCU".

**How do we stop fake reports?**
First, a fake report can't move the risk score: the score comes from weather and slope, and reports only raise its confidence, and only once confirmed (`jobs/risk/scoring.py`). Then: drivers can post only once verified, by their agent's vouch or the optional Aadhaar QR check (`docs/verification.md`). Agents' reports start "unconfirmed" with a dashed marker until two verified users within 2 km and 3 h, or police, confirm them; nobody confirms their own report. Reports expire by type, three flags hide an unconfirmed one, 10 reports an hour per user, duplicates within 500 m and 60 min merge, and every admin and police confirmation is in the audit log.

**Why not make Aadhaar compulsory?**
The Supreme Court's 2018 Puttaswamy judgment stopped private companies from requiring Aadhaar, and we aren't registered with UIDAI as a verifier. It also wouldn't prove much: the QR doesn't show that the person scanning is the cardholder, so a forwarded photo of someone's card passes. An agent's vouch ties the driver to a real person who knows them. So drivers need one of the two, and Aadhaar is never the only way in.

**What if the hourly job fails?**
`jobs/check_run.py` fails the workflow run. `/api/v1/health/ready` reports `stale: true`, and the app shows a stale banner with the time of the last good run. Advice still works from the last scores and says how old they are.

**Where are the secrets?**
In `.env.local` on our machines and in Container Apps secrets in production, never in git. CI runs gitleaks, checks the browser bundle and the Docker image for secret values, and fails if code reads an env var that `.env.example` doesn't list.

**What does the Aadhaar check prove, and what not?**
Not built yet (P1, behind `FEATURE_AADHAAR_QR`). If built: the Secure QR signature proves UIDAI issued that data. It does not prove the person holding the phone is that person (no holder binding), and we are not a registered OVSE.

**What changed since Round 1, and why is it within 15%?**
See the "Changes since Round 1" table in the README and BUILD_PROMPT section 3. The features are the same; what changed is how: Clerk email codes instead of Supabase phone OTP (SMS costs money on Clerk's free plan), Azure Container Apps instead of Vercel, and additions that make existing features trustworthy (verification, audit log, queue).

**How does it scale?**
`docs/scaling.md`. Risk is computed once an hour for everyone; reads are cached (ETag/304, 60 s memory cache); writes go through a Postgres queue; the app is stateless and runs 0 to 3 replicas.

**Is this an official police app?**
No. Every screen says so, we use no police logos, and official updates are copies with a link to the source (`docs/guardrails.md`).
