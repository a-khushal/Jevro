FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npm run prisma:generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 8080

CMD ["sh", "-c", "npm run prisma:deploy && npm start"]
