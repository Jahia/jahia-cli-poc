FROM node:alpine

LABEL org.opencontainers.image.authors="Jahia Dev Team"

# Add bash
RUN apk add --no-cache bash

WORKDIR /usr/share/jahia-cli/

RUN npm install -g @jahia/jahia-cli@latest

CMD ["/bin/bash"]