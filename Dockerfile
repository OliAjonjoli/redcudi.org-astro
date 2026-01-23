FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build Astro static site
RUN npm run build

# Use a lightweight server for serving static files
RUN npm install -g serve

EXPOSE 3000

# Serve the built Astro site
CMD ["serve", "-s", "dist", "-l", "3000"]
