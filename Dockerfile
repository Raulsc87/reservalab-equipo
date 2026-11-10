FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN npm install --global pnpm@12.14.0

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @reservalab/shared build
RUN pnpm --filter @reservalab/api build
RUN pnpm --filter @reservalab/web build


FROM build AS api

WORKDIR /app/apps/api

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/server.js"]


FROM nginx:alpine AS web

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80