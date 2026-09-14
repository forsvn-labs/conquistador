# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
FROM ${NODE_IMAGE} AS verify
WORKDIR /workspace
COPY . ./
WORKDIR /workspace/runtime
RUN npm ci --ignore-scripts
RUN node --version && npm run typecheck:public && npm run test:public
RUN node bin/conquistador.js version

FROM ${NODE_IMAGE} AS runtime
WORKDIR /opt/conquistador
COPY --from=verify /workspace/ ./
WORKDIR /opt/conquistador/runtime
RUN npm prune --omit=dev --ignore-scripts && npm cache clean --force
RUN mkdir /data && chown node:node /data
WORKDIR /data
USER node
ENTRYPOINT ["node", "/opt/conquistador/runtime/bin/conquistador.js"]
