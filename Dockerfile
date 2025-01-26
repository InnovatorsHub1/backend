# Build stage
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage with conditional dev dependencies
FROM node:20-alpine
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /app
COPY package*.json ./
RUN if [ "$NODE_ENV" = "development" ]; then npm install; else npm ci --only=production; fi
COPY --from=builder /app/build ./build
COPY .env ./
EXPOSE 3000
RUN adduser -D appuser
USER appuser
CMD ["node", "build/src/index.js"]