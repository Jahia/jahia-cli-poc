FROM node:alpine

LABEL org.opencontainers.image.authors="Jahia Dev Team"

# Add bash
RUN apk add --no-cache bash=5.3.3-r1

WORKDIR /usr/share/jahia-cli/

RUN npm install -g @jahia/jahia-cli@latest

CMD ["/bin/bash"]