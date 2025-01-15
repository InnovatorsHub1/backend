# Use the official Python 3.12 image as a base
FROM python:3.12-slim

# Install system dependencies for WeasyPrint and other required packages
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    python3-cffi \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    shared-mime-info \
    libglib2.0-0 \
    wget \
    fontconfig \
    libfreetype6 \
    libjpeg-dev \
    libpng-dev \
    zlib1g-dev \
    pango1.0-tools \
    gtk-doc-tools \
    libpango1.0-dev \
    fonts-liberation \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy the requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p app/templates/pdf && \
    chmod -R 755 app/templates

# Expose the port that the Flask app runs on
EXPOSE 5000

# Command to run the application
CMD ["python", "run.py"]