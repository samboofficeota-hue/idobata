FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (using install since package-lock.json may not exist)
RUN npm install --omit=dev --production

# Copy source code
COPY . .

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

# Start the application with startup wrapper
CMD ["node", "start.js"]

# Development stage
FROM node:20-alpine AS development

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/profile-images uploads/temp

# Expose port
EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "dev"]