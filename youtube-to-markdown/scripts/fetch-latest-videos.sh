#!/bin/bash

# Script to fetch the latest political videos
# For use with cron to keep the database up-to-date

# Change to the project directory
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && cd .. && pwd )"
cd "$PROJECT_DIR"

# Set up log file
LOG_DIR="$PROJECT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/video-fetch-$(date +%Y%m%d-%H%M%S).log"

# Maximum number of videos to fetch per run
MAX_VIDEOS=10

echo "=== Starting video fetch at $(date) ===" | tee -a "$LOG_FILE"
echo "Working directory: $PROJECT_DIR" | tee -a "$LOG_FILE"

# Run the video processor with the latest flag and max parameter
npm run process:latest -- --max="$MAX_VIDEOS" | tee -a "$LOG_FILE"

echo "=== Completed video fetch at $(date) ===" | tee -a "$LOG_FILE" 