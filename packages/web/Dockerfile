FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

# Install dependencies
RUN npm install --workspace=@kis-books/shared --workspace=@kis-books/web

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/web/ ./packages/web/

# Build shared package
RUN npm run build --workspace=@kis-books/shared

EXPOSE 5173

CMD ["npm", "run", "dev", "--workspace=@kis-books/web", "--", "--host", "0.0.0.0"]
