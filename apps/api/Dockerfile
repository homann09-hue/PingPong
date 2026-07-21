# syntax=docker/dockerfile:1
# Railway/Container-Build fuer den Aurora-API-Server (Monorepo, npm workspaces).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/player-web/package.json apps/player-web/
COPY packages/slot-engine/package.json packages/slot-engine/
COPY packages/design-tokens/package.json packages/design-tokens/
RUN npm ci --workspace @aurora/api --workspace @aurora/slot-engine --include-workspace-root
COPY packages/slot-engine packages/slot-engine
COPY apps/api apps/api
RUN npm run build -w @aurora/slot-engine && npm run build -w @aurora/api
RUN npm prune --omit=dev --workspace @aurora/api --workspace @aurora/slot-engine --include-workspace-root

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/packages/slot-engine/package.json packages/slot-engine/package.json
COPY --from=build /app/packages/slot-engine/dist packages/slot-engine/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 8080
CMD ["node", "apps/api/dist/server.js"]
