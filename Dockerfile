FROM node:20-slim

# 1. Install build tools
RUN apt-get update && apt-get install -y python3 make g++ curl && rm -rf /var/lib/apt/lists/*

# 2. Create a non-privileged user
RUN groupadd -r breachuser && useradd -r -g breachuser breachuser

WORKDIR /app

# 3. Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# 4. Copy code
COPY . .

# 5. Set permissions for SQLite (breachuser needs to write to the DB)
RUN touch vulnerable.db && chown breachuser:breachuser vulnerable.db && chmod 664 vulnerable.db

# 6. Switch to the non-privileged user
USER breachuser

EXPOSE 3000
CMD ["node", "server.js"]