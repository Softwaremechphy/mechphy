#!/bin/bash

# Function to check Node.js version
check_node_version() {
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_VERSION="18.17.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then 
        echo "✓ Node.js version $NODE_VERSION is compatible"
        return 0
    else
        echo "✗ Node.js version $NODE_VERSION is too old. Required: $REQUIRED_VERSION+"
        return 1
    fi
}

# Start MongoDB (if not already running)
echo "Starting MongoDB..."
sudo systemctl start mongod

# Start Zookeeper in a new terminal
echo "Starting Zookeeper..."
gnome-terminal -- bash -c "cd /usr/local/kafka && ./bin/zookeeper-server-start.sh config/zookeeper.properties; exec bash"

# Wait a few seconds for Zookeeper to initialize
sleep 5

# Start Kafka in a new terminal
echo "Starting Kafka..."
gnome-terminal -- bash -c "cd /usr/local/kafka && ./bin/kafka-server-start.sh config/server.properties; exec bash"

# Wait a few seconds for Kafka to initialize
sleep 5

# Start your Next.js application with proper Node.js version handling
echo "Starting Next.js Application..."
gnome-terminal -- bash -c "
echo 'Setting up Next.js environment...'
cd ~/Desktop/SCI-FI-SIMULATOR
# Load NVM if available
export NVM_DIR=\"\$HOME/.nvm\"
[ -s \"\$NVM_DIR/nvm.sh\" ] && \. \"\$NVM_DIR/nvm.sh\"
[ -s \"\$NVM_DIR/bash_completion\" ] && \. \"\$NVM_DIR/bash_completion\"

# Try to use Node 18+ if NVM is available
if command -v nvm >/dev/null 2>&1; then
    echo 'Using NVM to set Node version...'
    nvm use 18 2>/dev/null || nvm use --lts 2>/dev/null || echo 'Using system Node.js'
fi

# Check Node.js version
echo \"Node.js version: \$(node --version)\"
echo \"NPM version: \$(npm --version)\"

# Verify Node.js version compatibility
NODE_VERSION=\$(node --version | cut -d'v' -f2)
REQUIRED_VERSION='18.17.0'

if [ \"\$(printf '%s\n' \"\$REQUIRED_VERSION\" \"\$NODE_VERSION\" | sort -V | head -n1)\" = \"\$REQUIRED_VERSION\" ]; then 
    echo '✓ Node.js version is compatible'
    
    # Clear any potential cache issues
    rm -rf .next
    rm -rf node_modules/.cache
    
    # Install dependencies if node_modules doesn't exist or package.json is newer
    if [ ! -d 'node_modules' ] || [ 'package.json' -nt 'node_modules' ]; then
        echo 'Installing/updating dependencies...'
        npm install
    fi
    
    # Start the development server
    echo 'Starting Next.js development server...'
    npm run dev
else
    echo '✗ Node.js version is incompatible. Please upgrade to Node.js 18.17+'
    echo 'Current version:' \$NODE_VERSION
    echo 'Required version: 18.17.0+'
    echo ''
    echo 'To upgrade Node.js:'
    echo '1. Using NVM (recommended):'
    echo '   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash'
    echo '   source ~/.bashrc'
    echo '   nvm install --lts'
    echo '   nvm use --lts'
    echo ''
    echo '2. Using NodeSource repository:'
    echo '   curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -'
    echo '   sudo apt-get install -y nodejs'
fi

exec bash"

# Start your Python application in a new terminal
echo "Starting Python Application..."
gnome-terminal -- bash -c "cd ~/Desktop/mechphy/7skeleton-master && source venv/bin/activate && python3 main.py replay; exec bash"

echo "All services are starting up in new terminal windows."