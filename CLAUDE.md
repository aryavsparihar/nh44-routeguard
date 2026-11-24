@AGENTS.md

# RouteGuard: rules for every Claude Code session

- The plan for Round 3 is docs/round3/BUILD_PROMPT.md. Read sections 0–3 before any work.
- Never read, print, log or commit .env files or keys. Only .env.example is committed.
- Server-only secrets live in modules that start with `import "server-only"`.
- Next.js 16: read node_modules/next/dist/docs/ before using a Next API. proxy.ts, async auth(), async params.
- Every API route goes through withApi() and returns problem+json on errors.
- Validate every input with zod (.strict()). Never put user input into Supabase .or()/.filter()/.textSearch() strings.
- No dangerouslySetInnerHTML. No invented numbers in UI, docs or data.
- RouteGuard is advisory and not an official police service. Keep the disclaimer.
- Hosting is Azure Container Apps on Azure for Students. No Vercel. Spend the credit carefully: no new Azure resource without asking (BUILD_PROMPT section 4.1).
- Small Conventional Commits from the member at the keyboard. Never squash-merge, never fake authorship.
- Ask before migrations on the real database, Clerk app changes, deploys, deletes or anything with personal data.
