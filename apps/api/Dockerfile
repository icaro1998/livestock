FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json tsconfig.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install
COPY . .
RUN npm run generate --workspace @livestock/db
RUN npm run build --workspace @livestock/shared
RUN npm run build --workspace @livestock/db
RUN npm run build --workspace @livestock/api

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/tsconfig.base.json ./tsconfig.base.json
CMD ["node", "apps/api/dist/index.js"]
