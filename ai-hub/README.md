# AI Hub

An internal team resource site for sharing AI-related tutorials, articles, YouTube videos, and courses.

Built with Next.js 16, SQLite (better-sqlite3), shadcn/ui, and Tailwind CSS v4.

---

## Windows Server / IIS Deployment

### Prerequisites

Install the following on the Windows Server before proceeding:

- **Node.js 20 LTS** (or later) — [nodejs.org](https://nodejs.org)
- **IIS** with the **Application Request Routing (ARR)** and **URL Rewrite** modules installed
  - ARR: [Microsoft download](https://www.iis.net/downloads/microsoft/application-request-routing)
  - URL Rewrite: [Microsoft download](https://www.iis.net/downloads/microsoft/url-rewrite)
- **Git** (optional, for pulling updates)

---

### 1. Copy the app files to the server

Copy the project folder to the server, for example:

```
C:\inetpub\wwwroot\ai-hub\
```

You can use Git, robocopy, or a ZIP file. The `data\` folder (containing the SQLite database) is git-ignored and will be created automatically on first run — do not copy it from another server if you want a clean install.

---

### 2. Generate the encryption key

The app encrypts AI provider API keys stored in the database using AES-256-GCM. You must generate a unique 32-byte key for each deployment.

Open a Command Prompt or PowerShell on the server and run:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output — it will look like:

```
a3f8c2d1e4b7960f2a1c3d5e7f890b12c4d6e8f0a2b4c6d8e0f1a3b5c7d9e1f3
```

Keep this value secret. Losing it means existing encrypted API keys in the database cannot be decrypted.

---

### 3. Create the `.env.local` file

In the app root (`C:\inetpub\wwwroot\ai-hub\`), create a file named `.env.local` with the following content:

```env
# Display name shown in the site header and browser tab
NEXT_PUBLIC_SITE_NAME="Company AI Hub"

# 32-byte hex secret generated in step 2 — required for API key encryption
SETTINGS_ENCRYPTION_KEY=paste_your_generated_key_here
```

Replace `paste_your_generated_key_here` with the value from step 2.
Replace `Company AI Hub` with your preferred site name.

> **Important:** Never commit `.env.local` to source control. It contains your encryption key.

---

### 4. Install dependencies and build

Open a Command Prompt **as Administrator**, navigate to the app folder, and run:

```cmd
cd C:\inetpub\wwwroot\ai-hub
npm install
npm run build
```

The build step compiles the Next.js app for production. This may take a minute.

---

### 5. Verify the app starts

Before configuring IIS, confirm the app runs correctly:

```cmd
npm start
```

You should see output similar to:

```
▲ Next.js 16.x.x
- Local: http://localhost:3000
```

Open `http://localhost:3000` in a browser on the server to verify resources load. Press `Ctrl+C` to stop.

---

### 6. Run the app as a Windows Service

Use **NSSM** (Non-Sucking Service Manager) to run Node.js as a Windows service so it restarts automatically.

**Download NSSM** from [nssm.cc](https://nssm.cc/download) and place `nssm.exe` in `C:\Windows\System32\`.

Then run in an elevated Command Prompt:

```cmd
nssm install AIHub
```

In the NSSM dialog that opens:

| Field | Value |
|---|---|
| Path | `C:\Program Files\nodejs\node.exe` |
| Startup directory | `C:\inetpub\wwwroot\ai-hub` |
| Arguments | `node_modules\.bin\next start` |

Switch to the **Environment** tab and add:

```
NODE_ENV=production
```

Click **Install service**, then start it:

```cmd
nssm start AIHub
```

Confirm the service is running:

```cmd
nssm status AIHub
```

---

### 7. Configure IIS as a reverse proxy

Open **IIS Manager**.

#### 7a. Enable proxy in ARR

1. Click the server root node in the left panel
2. Open **Application Request Routing Cache**
3. Click **Server Proxy Settings** in the right panel
4. Check **Enable proxy** and click **Apply**

#### 7b. Create or select the IIS site

Either use an existing site or create a new one pointing to any local folder (IIS will not serve files directly — all traffic is proxied to Node).

#### 7c. Add a URL Rewrite rule

1. Select your site in IIS Manager
2. Open **URL Rewrite**
3. Click **Add Rule(s)** → **Blank rule** (under Inbound Rules)

Configure:

| Setting | Value |
|---|---|
| Name | `Proxy to AI Hub` |
| Match URL — Pattern | `(.*)` |
| Conditions | *(none needed)* |
| Action type | `Rewrite` |
| Rewrite URL | `http://localhost:3000/{R:1}` |
| Append query string | checked |
| Stop processing | checked |

Click **Apply**.

#### 7d. Alternatively, use a `web.config` file

Create `web.config` in your IIS site root:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Proxy to AI Hub" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://localhost:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

---

### 8. Set data folder permissions

The Node.js process must be able to write to the `data\` folder (where the SQLite database lives).

If Node is running as the `LOCAL SERVICE` account or the NSSM service account, grant it **Modify** permissions on:

```
C:\inetpub\wwwroot\ai-hub\data\
```

Right-click the folder → **Properties** → **Security** → **Edit** → add the service account with **Modify** permission.

---

### 9. Verify the full stack

1. Browse to your IIS site URL (e.g. `http://your-server/` or `http://your-server:8080/`)
2. The AI Hub home page should load
3. Add a test resource to confirm the database is writable

---

## Upgrading

To deploy a new version of the app:

```cmd
nssm stop AIHub
cd C:\inetpub\wwwroot\ai-hub
git pull        # or copy new files manually
npm install
npm run build
nssm start AIHub
```

The SQLite database in `data\aihub.db` is preserved across upgrades.

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `SETTINGS_ENCRYPTION_KEY` | Yes | 32-byte hex key for AES-256-GCM encryption of AI API keys in the DB |
| `NEXT_PUBLIC_SITE_NAME` | No | Site title shown in the header. Defaults to `"AI Hub"` |

---

## Troubleshooting

**App starts but IIS returns 502 Bad Gateway**
- Confirm the Node service is running: `nssm status AIHub`
- Confirm it is listening on port 3000: `netstat -an | find "3000"`
- Check ARR proxy is enabled (step 7a)

**Database errors on startup**
- Confirm the `data\` folder exists and the service account has write permission (step 8)
- Check the Windows Event Log and the NSSM service log for details

**AI features not working after deployment**
- AI provider API keys are encrypted with `SETTINGS_ENCRYPTION_KEY`. If this key changes between deployments, existing keys in the DB cannot be decrypted — re-enter the API key in Settings
- Confirm `SETTINGS_ENCRYPTION_KEY` in `.env.local` matches the value used when the key was originally saved

**Port conflict**
- To run on a port other than 3000, change the NSSM Arguments to: `node_modules\.bin\next start -p 8080` and update the IIS rewrite rule URL to match

---

## n8n Workflow Integration (Daily News tab)

The News tab is fed by two existing n8n workflows. The steps below add a single HTTP Request node to each workflow that POSTs the AI-generated digest to AI Hub. **The Telegram and email paths in both workflows are left completely untouched.**

---

### Step 1 — Generate the Ingest Token

1. Sign in to AI Hub with an Admin account
2. Open **Settings** (gear icon, top-right)
3. Scroll to **News Ingest Token** and click **Generate Token**
4. Copy the token immediately — it is only shown once
5. Store it somewhere safe; you will paste it into both workflows below

---

### Step 2 — Daily Digest workflow

Open the **General AI News (Daily Digest)** workflow in n8n.

#### 2a — Re-enable "Code in JavaScript1"

This node already exists in the canvas but is currently disabled. It strips markdown code fences from the model output to produce clean HTML.

1. Right-click the **Code in JavaScript1** node
2. Click **Enable**

#### 2b — Connect "Message a model" to "Code in JavaScript1"

The existing connection from **Message a model** → **Code in JavaScript2** (the Telegram path) stays as-is. You are adding a second output connection, not replacing it.

1. Hover over the **Message a model** node until the output connector appears on its right edge
2. Drag from that connector to the input of **Code in JavaScript1**

The path now looks like:

```
Message a model ──► Code in JavaScript2 ──► Send a text message  (Telegram — unchanged)
                └──► Code in JavaScript1 ──► [new HTTP Request node]
```

#### 2c — Add an HTTP Request node

1. Click **+** to add a new node after **Code in JavaScript1**, or drag one from the node panel
2. Select **HTTP Request**
3. Configure it as follows:

| Setting | Value |
|---|---|
| Method | `POST` |
| URL | `https://<your-ai-hub-host>/api/news/ingest` |

4. Open **Headers**, click **Add header**:

| Name | Value |
|---|---|
| `Authorization` | `Bearer <paste your token from Step 1>` |

5. Set **Body** → **JSON**, and enter the following in the **JSON body** field:

```json
{
  "feed_type": "daily",
  "digest_html": "={{ $json.html }}",
  "articles": "={{ $('Merge').all().map(i => ({ title: i.json.title, url: i.json.link })) }}"
}
```

> The `articles` expression reaches back to the **Merge** node — where all 7 RSS feeds are combined — to pull the raw `title` and `link` fields before they were reformatted into a text summary.

6. Connect **Code in JavaScript1** → new HTTP Request node

---

### Step 3 — Learning News (Weekly) workflow

Open the **Learning News (Weekly)** workflow in n8n.

The **Strip Code Fences** node is already active in this workflow and already produces `{ html }`. You are adding a second output connection from it — the existing **Strip Code Fences** → **Send an email** connection stays untouched.

#### 3a — Add an HTTP Request node

1. Add a new **HTTP Request** node to the canvas
2. Configure it identically to Step 2c above, with one change — use `"weekly"` for `feed_type`:

| Setting | Value |
|---|---|
| Method | `POST` |
| URL | `https://<your-ai-hub-host>/api/news/ingest` |

Headers:

| Name | Value |
|---|---|
| `Authorization` | `Bearer <paste your token from Step 1>` |

JSON body:

```json
{
  "feed_type": "weekly",
  "digest_html": "={{ $json.html }}",
  "articles": "={{ $('Merge').all().map(i => ({ title: i.json.title, url: i.json.link })) }}"
}
```

#### 3b — Connect Strip Code Fences to the new node

1. Hover over **Strip Code Fences** until the output connector appears
2. Drag from that connector to the input of the new HTTP Request node

The path now looks like:

```
Strip Code Fences ──► Send an email  (email — unchanged)
                  └──► [new HTTP Request node]

Message a model ──► Prepare for telegram ──► Send a text message  (Telegram — unchanged)
```

---

### Step 4 — Verify

1. Manually execute one of the workflows using the **Test workflow** button in n8n
2. Check the HTTP Request node's output panel — you should see a `200 OK` response with `{ "id": <number> }`
3. Open AI Hub → **News** tab → select the matching feed — the digest should appear

If you see a `401` response, the token in the Authorization header does not match what is stored in AI Hub. Regenerate the token in Settings and update both workflow nodes.

---

### Token rotation

If you ever need to rotate the token:

1. Go to AI Hub → Settings → **News Ingest Token** → **Regenerate**
2. Copy the new token
3. Update the **Authorization** header in the HTTP Request node in **both** workflows
4. Save and re-activate each workflow
