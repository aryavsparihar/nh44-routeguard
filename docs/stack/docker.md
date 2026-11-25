# Docker

**In one line:** Docker packs the app with Node.js and everything it needs into one image, so it runs the same on a laptop, in CI and on Azure.

## What it is

- An **image** is a frozen package: operating system bits, Node.js, our built app.
- A **container** is a running copy of an image.
- A **Dockerfile** is the recipe for building the image.

## Why we use it

- Azure Container Apps runs containers, so Docker is how our app gets there.
- CI builds and tests the exact same image that would be deployed.

## Where it is in our project

| Path | What it holds |
| --- | --- |
| `Dockerfile` | The recipe, in three stages |
| `.dockerignore` | Files kept out of the build (`.env*`, `.git`, `node_modules`, the Python job, `supabase/` ...) |
| `scripts/smoke.mjs` | A quick check that the running container answers |

## How our Dockerfile works

Three stages on `node:24-alpine` (a small Linux with Node 24):

1. **deps:** `npm ci` installs the exact versions from `package-lock.json`.
2. **build:** `npm run build`. Only **public** values go in at build time (`NEXT_PUBLIC_...`, which are in the browser bundle anyway).
3. **run:** copies only `.next/standalone`, `.next/static` and `public/`. Runs as the `node` user, not root. Starts with `node server.js` on port 3000.

Secret keys (like `CLERK_SECRET_KEY`) are **never in the image**. Azure passes them in as environment variables when the container starts. CI checks there are no `.env` files or secret keys inside the image.

## Commands

```bash
docker build -t routeguard .
docker run -p 3000:3000 routeguard
```

## Learn more

- https://docs.docker.com/get-started/

## Questions you may be asked

**Q: Why three stages?**
A: The build tools and dev packages are needed to build but not to run. The last stage copies only the finished server, so the image is smaller and has less to attack.

**Q: How do you keep secrets out of the image?**
A: Only public values are used at build time. Secrets are passed in by Azure at runtime. CI looks inside the built image for `.env` files and key-shaped text and fails if it finds any.

**Q: Why run as the `node` user?**
A: If someone broke into the app, they wouldn't have root powers inside the container.

**Q: Why Alpine?**
A: It's a very small Linux, so the image downloads and starts faster.
