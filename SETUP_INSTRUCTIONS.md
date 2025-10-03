# Setup Instructions - Fix Your Current Issues

## Issues You're Experiencing

1. ✅ **Frontend is running** on http://localhost:3001
2. ❌ **Docker is not running** - Need to start Docker Desktop
3. ❌ **Backend can't connect to services** - Because Docker isn't running
4. ⚠️ **Old version downloaded** - Need to pull latest code

---

## Quick Fix (5 Minutes)

### Step 1: Start Docker Desktop

1. **Open Docker Desktop app** on your Mac
2. **Wait for it to start** (you'll see a green icon in the menu bar)
3. Verify it's running: Open terminal and run:
   ```bash
   docker info
   ```
   Should show Docker info (not an error)

### Step 2: Pull Latest Code

```bash
cd ~/Desktop/Unified-Mail-main
git pull origin main
```

### Step 3: Run Setup Script

```bash
cd unified-mail-platform
chmod +x setup.sh
./setup.sh
```

This script will:
- Check if Docker is running
- Create `.env` file
- Start all infrastructure services
- Install dependencies
- Run database migrations

### Step 4: Get Google OAuth Credentials

You need these to log in with Gmail:

1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://localhost:3000/auth/gmail/callback`

**See `OAUTH_SETUP.md` for detailed step-by-step instructions.**

You'll get:
- Client ID: `123456-abc.apps.googleusercontent.com`
- Client Secret: `GOCSPX-xyz789`

### Step 5: Add OAuth to .env

Edit `backend/.env` and add:

```bash
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/gmail/callback
```

### Step 6: Start Backend

```bash
cd backend
npm run dev
```

You should see:
```
✓ Server started on port 3000
✓ Connected to database
✓ Connected to Redis
```

### Step 7: Start Frontend (already running)

If not running:
```bash
cd ../frontend
npm run dev
```

### Step 8: Test!

1. Open http://localhost:3001
2. Click "Login with Gmail"
3. Authorize with your Gmail account
4. See your emails!

---

## If You Still Get Errors

### Error: "Cannot connect to Docker daemon"
**Fix:** Docker Desktop is not running. Start it and wait for green icon.

### Error: "Failed to initialize Vault"
**Fix:** Run `./setup.sh` again - it starts all required services.

### Error: "MODULE_NOT_FOUND run.js"
**Fix:** You have old code. Run `git pull origin main` to get latest.

### Error: "Connection refused to localhost:5432"
**Fix:** PostgreSQL isn't running. Docker needs to be started.

### Error: "redirect_uri_mismatch" (OAuth)
**Fix:** Make sure redirect URI in Google Console exactly matches:
```
http://localhost:3000/auth/gmail/callback
```

---

## Manual Setup (If Script Doesn't Work)

```bash
# 1. Ensure Docker is running
docker info

# 2. Create .env
cd backend
cp .env.example .env
# Edit .env and add your Google OAuth credentials

# 3. Start infrastructure
cd ../infrastructure
docker-compose up -d

# Wait 15 seconds for services to start
sleep 15

# 4. Install backend dependencies
cd ../backend
npm install

# 5. Run migrations
npm run migrate

# 6. Start backend
npm run dev
```

In a **new terminal**:
```bash
# 7. Install frontend dependencies
cd ~/Desktop/Unified-Mail-main/unified-mail-platform/frontend
npm install

# 8. Start frontend
npm run dev
```

---

## Checking if Everything is Running

Run these commands to verify:

```bash
# Check Docker services
docker ps

# Should see:
# - PostgreSQL (port 5432)
# - Redis (port 6379)
# - Vault (port 8200)
# - MinIO (port 9000)
# - Elasticsearch (port 9200)

# Check backend
curl http://localhost:3000/health

# Should return: {"status":"ok"}

# Check frontend
curl http://localhost:3001

# Should return HTML
```

---

## What Each Service Does

- **PostgreSQL**: Stores emails, accounts, users
- **Redis**: Job queues for email syncing
- **Vault**: Stores OAuth tokens securely
- **MinIO**: Stores email attachments
- **Elasticsearch**: Powers email search
- **Backend**: API server (port 3000)
- **Frontend**: React UI (port 3001)

---

## Still Stuck?

Run these commands and share the output:

```bash
# Check Docker
docker info

# Check services
docker ps

# Check backend logs
cd backend
npm run dev

# Check frontend
cd ../frontend
npm run dev
```

Share any error messages and I'll help troubleshoot!
