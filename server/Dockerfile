FROM node:20-alpine AS base
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY . .

EXPOSE 5000

CMD ["node", "index.js"]
