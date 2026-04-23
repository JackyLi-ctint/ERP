FROM node:20-alpine

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

# Copy source code
COPY . .

# Build client
WORKDIR /app/client
RUN npm run build

# Serve with vite preview
EXPOSE 5173

CMD ["npm", "run", "preview"]
