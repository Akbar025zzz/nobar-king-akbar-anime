FROM node:22-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .

# the backend URL is needed at build time (SSR data + rewrites)
ARG INTERNAL_API_URL=http://backend:4000
ENV INTERNAL_API_URL=$INTERNAL_API_URL

RUN npm run build

FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app ./

EXPOSE 3001

CMD ["npx", "next", "start", "-p", "3001"]
