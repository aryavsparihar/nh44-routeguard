# nh44-routeguard
Protecting Kashmir’s apple harvest from NH-44 highway closures through AI disruption forecasting, dynamic cold-storage routing, and real-time fleet visibility. (Project Ananta Hackathon : Team 01)


## Getting started

You need Node.js 20 or newer.

1. Fork this repo on GitHub, then clone your fork:
   ```bash
   git clone https://github.com/<your-username>/nh44-routeguard.git
   cd nh44-routeguard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the env template and fill in the two `NEXT_PUBLIC_` values (ask Aryaveer, or copy them from Supabase → Project Settings → API Keys):
   ```bash
   cp .env.example .env.local
   ```
   The URL looks like `https://<project-ref>.supabase.co`, not the `supabase.com/dashboard/...` link in your browser.
   Never commit `.env.local`, and never put the Supabase secret key in it.
4. Start the dev server and open http://localhost:3000:
   ```bash
   npm run dev
   ```

### Repo layout

| Folder | What lives there |
| --- | --- |
| `app/` | Next.js App Router pages |
| `lib/supabase/` | Supabase clients (browser + server, publishable key only) |
| `lib/risk/` | Risk score types |
| `jobs/` | Python hourly risk job (`run_risk.py`, `requirements.txt`) |
| `supabase/` | Database migrations |
| `data/` | Team CSVs: `corridor_hexes.csv`, `hex_slope.csv`, `incidents.csv` |
