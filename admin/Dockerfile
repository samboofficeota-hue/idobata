# Multi-stage build for admin
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Set environment variables for build
ENV VITE_API_BASE_URL=https://idobata-backend-336788531163.asia-northeast1.run.app

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Cloud Run will set PORT environment variable automatically
# Default to 8080 if not set (Cloud Run standard)
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start nginx with environment variable substitution
# Cloud Run sets PORT automatically, so we use it
CMD sh -c "envsubst '\$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
