FROM node:22-slim

WORKDIR /app

# install dependencies (tsx runs TypeScript directly for this deployment)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# migrations run automatically on boot (src/database/migrate.ts)
CMD ["npx", "tsx", "src/index.ts"]
