#!/bin/bash

echo "Shutting down all services..."

# 1. Stop Kafka Server (uses Kafka's own shutdown script)
echo "Stopping Kafka..."
/usr/local/kafka/bin/kafka-server-stop.sh
sleep 3 # Give Kafka a moment to shut down gracefully

# 2. Stop Zookeeper Server
echo "Stopping Zookeeper..."
/usr/local/kafka/bin/zookeeper-server-stop.sh
sleep 3 # Give Zookeeper a moment as well

# 3. Stop the Python Application (if it's still running)
# Using 'pkill' finds and stops the process based on its command name
echo "Stopping Python application..."
pkill -f "main.py replay"

# 4. Stop MongoDB
echo "Stopping MongoDB..."
sudo systemctl stop mongod

echo ""
echo "Shutdown sequence complete."
echo "This window will close in 5 seconds..."
sleep 5
