# Builds the frontend and serves it + the faucet/keeper API from the Node server.
FROM node:20-slim

WORKDIR /app
COPY . .

# build the static frontend
RUN cd frontend && npm install && npm run build

# install the server (serves frontend/dist + /api/* and runs the keeper)
RUN cd server && npm install

WORKDIR /app/server
ENV NODE_ENV=production
# Railway provides PORT; the server reads it.
CMD ["node", "index.mjs"]
