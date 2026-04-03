FROM node:20-slim

# Install build tools for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Create the DB file and set permissions
RUN touch vulnerable.db && chmod 666 vulnerable.db

EXPOSE 3000
CMD ["node", "server.js"]