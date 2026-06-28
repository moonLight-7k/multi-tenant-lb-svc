FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node ./build.js

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY docs/contract.yaml ./docs/contract.yaml
RUN chown -R app:app /app
USER app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "./dist/server.js"]
