# RouteGuard web app image for Azure Container Apps (docs/runbook.md,
# "Deploy to Azure"). Built by .github/workflows/deploy.yml and, without
# keys, by CI on every pull request.
#
# Only public values go in at build time (they end up in the browser bundle
# and the CSP anyway). Secret keys (CLERK_SECRET_KEY) are never in the image:
# Container Apps passes them in as environment variables at runtime.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL=""
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=""
ARG CSP_REPORT_ONLY=""
ARG DEPLOYMENT_VERSION=""
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    CSP_REPORT_ONLY=$CSP_REPORT_ONLY \
    DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION \
    NEXT_PUBLIC_CLERK_KEYLESS_DISABLED=1 \
    NEXT_PUBLIC_CLERK_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1
# public/ only holds .gitkeep, which git keeps but a fresh checkout may not.
RUN mkdir -p public && npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
# The standalone server plus the files it doesn't copy by itself.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
