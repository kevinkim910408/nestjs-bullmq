ARG VARIANT=20-bullseye
FROM mcr.microsoft.com/devcontainers/javascript-node:${VARIANT}

# [Optional] Uncomment if you want to install an additional version of node using nvm
# ARG EXTRA_NODE_VERSION=10
# RUN su node -c "source /usr/local/share/nvm/nvm.sh && nvm install ${EXTRA_NODE_VERSION}"

# [Optional] Uncomment if you want to install more global node modules
# RUN su node -c "npm install -g <your-package-list-here>"

RUN npm rm -g pnpm \
    && rm -rf $PNPM_HOME \
    && corepack enable pnpm
    
# 애플리케이션 실행을 위한 명령어 추가
CMD ["npm", "start"]