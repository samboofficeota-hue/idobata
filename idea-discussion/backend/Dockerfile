FROM node:20-alpine AS production

WORKDIR /app

# Copy package files from backend directory
COPY idea-discussion/backend/package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy backend source code
# Note: Build context is project root (.), so we copy from idea-discussion/backend/
COPY idea-discussion/backend/ ./

# Verify server.js was copied correctly
RUN ls -la && test -f server.js || (echo "ERROR: server.js not found after COPY" && exit 1)

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

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
# Verify server.js exists before starting
CMD ["sh", "-c", "if [ ! -f server.js ]; then echo 'ERROR: server.js not found in /app/'; ls -la; exit 1; fi && echo 'Starting backend server on port' $PORT && node server.js"]

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