# Multi-stage build for frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --force

# Copy source code
COPY frontend/ .

# Clean install to fix rollup dependencies
RUN rm -rf node_modules package-lock.json && npm install

# Set environment variables for build
ENV VITE_API_BASE_URL=https://idobata-backend-doisltwsmq-an.a.run.app

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Set environment variable for port
ENV PORT=80

# Expose port
EXPOSE $PORT

# Start nginx with environment variable substitution
CMD envsubst '${PORT}' < /etc/nginx/conf.d/default.conf > /tmp/default.conf && mv /tmp/default.conf /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'
