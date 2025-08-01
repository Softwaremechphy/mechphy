#!/bin/bash

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

# Start your Python application in a new terminal
echo "Starting Python Application..."
gnome-terminal -- bash -c "cd ~/Desktop/mechphy/7skeleton-master && source venv/bin/activate && python3 main.py replay; exec bash"

echo "All services are starting up in new terminal windows."
