FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# Generate Prisma client and build typescript
RUN npx prisma generate
RUN npm run build

# --- Production runner stage ---
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies
RUN npm ci --omit=dev && npx prisma generate

# Copy built code from builder
COPY --from=builder /usr/src/app/dist ./dist

# Create uploads directory for Multer
RUN mkdir -p uploads

EXPOSE 4000

# Prisma migrations are run before start
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
