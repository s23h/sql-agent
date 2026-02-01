# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy workspace packages
COPY packages/ packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY src/ src/
COPY index.html vite.config.ts tsconfig*.json ./
COPY public/ public/

# Build packages and app
RUN pnpm run build

# Production stage
FROM node:20-slim AS runner

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

# Copy package files for production install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ packages/

# Install production dependencies
RUN pnpm install --frozen-lockfile --prod

# Install tsx for running TypeScript server
RUN pnpm add -w tsx cross-env

# Copy built artifacts
COPY --from=builder /app/dist dist/
COPY --from=builder /app/packages/*/dist packages/

# Copy server source (needed for tsx to run)
COPY src/server src/server/
COPY tsconfig*.json ./

# Create data directory for session storage
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["pnpm", "run", "preview"]
