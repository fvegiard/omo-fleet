FROM node:24-bookworm-slim
ARG OPENCODE_VERSION=1.19.4
RUN npm install --global opencode-ai@${OPENCODE_VERSION} && npm cache clean --force
WORKDIR /workspace
COPY boot.mjs runtime-config.mjs /opt/fleet/
ENV HOME=/state XDG_DATA_HOME=/state/data XDG_CONFIG_HOME=/state/config XDG_CACHE_HOME=/state/cache
ENTRYPOINT ["node", "/opt/fleet/boot.mjs"]
