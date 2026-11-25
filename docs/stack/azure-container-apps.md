# Azure Container Apps and GHCR

**In one line:** Azure Container Apps will run our Docker image on the internet, starting more copies when busy and none when idle; GitHub Container Registry (GHCR) stores the images.

> **Status (26 Nov 2026):** planned, not live yet. The workflow and the steps in `docs/runbook.md` are ready; the Azure resources haven't been created.

## What they are

- **Azure Container Apps:** Microsoft's service for running containers without managing servers. It handles HTTPS, scaling and logs.
- **GHCR (GitHub Container Registry):** a place to store Docker images, next to our code on GitHub.
- **Azure for Students:** a free Azure credit for students. We pay for nothing beyond it.

## Why we use them

- Our team has Azure for Students credit. No Vercel and no other host.
- **Scale to zero:** with `min-replicas 0`, nothing runs (and nothing is charged) while nobody uses the app.
- GHCR is free for our repository and needs no new Azure resource.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `.github/workflows/deploy.yml` | Build, push to GHCR, update the container app, smoke test the live URL |
| `docs/runbook.md` | "Deploy to Azure (first time)": every command for the one-time setup |
| `docs/scaling.md` | How it scales and what it costs |

## Settings

| Setting | Value |
| --- | --- |
| CPU and memory | 0.5 vCPU, 1 GiB |
| Copies (replicas) | 0 to 3 |
| Scale rule | add a copy at 80 requests at the same time |
| Region | `centralindia` planned (the runbook says what to do if it's refused) |
| Logs | Log Analytics with a 0.1 GB a day cap, so logs can't eat the credit |
| Images kept in GHCR | the last 2 |

## How a deploy will work

1. A merge to `main` starts `deploy.yml` (only when `DEPLOY_ENABLED` is `true`).
2. It builds the Docker image and pushes it to `ghcr.io/...:<commit>`.
3. It signs in to Azure with **OpenID Connect**: GitHub proves who it is, so no Azure password is stored anywhere. The identity may only change our resource group.
4. It points the container app at the new image and waits until it answers.
5. Secrets (Clerk secret key, database URL, VAPID private key, jobs secret) are Container Apps secrets, set once by hand. They're never in the image or the repo.

## Learn more

- https://learn.microsoft.com/en-us/azure/container-apps/overview
- https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry

## Questions you may be asked

**Q: Is the app live on Azure?**
A: Not yet. Everything for the deploy is written and tested in CI (the same Docker image), and the Azure setup steps are in the runbook.

**Q: What does "scale to zero" mean?**
A: When nobody uses the app, no copy runs and nothing is charged. The first request after idle starts a copy, which takes a few seconds, so we warm it up before the demo by calling `/api/v1/health/ready`.

**Q: How does it handle more users?**
A: Azure adds a copy for every 80 requests at once, up to 3. The app is stateless (sessions are Clerk tokens, rate limits are in Postgres), so any copy can answer any request.

**Q: How do you avoid spending all the credit?**
A: Scale to zero, small CPU and memory, a cap on logs, only the last 2 images kept, and no new Azure resource without asking the team.

**Q: Why OpenID Connect for the deploy?**
A: No long-lived Azure password is stored in GitHub. Each run gets a short-lived token, and only for our resource group.
