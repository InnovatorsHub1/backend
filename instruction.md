```markdown
# Project Documentation

## Docker Operations

### Clean and Restart

```bash
# Stop containers
docker-compose down

# Remove all resources
docker system prune -a --volumes -f

# Rebuild
docker-compose up --build
```

## Environment Setup

### Configure .env:

```env
PORT=3000
APP_NAME=api-gateway
NODE_ENV=development
IS_ELASTIC_CONFIGURED=false
ELASTIC_URL=http://localhost:9200
BASE_URL=/api
CORS_ORIGINS=*
COOKIE_SECRET=your-secret-key
API_VERSION=v1
```

### Install dependencies:

```bash
npm install
```

### Start development:

```bash
npm run dev
```

## API Endpoints

### Health Check

```bash
curl http://localhost:3000/api/health \
  -H "x-api-key: your-api-key" \
  -G -d "version=1"
```

#### Response:

```json
{
  "status":"healthy",
  "uptime":35.265359111,
  "timestamp":"2025-01-26T06:40:45.587Z",
  "version":"1.0.0",
}
```

## Running Tests

```bash
# All tests
npm run test:integration

```



### Port in Use

```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>
```

## Docker Cleanup

```bash
# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune
```
```

