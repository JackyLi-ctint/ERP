# Stage 1: Build
FROM node:20-alpine AS builder

# Prisma requires OpenSSL on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
# Prisma schema is required by the postinstall script (prisma generate)
COPY server/prisma ./server/prisma/

RUN npm install

# Copy source code and build
COPY . .
WORKDIR /app/client
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
