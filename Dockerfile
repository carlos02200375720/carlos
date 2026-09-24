# Usar la imagen oficial de Node.js
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --include=optional

COPY . .
RUN npm run build
RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
