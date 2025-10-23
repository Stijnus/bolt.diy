#!/bin/bash

# Test DeepSeek API Latency and Streaming Performance
# Usage: ./test-deepseek-latency.sh YOUR_DEEPSEEK_API_KEY

API_KEY="${1:-}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: Please provide your DeepSeek API key"
  echo "Usage: ./test-deepseek-latency.sh YOUR_DEEPSEEK_API_KEY"
  exit 1
fi

echo "🔍 Testing DeepSeek API Performance..."
echo "========================================"
echo ""

# Test 1: Simple API ping
echo "📡 Test 1: API Latency (models endpoint)"
echo "Expected: < 200ms for good performance"
echo ""
time curl -s -X GET "https://api.deepseek.com/v1/models" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  > /dev/null

echo ""
echo "========================================"
echo ""

# Test 2: Simple completion
echo "⚡ Test 2: Simple Completion (Time to First Token)"
echo "Expected: < 2 seconds for good streaming"
echo ""

# Create a timestamp before request
START_TIME=$(date +%s%N)

# Make a streaming request
curl -s -X POST "https://api.deepseek.com/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Say hello"}],
    "stream": true
  }' | while IFS= read -r line; do
  
  # Calculate time to first token
  if [ -z "$FIRST_TOKEN_TIME" ]; then
    END_TIME=$(date +%s%N)
    ELAPSED=$(( (END_TIME - START_TIME) / 1000000 ))
    echo "⏱️  Time to First Token: ${ELAPSED}ms"
    FIRST_TOKEN_TIME="$END_TIME"
    export FIRST_TOKEN_TIME
  fi
  
  # Print the line
  if [[ "$line" == data:* ]]; then
    echo "$line" | head -n 3
  fi
done

echo ""
echo "========================================"
echo ""

# Test 3: Larger completion to measure tokens/second
echo "📊 Test 3: Streaming Performance Test"
echo "Requesting 200 tokens to measure speed..."
echo ""

START_TIME=$(date +%s)

RESPONSE=$(curl -s -X POST "https://api.deepseek.com/v1/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Write a short paragraph about coding (50 words)"}],
    "stream": false,
    "max_tokens": 200
  }')

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

# Try to extract token count from response
TOKEN_COUNT=$(echo "$RESPONSE" | grep -o '"total_tokens":[0-9]*' | grep -o '[0-9]*' | head -1)

if [ -n "$TOKEN_COUNT" ] && [ "$ELAPSED" -gt 0 ]; then
  TOKENS_PER_SEC=$((TOKEN_COUNT / ELAPSED))
  echo "✅ Completed in ${ELAPSED} seconds"
  echo "📈 Tokens: $TOKEN_COUNT"
  echo "⚡ Speed: ~${TOKENS_PER_SEC} tokens/second"
  
  if [ "$TOKENS_PER_SEC" -gt 20 ]; then
    echo "🎉 Status: GOOD - Streaming should feel fast"
  elif [ "$TOKENS_PER_SEC" -gt 10 ]; then
    echo "⚠️  Status: MODERATE - May feel slightly slow"
  else
    echo "🐌 Status: SLOW - High latency detected"
  fi
else
  echo "⚠️  Could not measure performance"
  echo "Response preview:"
  echo "$RESPONSE" | head -20
fi

echo ""
echo "========================================"
echo ""
echo "💡 Interpretation:"
echo ""
echo "API Latency:"
echo "  - < 100ms  = Excellent"
echo "  - 100-200ms = Good"
echo "  - 200-500ms = Moderate (international users)"
echo "  - > 500ms  = Poor (may need proxy)"
echo ""
echo "Tokens/Second:"
echo "  - > 30 = Excellent"
echo "  - 20-30 = Good"
echo "  - 10-20 = Moderate (slow streaming)"
echo "  - < 10 = Poor (very slow)"
echo ""
