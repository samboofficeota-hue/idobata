FROM python:3.10-slim

WORKDIR /app

# Install necessary libraries
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set environment variables for Cloud Run
ENV PORT=8080

# Start FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
