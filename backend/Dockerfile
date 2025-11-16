FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# psycopg2-binary includes precompiled binaries, so gcc is optional
# Install python3-dev (required for some Python packages)
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get update && \
    apt-get install -y --no-install-recommends python3-dev && \
    rm -rf /var/lib/apt/lists/*

# Try to install gcc (optional, for packages that might need compilation)
# If it fails due to hash mismatch, we continue anyway
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc || echo "gcc installation skipped" && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 3001

# Run uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001", "--reload"]

