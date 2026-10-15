FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
RUN mkdir -p /seed && ./node_modules/.bin/esbuild scripts/seed-questions.ts --bundle --platform=node --format=esm --external:mongodb --outfile=/seed/seed.mjs

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup --system --gid 1001 dino && adduser --system --uid 1001 --ingroup dino dino
COPY --from=build --chown=dino:dino /app/.next/standalone ./
COPY --from=build --chown=dino:dino /app/.next/static ./.next/static
COPY --from=build --chown=dino:dino /app/public ./public
COPY --from=build --chown=dino:dino /seed/seed.mjs ./seed.mjs
USER dino
EXPOSE 3000
CMD ["node", "server.js"]
