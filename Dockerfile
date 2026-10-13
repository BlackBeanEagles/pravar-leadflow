FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/leadflow.sqlite
EXPOSE 3000
CMD ["sh", "-c", "npm run seed && npm start"]
