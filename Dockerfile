# syntax=docker/dockerfile:1

ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/auth/package.json packages/auth/
COPY packages/db/package.json packages/db/
COPY packages/storage/package.json packages/storage/
RUN pnpm install --frozen-lockfile

COPY . .

RUN touch .env

ARG BACKEND_URL=http://localhost:3000
ENV BACKEND_URL="$BACKEND_URL"
RUN pnpm --filter nextcoding-web build

RUN pnpm --filter nextcoding-server build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_URL=file:/data/app.db
ENV STORAGE_DRIVER=local
ENV STORAGE_LOCAL_DIR=/data/storage

RUN apk add --no-cache nginx

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
    && mkdir -p /data/storage \
    && ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log

VOLUME ["/data"]

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
