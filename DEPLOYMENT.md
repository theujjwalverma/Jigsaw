# Deployment

## Local

1. npm install
2. Configure backend/.env and frontend/.env
3. npm run dev

For same-Wi-Fi players, leave `VITE_API_URL` empty and open the admin page using
the host's LAN IP on port 5173. Create an event (automatically selected) and share its `/join/<event-id>`
URL, not `/` or a localhost URL. Vite proxies both REST and Socket.IO connections
to `127.0.0.1:5000`; the backend must also be running on port 5000.
If port 5000 is occupied, stop only the conflicting service you own or update
both the backend `PORT` and the proxy targets in `frontend/vite.config.js`.

## Production Checklist

- Set NODE_ENV=production
- Use strong JWT_SECRET
- Provide ADMIN_PASSWORD_HASH (bcrypt hash)
- Set CORS_ORIGIN to the frontend domain
- Run behind HTTPS reverse proxy
- For the default same-origin frontend, proxy `/api` and `/socket.io` (including
  WebSocket upgrades) to the backend. The Vite development proxy is not included
  in the production build. For a separate backend domain, set `VITE_API_URL`
  before building and configure `CORS_ORIGIN` accordingly.

## Docker

Use docker/docker-compose.yml to run both services.

- docker compose up --build

## Scaling Guidance

- Active state and scheduled timers are in-process; SQLite persists event
  snapshots and results. Backend restarts pause an active round between rounds.
- For multi-instance deployment, migrate active state and pub/sub to Redis and persist events/results to PostgreSQL.
