#!/bin/bash

# MIAW Configuration Validation Script
# This script helps validate your MIAW API configuration before starting the application

echo "🔍 MIAW Configuration Validation"
echo "================================"

# Check if .env.local file exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local file not found!"
    echo "📝 Please create .env.local file with the required environment variables."
    echo "📖 See MIAW_SETUP.md for detailed instructions."
    exit 1
fi

echo "✅ .env.local file found"

# Load environment variables
source .env.local

# Validate required environment variables
echo ""
echo "🔧 Checking Environment Variables:"
echo "-----------------------------------"

# Required variables
required_vars=("SF_ORG_ID" "MIAW_SCRT_URL" "MIAW_DEVELOPER_NAME")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ $var: Not set"
        missing_vars+=($var)
    else
        echo "✅ $var: ${!var}"
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo ""
    echo "❌ Missing required environment variables: ${missing_vars[*]}"
    echo "📖 Please check MIAW_SETUP.md for configuration details."
    exit 1
fi

# Test API connectivity
echo ""
echo "🌐 Testing API Connectivity:"
echo "-----------------------------"

# Test token generation
echo "Testing token generation..."
response=$(curl -s -X POST "$MIAW_SCRT_URL/api/v2/messaging/tokens/unauthenticated" \
    -H "Content-Type: application/json" \
    -d "{
        \"organizationId\": \"$SF_ORG_ID\",
        \"developerName\": \"$MIAW_DEVELOPER_NAME\"
    }" \
    -w "HTTP_STATUS:%{http_code}")

# Extract HTTP status
http_status=$(echo "$response" | sed -n 's/.*HTTP_STATUS:\([0-9]*\)$/\1/p')
response_body=$(echo "$response" | sed 's/HTTP_STATUS:[0-9]*$//')

if [ "$http_status" = "200" ]; then
    echo "✅ Token generation successful"
    
    # Try to extract token from response
    if echo "$response_body" | grep -q "token"; then
        echo "✅ Valid token received"
    else
        echo "⚠️  Token generation returned 200 but no token found in response"
        echo "   Response: $response_body"
    fi
else
    echo "❌ Token generation failed (HTTP $http_status)"
    echo "   Response: $response_body"
    echo ""
    echo "🔧 Common fixes:"
    echo "   - Verify SF_ORG_ID is correct"
    echo "   - Check MIAW_DEVELOPER_NAME spelling"
    echo "   - Ensure MIAW_SCRT_URL is accessible"
    echo "   - Verify Embedded Service Deployment is active"
fi

echo ""
echo "🚀 Starting Application:"
echo "------------------------"

if [ ${#missing_vars[@]} -eq 0 ] && [ "$http_status" = "200" ]; then
    echo "✅ Configuration validated successfully!"
    echo "🚀 Starting development server..."
    npm run dev
else
    echo "❌ Configuration validation failed!"
    echo "📖 Please check the errors above and refer to MIAW_SETUP.md"
    exit 1
fi
