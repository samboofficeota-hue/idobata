FROM node:20-alpine AS production

WORKDIR /app

# Copy package files from backend directory
COPY idea-discussion/backend/package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy backend source code
COPY idea-discussion/backend/ ./

# Set environment variables
ENV NODE_ENV=production
# PORT is automatically set by Cloud Run, no need to set it here

# Create uploads directory
RUN mkdir -p uploads/profile-images uploads/temp

# Expose port
EXPOSE 8080

# Install curl for health check
RUN apk add --no-cache curl

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1

# Start the application
# Verify server.js exists before starting and provide detailed debugging
CMD ["sh", "-c", "echo '=== Container Startup Debug ===' && echo 'Current directory:' && pwd && echo 'Files in /app:' && ls -la /app/ && echo 'PORT environment variable:' && echo $PORT && echo 'Checking for server.js...' && if [ ! -f server.js ]; then echo 'ERROR: server.js not found in /app/'; echo 'Directory contents:'; ls -la; exit 1; fi && echo 'server.js found, starting server...' && echo 'Node version:' && node --version && echo 'Starting backend server on port' $PORT && exec node server.js"]

# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files from backend directory
COPY idea-discussion/backend/package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy backend source code
COPY idea-discussion/backend/ ./

# Create uploads directory
RUN mkdir -p uploads/profile-images uploads/temp

# Expose port
EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "dev"]