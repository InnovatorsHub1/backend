# Project Documentation

## Docker Operations

### Clean and Restart

```bash
# Stop containers
docker-compose down

# Remove all resources
docker system prune -a --volumes -f

or

docker-compose down -v
docker system prune -f

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
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=password
MONGO_URI=mongodb://admin:password@localhost:27017/test?authSource=admin

# Redis configuration
REDIS_URL=redis://localhost:6379
QUEUE_NAME=default
MAX_RETRIES=3
RETRY_DELAY=300000 # 5 minutes
JOB_TIMEOUT=3600000 # 1 hour

# Worker configuration
CONCURRENCY=4
PREFETCH_COUNT=10
POLL_INTERVAL=1000 # 1 second
MAX_TASKS_PER_CHILD=1000
```

https://docs.google.com/document/d/1_PNVU0uA0xQnSxFRXfW1dFHsoepPcC7AbL1gZynQx5w/edit?usp=sharing

if you dont have permission please talk with shay saruusi elshten

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
  "status": "healthy",
  "uptime": 35.265359111,
  "timestamp": "2025-01-26T06:40:45.587Z",
  "version": "1.0.0"
}
```

### Authentication Routes

#### Signup

```bash
curl -X POST \
  http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Yourpassword2@",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890"    
  }'
```
#### Response:

```json
{
  "message": "signup success"
}
```
#### Login

```bash
curl -c cookies.txt -X POST \
  http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Yourpassword2@"
  }'
```
#### Response:

```json
{
  "message": "login success"
}
```

#### Refresh

```bash
curl --cookie cookies.txt --cookie-jar cookies.txt -X POST \
  http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{}'
```
#### Response:

```json
{
  "message": "refresh success"
}
```

#### Logout

```bash
curl --cookie cookies.txt -X POST \
  http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{}'
```
#### Response:

```json
{
  "message": "logout success"
}
```

### PDF Generation


```bash
curl -X POST \
  'http://localhost:3000/api/pdf/generate' \
  -H 'Content-Type: application/json' \
  -d '{
    "templateName": "invoice",
    "data": {
      "company_name": "Test Company",
      "company_address": "123 Business Street",
      "company_city": "Business City",
      "company_country": "Country",
      "company_phone": "+1 234 567 890",
      "company_email": "contact@company.com",

      "invoice_number": "INV-001",
      "invoice_date": "2025-01-27",
      "due_date": "2025-02-26",

      "client_name": "Client Company Name",
      "client_address": "456 Client Street",
      "client_city": "Client City",
      "client_country": "Country",
      "client_phone": "+1 098 765 432",
      "client_email": "client@clientcompany.com",

      "items": [
        {
          "description": "Service 1",
          "quantity": 2,
          "unit_price": 100,
          "amount": 200
        }
      ],

      "subtotal": 200,
      "tax_rate": 20,
      "tax_amount": 40,
      "total": 240,

      "payment_terms": 30
    }
  }' \
  --output invoice.pdf
```

### Queue :

```bash
curl -X POST http://localhost:3000/api/queue/enqueue \
 -H "Content-Type: application/json" \
 -d '{
   "task": "process video",
   "priority": 1
 }'
```

get queue status

```bash
curl -X GET http://localhost:3000/api/queue/status/{jobId}

```

cancel job :

```bash
curl -X POST http://localhost:3000/api/queue/cancel/{jobId}
```

## Running Tests

### with Docker

```bash
docker-compose up -d
# All tests
docker-compose exec app npm run test:unit
```

### in local

```bash
npm run test:unit
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
