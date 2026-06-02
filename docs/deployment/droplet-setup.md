# Droplet setup — AI Hub on Digital Ocean

One-time setup guide for deploying the AI Hub Next.js app alongside the existing n8n stack on the `notrauto.org` droplet (Ubuntu 24.04 LTS, 2 GB RAM, LON1).

**Prerequisites:** SSH access as root. n8n stack already running at `/opt/n8n`.

---

## 1. System preparation

```bash
apt-get update && apt-get upgrade -y
apt-get install -y build-essential python3 git
```

`build-essential` and `python3` are required to compile the `better-sqlite3` native addon during `npm ci`.

---

## 2. Configure swap (required before first build)

The Next.js build process can spike memory. Without swap, it may OOM-kill on a 2 GB droplet also running n8n.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Verify: `free -h` should show 2 GB swap.

---

## 3. Install Node.js 22 LTS

Using NodeSource so `node` and `npm` are available as system binaries — no nvm sourcing needed in SSH sessions.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v   # expect v22.x.x
```

---

## 4. Install PM2

```bash
npm install -g pm2
```

---

## 5. Create deploy user

```bash
adduser --disabled-password --gecos "" deploy
mkdir -p /opt/aihub
chown deploy:deploy /opt/aihub
```

---

## 6. Set up GitHub Actions SSH key

Generate a dedicated keypair (no passphrase):

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /tmp/deploy_key -N ""
```

Install the public key for the deploy user:

```bash
mkdir -p /home/deploy/.ssh
cat /tmp/deploy_key.pub >> /home/deploy/.ssh/authorized_keys
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Copy the **private key** to GitHub:

```bash
cat /tmp/deploy_key
```

Add these three secrets to the GitHub repo (Settings → Secrets and variables → Actions):

| Secret name | Value |
|---|---|
| `DEPLOY_HOST` | droplet IP address |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | contents of `/tmp/deploy_key` (private key) |

Delete the temporary key files when done:

```bash
rm /tmp/deploy_key /tmp/deploy_key.pub
```

---

## 7. Clone the repository

```bash
su - deploy -c "git clone https://github.com/waynen12/AIResources.git /opt/aihub"
```

---

## 8. Create `.env.local`

Run as root (deploy user owns the directory):

```bash
su - deploy -c "cat > /opt/aihub/ai-hub/.env.local << 'EOF'
NEXT_PUBLIC_SITE_NAME=\"AI Hub\"
AUTH_SECRET=$(openssl rand -hex 32)
AUTH_URL=https://hub.notrauto.org
SETTINGS_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
EOF"
```

> **Important:** `AUTH_SECRET` and `SETTINGS_ENCRYPTION_KEY` are generated fresh on first setup. Copy them somewhere safe — if `SETTINGS_ENCRYPTION_KEY` is lost, any AI provider API keys stored in the database become unreadable. Re-run the test connection in Settings after any key rotation.

Verify the file was created:

```bash
cat /opt/aihub/ai-hub/.env.local
```

---

## 9. First build and PM2 start

```bash
su - deploy -c "cd /opt/aihub/ai-hub && npm ci && npm run build"
su - deploy -c "cd /opt/aihub/ai-hub && pm2 start npm --name aihub -- start"
su - deploy -c "pm2 save"
```

Verify it's running: `su - deploy -c "pm2 status"` — should show `aihub` online on port 3000.

---

## 10. Configure PM2 to survive reboots

```bash
pm2 startup systemd -u deploy --hp /home/deploy
```

This prints a `systemctl` command — **run that command**. It looks like:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
```

Then save the process list:

```bash
su - deploy -c "pm2 save"
```

---

## 11. Bootstrap the admin account

```bash
su - deploy -c "cd /opt/aihub/ai-hub && npx tsx scripts/manage-user.ts --create --username wayne --role admin"
```

Follow the prompts to set a password. This is the only account that needs to be created via CLI — all subsequent accounts can be created through the Settings → Manage Accounts UI.

---

## 12. Add Cloudflare DNS record

In the Cloudflare dashboard for `notrauto.org`:

- Type: **A**
- Name: **hub**
- Content: `<droplet IP>`
- Proxy status: **DNS only (grey cloud)** — same as `n8n.notrauto.org`; Caddy handles TLS directly

---

## 13. Update the n8n Caddy setup

The Caddy container needs to reach the PM2 process on the host. This requires two changes to the n8n stack at `/opt/n8n`.

### 13a. Add `extra_hosts` to the Caddy service in `docker-compose.yml`

Open `/opt/n8n/docker-compose.yml` and add `extra_hosts` to the `caddy` service:

```yaml
caddy:
  image: caddy:2
  # ... existing config ...
  extra_hosts:
    - "host-gateway:host-gateway"
  ports:
    - "80:80"
    - "443:443"
```

`host-gateway` is a Docker special value that resolves to the host's internal IP, allowing the container to reach processes listening on the host.

### 13b. Add the AI Hub site block to the Caddyfile

Open `/opt/n8n/Caddyfile` and append:

```
hub.notrauto.org {
    reverse_proxy host-gateway:3000
}
```

The full Caddyfile should now look like:

```
n8n.notrauto.org {
    reverse_proxy n8n:5678
}

hub.notrauto.org {
    reverse_proxy host-gateway:3000
}
```

### 13c. Restart the Caddy container

```bash
cd /opt/n8n
docker compose up -d caddy
```

Caddy will automatically provision a Let's Encrypt certificate for `hub.notrauto.org`. Allow up to 60 seconds for the certificate to be issued.

---

## 14. Verify end-to-end

1. Visit `https://hub.notrauto.org` — should show the login page with a valid TLS certificate.
2. Log in with the admin account created in step 11.
3. Push a trivial commit to `main` on GitHub and confirm the Actions workflow succeeds and the change appears on the live site.

---

## Subsequent deployments

All deployments happen automatically on push to `main` via GitHub Actions. To deploy manually:

```bash
su - deploy -c "cd /opt/aihub && git pull origin main && cd ai-hub && npm ci && npm run build && pm2 restart aihub"
```

## Checking logs

```bash
su - deploy -c "pm2 logs aihub --lines 50"
```
