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

### Generate RSA Keys:
```bash
# Create keys directory
mkdir -p keys

# Generate private key
openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048

# Generate public key
openssl rsa -pubout -in keys/private.pem -out keys/public.pem
```

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

# JWT Configuration
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_EXPIRATION=1h
JWT_REFRESH_EXPIRATION=7d

# MongoDB Configuration
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=password
MONGO_URI=mongodb://admin:password@localhost:27017/test?authSource=admin
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
  "status": "healthy",
  "uptime": 35.265359111,
  "timestamp": "2025-01-26T06:40:45.587Z",
  "version": "1.0.0"
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

