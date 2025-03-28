#!/bin/bash

if [ "$#" -lt 2 ] || [ "$#" -gt 3 ]; then
  echo "Usage: $0 <username> <user_id> [resume_page]"
  exit 1
fi

USERNAME="$1"
USER_ID="$2"
RESUME_PAGE="$3"
TWITTER_API_KEY=$TWITTER_API_KEY
BASE_URL="https://api.twitterapi.io/twitter/user/last_tweets"
CURSOR=""

# Create user directory with json and markdown subdirectories
mkdir -p "tweets/$USERNAME/json"
mkdir -p "tweets/$USERNAME/markdown"

if [ -n "$RESUME_PAGE" ]; then
  echo "Resuming from page $RESUME_PAGE..."
  CURSOR=$(jq -r '.next_cursor' "tweets/$USERNAME/json/$RESUME_PAGE.json")
  PAGE=$((RESUME_PAGE + 1))
else
  PAGE=1
fi

while true; do
  if [ -z "$CURSOR" ]; then
    URL="$BASE_URL?userId=$USER_ID"
  else
    URL="$BASE_URL?userId=$USER_ID&cursor=$CURSOR"
  fi

  echo "Fetching page $PAGE for user $USERNAME..."

  RESPONSE=$(curl --silent --request GET \
    --url "$URL" \
    --header "X-API-Key: $API_KEY")

  echo "$RESPONSE" > "tweets/$USERNAME/json/$PAGE.json"

  HAS_NEXT=$(echo "$RESPONSE" | jq -r '.has_next_page')
  if [ "$HAS_NEXT" != "true" ]; then
    echo "No more pages. Exiting."
    break
  fi

  CURSOR=$(echo "$RESPONSE" | jq -r '.next_cursor')
  PAGE=$((PAGE + 1))
done
