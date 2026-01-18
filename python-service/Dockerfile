FROM python:3.10-slim

WORKDIR /app

# Install necessary libraries
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# PORT is automatically set by Railway, use it from environment
# Railway will inject PORT environment variable

# Start FastAPI server
# Use PORT from environment variable, default to 8080 if not set
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
