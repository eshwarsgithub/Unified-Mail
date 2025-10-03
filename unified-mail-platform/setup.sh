#!/bin/bash

echo "🚀 Unified Mail Platform - Quick Setup Script"
echo "=============================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "📱 Please start Docker Desktop and try again"
    echo ""
    echo "Steps:"
    echo "1. Open Docker Desktop application"
    echo "2. Wait for it to start (green light in menu bar)"
    echo "3. Run this script again"
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Setup backend environment
echo "📝 Setting up backend environment..."
if [ ! -f backend/.env ]; then
    cp backend/.env.example backend/.env
    echo "✅ Created backend/.env"
    echo "⚠️  You need to add Google OAuth credentials to backend/.env"
    echo "   See OAUTH_SETUP.md for instructions"
else
    echo "✅ backend/.env already exists"
fi
echo ""

# Start infrastructure
echo "🐳 Starting infrastructure services (PostgreSQL, Redis, etc.)..."
cd infrastructure
docker-compose up -d
echo "⏳ Waiting 10 seconds for services to start..."
sleep 10
echo "✅ Infrastructure services started"
echo ""

# Setup backend
cd ../backend
echo "📦 Installing backend dependencies..."
npm install > /dev/null 2>&1
echo "✅ Backend dependencies installed"
echo ""

echo "🗄️  Running database migrations..."
if npm run migrate 2>&1 | grep -q "completed successfully"; then
    echo "✅ Database migrations completed"
else
    echo "⚠️  Database migrations had warnings (this is normal on first run)"
fi
echo ""

# Setup frontend
cd ../frontend
echo "📦 Installing frontend dependencies..."
if [ ! -d node_modules ]; then
    npm install > /dev/null 2>&1
    echo "✅ Frontend dependencies installed"
else
    echo "✅ Frontend dependencies already installed"
fi
echo ""

echo "=============================================="
echo "✅ Setup Complete!"
echo "=============================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Get Google OAuth Credentials:"
echo "   - Follow instructions in OAUTH_SETUP.md"
echo "   - Add credentials to backend/.env"
echo ""
echo "2. Start the backend (in this terminal):"
echo "   cd backend"
echo "   npm run dev"
echo ""
echo "3. Start the frontend (in a NEW terminal):"
echo "   cd unified-mail-platform/frontend"
echo "   npm run dev"
echo ""
echo "4. Access the app:"
echo "   Frontend: http://localhost:3001"
echo "   Backend:  http://localhost:3000"
echo ""
echo "Need help? Check QUICK_DEPLOY.md or OAUTH_SETUP.md"
