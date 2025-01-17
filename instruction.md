## Environment Configuration

Create an `.env` file in the root of your project with the following contents:

```
FLASK_ENV=development
MONGO_USERNAME=flaskuser
MONGO_PASSWORD=your_secure_password
MONGO_DB=flask_api
LOG_LEVEL=INFO
LOG_FORMAT=default
REDIS_URL=redis://redis:6379/0
REDIS_CACHE_TIMEOUT=3600

```

## Installing Docker

To use this guide, you need Docker and Docker Desktop installed. Follow the instructions below based on your operating system:

### For Mac
1. Download Docker Desktop from the [official Docker website](https://www.docker.com/products/docker-desktop/).
2. Install Docker Desktop by following the on-screen instructions.
3. Launch Docker Desktop and ensure it is running.

### For Windows
1. Download Docker Desktop from the [official Docker website](https://www.docker.com/products/docker-desktop/).
2. Install Docker Desktop by following the on-screen instructions.
3. Ensure WSL 2 is enabled if prompted.
4. Launch Docker Desktop and verify it is running.

### For Linux
1. Install Docker:
   ```bash
   sudo apt-get update
   sudo apt-get install docker.io
   ```
2. Install Docker Compose:
   ```bash
   sudo apt-get install docker-compose
   ```
3. Verify installation:
   ```bash
   docker --version
   docker-compose --version
   ```


Once Docker is installed, proceed to the next section to build and run the API.

---

## Running the API in Docker

To build and run the API using Docker, follow these steps:

1. Ensure you have `docker` and `docker-compose` installed on your machine.
2. Navigate to the root directory of the project where the `docker-compose.yml` file is located.
3. Build and start the Docker containers:
   ```bash
   docker-compose up --build
   ```
4. The API should now be accessible at `http://localhost:5000`. Use the above `curl` commands to test the endpoints.

---

## Restarting and Cleaning Docker

To restart and clean up Docker containers, images, and volumes, follow these steps:

1. Stop all containers:
   ```bash
   docker-compose down
   ```

2. Remove all images, volumes, and containers:
   ```bash
   docker system prune -a --volumes -f
   ```

3. If you are using Docker Desktop:
   - Open Docker Desktop.
   - Go to the "Images" or "Containers" tab.
   - Manually delete any remaining resources.

Once cleaned, rebuild the Docker containers:
```bash
docker-compose up --build
```

---

## Running Tests

Running Tests Inside Container

1. List your running containers:
```bash
docker ps
```

2. Enter into the running web container:
```bash
# Using container name
docker exec -it your_container_name bash

# OR using container ID
docker exec -it your_container_id bash
```

3. Inside the container, run the tests:
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/routes/test_routes.py
pytest tests/services/test_user_service.py

# Run with coverage
pytest --cov=app tests/
```

--------------------------------------------


## Running API Calls

Create user successfully

```bash
curl -X POST http://localhost:5000/api/users/ \
-H "Content-Type: application/json" \
-d '{
    "username": "testuser",
    "email": "test@example.com"
}'
```

Create user with invalid email

```bash
curl -X POST http://localhost:5000/api/users/ \
-H "Content-Type: application/json" \
-d '{
    "username": "testuser2",
    "email": "invalid-email"
}'
```

Create user with missing fields

```bash
curl -X POST http://localhost:5000/api/users/ \
-H "Content-Type: application/json" \
-d '{
    "username": "testuser3"
}'
```

---

## 2. Get Users Tests

### Get all active users
```bash
curl http://localhost:5000/api/users/
```

### Get all users including deleted
```bash
curl "http://localhost:5000/api/users/?include_deleted=true"
```

---

## 3. Get Single User Tests

### Get existing user
```bash
curl http://localhost:5000/api/users/USER_ID
```

### Get non-existent user
```bash
curl http://localhost:5000/api/users/65939d8b1d41a8001d123456
```

---

## 4. Update User Tests

#### Update user successfully
```bash
curl -X PUT http://localhost:5000/api/users/USER_ID \
-H "Content-Type: application/json" \
-d '{
    "username": "updated_user",
    "email": "updated@example.com"
}'
```

#### Update with invalid email
```bash
curl -X PUT http://localhost:5000/api/users/USER_ID \
-H "Content-Type: application/json" \
-d '{
    "email": "invalid-email"
}'
```

---

## 5. Delete User Tests

#### Delete existing user
```bash
curl -X DELETE http://localhost:5000/api/users/USER_ID
```

#### Delete already deleted user
```bash
curl -X DELETE http://localhost:5000/api/users/USER_ID
```

---

## 6. Restore User Tests

#### Restore deleted user
```bash
curl -X POST http://localhost:5000/api/users/USER_ID/restore
```

#### Restore active user
```bash
curl -X POST http://localhost:5000/api/users/USER_ID/restore
```

---

## 7. Health Check Tests

### Get basic health status
```bash
curl http://localhost:5000/health/
```

Example response:
```json
{
    "status": "healthy",
    "timestamp": "2024-01-09T10:30:45.123456",
    "dependencies": {
        "mongodb": {
            "status": "healthy",
            "latency_ms": 0
        },
        "redis": {
            "status": "healthy",
            "latency_ms": 0
        }
    }
}
```

### Get detailed health metrics
```bash
curl http://localhost:5000/health/detailed
```

Example response:
```json
{
    "health": {
        "status": "healthy",
        "timestamp": "2024-01-09T10:30:45.123456",
        "dependencies": {
            "mongodb": {"status": "healthy"},
            "redis": {"status": "healthy"}
        }
    },
    "system_metrics": {
        "cpu": {
            "usage_percent": 45.2
        },
        "memory": {
            "total_gb": 16.0,
            "used_gb": 8.5,
            "usage_percent": 53.1
        },
        "disk": {
            "total_gb": 512.0,
            "used_gb": 256.0,
            "usage_percent": 50.0
        }
    },
    "application_metrics": {
        "uptime_seconds": 3600,
        "user_count": 1000,
        "deleted_user_count": 50,
        "python_process": {
            "memory_usage_mb": 156.8,
            "cpu_usage_percent": 2.5
        }
    }
}
```

### Get application metrics
```bash
curl http://localhost:5000/health/metrics
```

Example response:
```json
{
    "uptime_seconds": 3600,
    "user_count": 1000,
    "deleted_user_count": 50,
    "python_process": {
        "memory_usage_mb": 156.8,
        "cpu_usage_percent": 2.5
    }
}
```

---

## 8. Queue Tests

```bash
curl -X POST http://localhost:5000/api/queue/jobs \
    -H "Content-Type: application/json" \
    -d '{"key": "value"}'
```

# Check status
```bash
curl http://localhost:5000/api/queue/jobs/<job_id>
```

---

## 9. PDF Generation Tests

### Generate Invoice PDF
```bash
curl -X POST http://localhost:5000/api/pdf/generate/invoice \
-H "Content-Type: application/json" \
-d '{
    "invoice_number": "INV-001",
    "date": "2024-01-15",
    "customer": {
        "name": "John Doe",
        "email": "john@example.com"
    },
    "items": [
        {
            "name": "Product A",
            "quantity": 2,
            "price": 99.99
        },
        {
            "name": "Product B",
            "quantity": 1,
            "price": 149.99
        }
    ]
}' \
--output invoice.pdf
```

### 10. File Upload API Tests

#### Upload a file
```bash
curl -X POST http://localhost:5000/api/files/upload \
  -F "file=@sample.csv" \
  -H "Content-Type: multipart/form-data"
```

#### Get all files
```bash
curl http://localhost:5000/api/files/
```

#### Get specific file metadata
```bash
curl http://localhost:5000/api/files/<file_id>
```

#### Delete a file
```bash
curl -X DELETE http://localhost:5000/api/files/<file_id>
```
