FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm install

# Copy source code
COPY . .

# Build server
WORKDIR /app/server
RUN npm run build

# Expose port
EXPOSE 3000

# Run migrations and start server
CMD ["npm", "run", "start"]
