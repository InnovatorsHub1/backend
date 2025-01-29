# Build stage
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM alpine:3.19

# Install Node.js and npm
RUN apk add --no-cache nodejs npm

# Install Chromium and required dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ttf-liberation \
    fontconfig

# Create app directory
WORKDIR /app

# Create coverage directory with proper permissions
RUN mkdir -p /app/coverage && \
    chmod -R 777 /app/coverage

# Copy package files
COPY package*.json ./

# Install ALL dependencies
RUN npm install && \
    npm install -g nodemon typescript ts-node tsconfig-paths tsc-alias pino-pretty

# Copy source code and configuration files
COPY . .
COPY --from=builder /app/build ./build
COPY .env ./

# Set permissions for the entire app directory
RUN chmod -R 777 /app

# Create non-root user
RUN addgroup -S pptruser && \
    adduser -S -g pptruser pptruser && \
    chown -R pptruser:pptruser /app

# Create cache directory with correct permissions
RUN mkdir -p /home/pptruser/.cache && \
    chown -R pptruser:pptruser /home/pptruser

USER pptruser

EXPOSE 3000

CMD ["npm", "run", "dev"]