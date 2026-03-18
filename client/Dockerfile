FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm install

# Copy source code
COPY . .

# Build client
WORKDIR /app/client
RUN npm run build

# Serve with vite preview
EXPOSE 5173

CMD ["npm", "run", "preview"]
