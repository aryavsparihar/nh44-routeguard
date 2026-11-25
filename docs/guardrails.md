# Police and safety guardrails

We have no partnership with J&K Traffic Police or the TCU. RouteGuard must never look like it speaks for them. Each rule below says what we do, why, and where it lives in the code.

## 1. Not official

**What:** every screen and the sign-in page carry the footer "RouteGuard is a student project. It is not an official government or police service. Follow instructions from J&K Traffic Police. In an emergency call 112." in English, Hindi and Urdu (`messages/*.json`, key `footer.disclaimer`). No police logos, emblems, uniforms or seals anywhere.

**Why:** a driver who thinks our "HOLD" is a police order could ignore a real one, or blame the police for ours.

## 2. Official updates are copies with sources

**What:** an admin or the demo police account types in what a public TCU / J&K Traffic Police advisory said, with its link, issue time and expiry (`POST /api/v1/admin/official-updates`). The source URL is required by the zod schema. The app shows it as "From J&K Traffic Police advisory · source · time" with the line "RouteGuard copies these from the source shown. It is not an official channel". Edits make a new version; deletes are soft with a written reason. We don't scrape their sites.

**Why:** the reader can always check the original. We never write our own instructions as if they were official.

## 3. Who can do what

**What:** police and admin roles are granted only by an admin, with a written reason (`PATCH /api/v1/admin/users/{id}/role`). Every privileged action calls `public.write_audit()` (who, what, when, why, request id). The `audit_log` table has no insert, update or delete grant for app users, and triggers reject update, delete and truncate for everyone, admins included (`supabase/migrations/20261124160007_rls_policies.sql`).

**Why:** if someone misuses a police account, we can show exactly what happened, and nobody can hide it afterwards.

## 4. Reports are about the road, not people

**What:**
- Hazard types only: landslide, rockfall, flash flood, snow/ice, accident, other. No field asks for names or vehicle numbers.
- Notes are capped at 280 characters (`config/report-rules.json`). Phone numbers and vehicle numbers in notes are masked before saving (`src/server/reports/mask.ts`).
- The photo screen says "Photograph the road, not people or number plates".
- The server re-encodes every photo to WebP with `sharp`, which drops all EXIF, and cuts the long side to 1600 px (`src/server/reports/photo.ts`). Location comes from the app's GPS reading, never from EXIF.
- Photos sit in a private Storage bucket. They are served only through `GET /api/v1/reports/{id}/photo`, which checks access and streams the bytes, so the storage path (which holds the uploader's id) never leaves the server.
- The public map reads the `public_reports` view, which has no `user_id` or `photo_path`.

**Why:** a hazard report must not become a way to track or shame a person.

## 5. Location privacy

**What:** drivers turn location sharing on themselves, after a consent step. It is shared only with their own agent and stored rounded to 0.01° (about 1 km). We keep only the latest point; `private.clear_old_locations()` clears it 7 days after delivery (`supabase/migrations/20261125190000_location_retention.sql`). `DELETE /api/v1/me` removes the account and anonymises its reports.

**Why:** the agent needs to know roughly where the truck is, not its exact path.

## 6. Abuse limits

**What:** counted in Postgres so they hold across every replica (`src/server/http/rate-limit.ts`):

| Action | Limit |
| --- | --- |
| Reports | 10 an hour per user |
| Confirmations | 30 an hour per user |
| Role or verification attempts | 5 an hour per user |
| Alert on/off changes | 20 an hour per user |
| Advice | 60 a minute per IP |

Drivers can post reports only once their agent has vouched for them or they have passed the optional Aadhaar QR check; the API and `private.submit_report()` both check it. Aadhaar is never required: the vouch always works.

The client IP is the first `X-Forwarded-For` entry, set by the Container Apps ingress, and stored only as a hash. Admins can pause reporting with `FEATURE_REPORTS_WRITE=false`; the app then shows "reporting paused".

**Why:** one person with a script should not be able to flood the map or guess roles.

## 7. No automatic road decisions

**What:** reports and scores never mark the road "open". Copy says "may close" or "reported blocked", never "safe". The advisor's footer says "Advice only, not a road status."

**Why:** we can be wrong. Saying "safe" when we are wrong is the worst failure this app can have.

## 8. Privacy notice and consent

**What:** `/privacy` in three languages (following India's DPDP Act 2023): what we collect, why, how long, how to delete. A consent step comes before location sharing and before the Aadhaar QR check (the check keeps only the verdict and the last 4 digits; see [verification.md](verification.md#the-aadhaar-qr-check)). Each consent stores `consent_version`.

**Why:** people should know what they give us before they give it.

## 9. Helplines

**What:** we link 112. We print no TCU helpline number, because we have not verified one on an official J&K Traffic Police source. When one is verified, its source and date go in `docs/sources.md` first.

**Why:** a wrong helpline number in an emergency is worse than none.

## 10. The road overview for police and admin

**What:** `/admin/overview` (`src/ui/admin/RoadOverview.tsx`) puts on one screen what the public map and API already show: zones at high and medium risk, the 48 h strip, road reports (unconfirmed first, with "I see it too"), police/TCU updates in force with their sources, and the Mughal Road / parcel train status. It is called "Road overview", not "control room", so it can't be taken for a police control room. It shows no names, no truck positions and no shipments. Only police and admin open it (`AdminGate` on the page; every write still goes through the same API checks). Road status reads "Open, according to the source" with the link, never a bare "Open". Changing road status stays admin-only.

**Why:** the demo police account needs one place to watch the corridor, but a screen that looks like an official control room, or that shows people, would break rules 1 and 4.
