# User API Tests

This document provides a comprehensive guide to testing the User API, including creating, retrieving, updating, deleting, and restoring users. Each section includes `curl` commands for testing various API endpoints.

---

## Environment Configuration

Create an `.env` file in the root of your project with the following contents:

```
FLASK_ENV=development
MONGO_USERNAME=flaskuser
MONGO_PASSWORD=your_secure_password
MONGO_DB=flask_api
```

---


## Running the API in Docker

To build and run the API using Docker, follow these steps:

1. Ensure you have `docker` and `docker-compose` installed on your machine.
2. Navigate to the root directory of the project where the `docker-compose.yml` file is located.
3. Build and start the Docker containers:
   ```bash
   docker-compose up --build
   ```
4. To stop and remove the containers, run:
   ```bash
   docker-compose down
   ```
5. The API should now be accessible at `http://localhost:5000`. Use the above `curl` commands to test the endpoints.

---


## Running Tests

### Method 1: Running Tests Inside Container

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

|_____________________________________________
 

## Running Api Call

### Create user successfully
```bash
curl -X POST http://localhost:5000/api/users/ \
-H "Content-Type: application/json" \
-d '{
    "username": "testuser",
    "email": "test@example.com"
}'
```

### Create user with invalid email
```bash
curl -X POST http://localhost:5000/api/users/ \
-H "Content-Type: application/json" \
-d '{
    "username": "testuser2",
    "email": "invalid-email"
}'
```

### Create user with missing fields
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

### Update user successfully
```bash
curl -X PUT http://localhost:5000/api/users/USER_ID \
-H "Content-Type: application/json" \
-d '{
    "username": "updated_user",
    "email": "updated@example.com"
}'
```

### Update with invalid email
```bash
curl -X PUT http://localhost:5000/api/users/USER_ID \
-H "Content-Type: application/json" \
-d '{
    "email": "invalid-email"
}'
```

---

## 5. Delete User Tests

### Delete existing user
```bash
curl -X DELETE http://localhost:5000/api/users/USER_ID
```

### Delete already deleted user
```bash
curl -X DELETE http://localhost:5000/api/users/USER_ID
```

---

## 6. Restore User Tests

### Restore deleted user
```bash
curl -X POST http://localhost:5000/api/users/USER_ID/restore
```

### Restore active user
```bash
curl -X POST http://localhost:5000/api/users/USER_ID/restore
```









