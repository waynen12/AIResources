# AI Hub runtime: PM2 on host over Docker container

The AI Hub Next.js app runs as a native Node.js process managed by PM2, not as a Docker container, on the Digital Ocean droplet.

## Key decisions and why

**PM2 on host, not a Docker container.** The droplet has 2 GB RAM and already runs a Docker Compose stack (Caddy + n8n + PostgreSQL) consuming ~600–800 MB at idle. Adding a Next.js container would push the system close to its ceiling, increasing the risk of OOM kills during n8n workflow execution or a Next.js build. Running native PM2 avoids all container overhead (~100 MB saved) and keeps the two concerns — n8n infrastructure and the AI Hub app — independently deployable without touching each other's Compose files.

**SQLite has no daemon to containerise.** One of Docker's primary benefits is isolating a networked daemon (Postgres, Redis, etc.) from the host. The AI Hub uses `better-sqlite3`, a synchronous embedded database. There is no process to isolate — the database is a single file at `/opt/aihub/ai-hub/data/aihub.db`. Containerising the app for this reason would add complexity with no architectural benefit.

**Caddy proxies to `host-gateway:3000`.** The existing Caddy container handles TLS for the entire droplet. Rather than joining the n8n Docker network or creating a new shared network, Caddy reaches the PM2 process at `host-gateway:3000`. The `host-gateway` extra-host entry is added to the Caddy service in `docker-compose.yml` — this is a one-line change and keeps the n8n stack otherwise untouched.

**Deployments are simpler without Docker.** GitHub Actions SSHes into the droplet and runs `git pull / npm ci / npm run build / pm2 restart aihub`. No image build, no registry push, no compose pull. The deploy script is four lines.

## Considered options

- **Add `aihub` service to the existing n8n `docker-compose.yml`** — consistent with the rest of the stack, but mixes unrelated concerns in one Compose file. Any future change to n8n's Compose file (upgrade, network change) now also affects AI Hub deployment. Rejected.
- **Separate Docker Compose stack for AI Hub** — keeps concerns separate, but the Caddy container in the n8n stack can't see a container in a different stack without a shared external Docker network. Adds networking complexity for no gain over native PM2. Rejected.
- **Native PM2 (chosen)** — lowest memory footprint, simplest deploy, no changes to the n8n stack beyond one `extra_hosts` line and one Caddyfile block.
