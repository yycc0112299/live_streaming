FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4180
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs store.mjs room.mjs ./
COPY scripts/account-role.mjs ./scripts/account-role.mjs
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown node:node /app/data
ENV DB_PATH=/app/data/live.sqlite
USER node
EXPOSE 4180
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4180/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
