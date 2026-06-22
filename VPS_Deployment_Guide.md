# VPS Multi-App Deployment Guide: Docker, Traefik, & GitHub Actions

This guide explains how to deploy and host **any** web application (Node, Python, React, PHP, Go, etc.) on your Hostinger KVM2 VPS, running side-by-side with your existing projects (`n8n`, `intellihrhub`, etc.) under automated HTTPS (SSL).

---

## 1. The Architecture
Your VPS uses a **Single Gateway (Reverse Proxy)** architecture:
* **Traefik** runs in `host` network mode, binding directly to ports `80` (HTTP) and `443` (HTTPS) on the VPS.
* Traefik listens to Docker events. When a new container starts up with specific **Traefik Labels**, Traefik automatically:
  1. Requests a Let's Encrypt SSL certificate for the domain.
  2. Routes traffic from that domain (e.g. `myapp.com`) to the correct container.
* Your containers can run on any port internally (e.g. `8080`, `3000`) and do not even need to expose ports to the host publicly, making the server extremely secure.

```
                  [ Web Traffic (80 / 443) ]
                              │
                              ▼
                 [ Global Traefik Container ]
                 (Decides route based on Host)
                  /           │            \
                 ▼            ▼             ▼
          [ intellihrhub ]  [ n8n ]   [ Your New App ]
             (Port 8080)   (Port 5678)   (Port 3000)
```

---

## 2. Step 1: Dockerize Your New Application
For any app to deploy, it needs a `Dockerfile` and a `docker-compose.yml`.

### Example Dockerfile (Node.js/React/API)
Create a `Dockerfile` in your app repository:
```dockerfile
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Example docker-compose.yml with Traefik Labels
Create a `docker-compose.yml` in your app repository. Replace `myapp.com` and `letsencrypt` with your variables:
```yaml
version: "3.8"

services:
  app:
    build: .
    restart: always
    environment:
      - PORT=3000
      - NODE_ENV=production
    ports:
      # Expose a custom port on the host (e.g., 8085) so Traefik can route to it
      - "8085:3000"
    labels:
      - "traefik.enable=true"
      # Host routing (supports both root and www)
      - "traefik.http.routers.myapp.rule=Host(`myapp.com`) || Host(`www.myapp.com`)"
      - "traefik.http.routers.myapp.entrypoints=websecure"
      - "traefik.http.routers.myapp.tls=true"
      # Tells Traefik to use your VPS's existing Let's Encrypt cert resolver
      - "traefik.http.routers.myapp.tls.certresolver=letsencrypt"
      # The internal port inside the container where the app is listening
      - "traefik.http.services.myapp.loadbalancer.server.port=3000"
```

---

## 3. Step 2: Configure Your DNS (GoDaddy / Cloudflare)
To route the domain to your VPS:
1. Log into your domain registrar (GoDaddy, Namecheap, etc.).
2. Go to the DNS settings for `myapp.com`.
3. Add an **`A` Record**:
   * **Host/Name**: `@`
   * **Value/IP**: `YOUR_VPS_IP`
4. Add a **`CNAME` Record** (Optional, for `www` forwarding):
   * **Host/Name**: `www`
   * **Value/Target**: `@` (or `myapp.com`)

---

## 4. Step 3: Set up the Project on the VPS (Initial Deploy)
1. SSH into your VPS:
   ```bash
   ssh root@YOUR_VPS_IP
   ```
2. Navigate to `/var/www` and clone your project:
   ```bash
   cd /var/www
   git clone https://github.com/yourusername/yourproject.git mynewapp
   cd mynewapp
   ```
3. Create your production `.env` file (if needed) and add your production secrets.
4. Run the build and start the containers manually the first time:
   ```bash
   docker compose up -d --build
   ```
5. Test the site in your browser: `https://myapp.com`. Traefik will take about 30 seconds to fetch the SSL certificate on the first load.

---

## 5. Step 4: Automate Redeployments (GitHub Actions)
To make your project auto-deploy every time you run `git push origin main`:

### 1. Add the Deploy Script
Create `deploy.sh` in the root of your project:
```bash
#!/bin/bash
set -e

PROJECT_DIR="/var/www/mynewapp"
BRANCH="main"

echo "=== Pulling latest changes ==="
cd "$PROJECT_DIR"
git fetch origin
git checkout -f "$BRANCH"
git reset --hard "origin/$BRANCH"
git pull origin "$BRANCH"

echo "=== Building and starting containers ==="
docker compose up -d --build

echo "=== Cleaning Docker caches ==="
docker image prune -f

echo "=== Deployment Successful ==="
```
Make sure to check it in to Git and run `chmod +x deploy.sh` once on the VPS.

### 2. Create the GitHub Actions Workflow
Create a file at `.github/workflows/deploy.yml` in your project:
```yaml
name: Deploy to VPS

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Run Deploy Script via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USERNAME }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /var/www/mynewapp
            chmod +x deploy.sh
            ./deploy.sh
```

### 3. Add GitHub Repository Secrets
Go to your project's GitHub settings -> **Secrets and variables** -> **Actions** and add:
* `VPS_HOST`: Your VPS IP address.
* `VPS_USERNAME`: `root` (or your SSH username).
* `VPS_SSH_KEY`: The contents of your private SSH key (`id_rsa`).

---

## 6. Commands to Manage Your VPS Container Deployments

Once deployed, use these standard commands inside your VPS app folder to manage your container:

* **View logs (standard/troubleshooting)**:
  ```bash
  docker compose logs
  ```
* **View logs live (real-time stream)**:
  ```bash
  docker compose logs -f
  ```
* **Restart the containers**:
  ```bash
  docker compose restart
  ```
* **Stop the containers**:
  ```bash
  docker compose down
  ```
* **Clean up and reset (deletes container database data volumes)**:
  ```bash
  docker compose down -v
  ```
