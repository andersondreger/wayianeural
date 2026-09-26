# Stage 1: build do export estatico (next.config.mjs -> output: 'export' -> /app/out)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Stage 2: nginx servindo o export estatico
FROM nginx:alpine
# template renderizado no start (envsubst) com os segredos do .env do servidor
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
