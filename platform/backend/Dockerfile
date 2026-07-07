FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
EXPOSE 3000
CMD ["sh", "-c", "mkdir -p /app/uploads && npx prisma db push && node src/index.js"]
