FROM node:16-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install


COPY ./prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:16-alpine AS runner
WORKDIR /app

COPY --from=builder app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY package.json package-lock.json ./
RUN npm install --only=production

EXPOSE 8080
CMD ["node", "dist/index.js"]


