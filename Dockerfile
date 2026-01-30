# js/express/Dockerfile - build de l'image pour prod
# Étape 1 : Build de l'application
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm install --omit=dev

# Étape 2 : Image finale légère
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/ .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "bin/www"]
