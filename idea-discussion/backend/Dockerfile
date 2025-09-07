# Stage 1: Build Backend Server
FROM node:20-alpine AS backend-builder
WORKDIR /app

# Copy root package files and relevant workspace package.json files
COPY package.json package-lock.json ./
COPY ./idea-discussion/backend/package.json ./idea-discussion/backend/

# Install ALL dependencies (including dev) needed for build
RUN npm install --workspace=idobata-idea-discussion-backend

WORKDIR /app/idea-discussion/backend
# Copy the backend source code
COPY ./idea-discussion/backend ./
# Build backend
RUN npm run build

# Stage 2: Final Production Image for Cloud Run
FROM node:20-alpine AS production
WORKDIR /app

# Copy installed node_modules from the first stage
COPY --from=backend-builder /app/node_modules ./node_modules

# Copy built backend source code
COPY --from=backend-builder /app/idea-discussion/backend ./idea-discussion/backend

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app/idea-discussion/backend

# Cloud Run uses PORT environment variable
EXPOSE 8080

# Start the application
CMD ["npm", "start"]

# Development stage for hot-reload
FROM node:20-alpine AS development
WORKDIR /app

# Copy installed node_modules from the first stage
COPY --from=backend-builder /app/node_modules ./node_modules

# Set environment variables
ENV NODE_ENV=development
ENV PATH /app/node_modules/.bin:$PATH

WORKDIR /app/idea-discussion/backend
EXPOSE 3000
CMD ["npm", "run", "dev"]
