# wajik-anime-api (patched for Nobar King Akbar Anime)
#
# The upstream image used node:20-alpine. Our browserFetch patch drives a real
# Chromium (Puppeteer) so otakudesu.blog can be reached behind Cloudflare, and
# Puppeteer's bundled Chrome needs the Debian runtime libraries. Hence: slim.
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Runtime libraries required by the bundled Chrome
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
      libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 \
      libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
      libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
      libxtst6 wget xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# downloads Chrome for Testing into /root/.cache/puppeteer
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:20-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
      libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 \
      libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
      libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
      libxtst6 wget xdg-utils \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./
RUN npm install --only=production --no-audit --no-fund

# reuse the Chromium downloaded during the build stage
COPY --from=builder /root/.cache/puppeteer /root/.cache/puppeteer

ENV NODE_ENV=production
ENV PORT=4200

EXPOSE 4200

CMD ["node", "dist/index.js"]
