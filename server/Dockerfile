FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
RUN npm prune --omit=dev

EXPOSE 8080

CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
