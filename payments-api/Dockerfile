FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs auth.mjs ./
RUN mkdir -p /data/avatars && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["node", "server.mjs"]
