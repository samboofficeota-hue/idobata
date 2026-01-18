# Railway用に最適化されたDockerfile
# Railwayのルートディレクトリが idea-discussion/backend に設定されていることを前提としています

FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
# Railwayのルートディレクトリが idea-discussion/backend の場合、相対パスでコピー
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy backend source code
# Railwayのルートディレクトリが idea-discussion/backend の場合、相対パスでコピー
COPY . .

# Debug: Verify files were copied (non-failing)
RUN echo "=== Files in /app ===" && ls -la /app/ | head -20 || true
RUN echo "=== Checking server.js ===" && (test -f /app/server.js && echo "✅ server.js exists" || echo "❌ server.js NOT FOUND") || true

# Set environment variables
ENV NODE_ENV=production
# PORT is automatically set by Railway, no need to set it here
# Railway will inject PORT environment variable (typically 3000 or dynamic)

# Create uploads directory for file uploads
RUN mkdir -p uploads/profile-images uploads/temp

# Expose port (Railway will use the PORT environment variable)
# Default to 3000 if PORT is not set, but Railway always sets it
EXPOSE 3000

# Install curl for health check (optional, Railway manages health checks)
RUN apk add --no-cache curl

# Health check (Railway also has its own health check via railway.json)
# This is a backup health check at the container level
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1

# Start the application
# Railway's startCommand in railway.json will override this, but we set it as a fallback
# server.js uses process.env.PORT || 3000, so it will work with Railway's PORT
CMD ["node", "server.js"]

# Development stage (for local development, not used in Railway)
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy backend source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/profile-images uploads/temp

# Expose port for development
EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "dev"]
