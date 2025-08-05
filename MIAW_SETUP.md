# MIAW Configuration Setup Guide

## Step-by-Step Configuration for Messaging for In-App and Web

### Prerequisites

1. Salesforce org with Service Cloud license
2. Messaging for In-App and Web feature enabled
3. Embedded Service Deployment created

### Step 1: Configure Embedded Service Deployment

1. **Navigate to Setup**
   - Go to Setup > Service > Embedded Service Deployments

2. **Create or Find Your Deployment**
   - Look for: `Pre_Screening_Agent_With_Custom_UI`
   - Or create a new deployment of type "Custom Client"

3. **Copy Required Values**
   - **Organization ID**: Found in deployment details
   - **Developer Name**: The API name of your deployment
   - **Deployment URL**: Your Salesforce community/site URL

### Step 2: Update Environment Variables

Update your `.env.local` file with the values from configFile.json and your deployment:

```env
# From configFile.json
SF_ORG_ID=00DgL0000071swn
SF_BASE_URL=https://orgfarm-bc9c32a6ca-dev-ed.develop.my.salesforce-scrt.com

# MIAW API Configuration
MIAW_SCRT_URL=https://orgfarm-bc9c32a6ca-dev-ed.develop.my.salesforce-scrt.com
MIAW_DEVELOPER_NAME=Pre_Screening_Agent_With_Custom_UI
```

### Step 3: Configure Salesforce Deployment Settings

#### 3.1 Embedded Service Deployment Settings

1. **Basic Settings**
   - Name: Pre Screening Agent With Custom UI
   - Type: Custom Client
   - Status: Active

2. **Messaging Settings**
   - Enable Messaging for In-App and Web
   - Configure message routing rules
   - Set up pre-chat forms (optional)

3. **API Access**
   - Ensure API access is enabled
   - Configure CORS settings for your domain

#### 3.2 Pre-Chat Configuration (Optional)

If you want to collect additional information:

```javascript
// Example pre-chat fields
{
  "JobApplicationNumber": "Text",
  "Name": "Text", 
  "Email": "Email",
  "Phone": "Phone"
}
```

#### 3.3 Security Settings

1. **CORS Configuration**
   - Add your domain to allowed origins
   - Include localhost for development

2. **CSP Settings**
   - Configure Content Security Policy
   - Allow WebSocket connections for SSE

### Step 4: Test Configuration

#### 4.1 Test Environment Variables

Create a simple test script to verify configuration:

```bash
# Check if environment variables are loaded
echo $SF_ORG_ID
echo $MIAW_SCRT_URL
echo $MIAW_DEVELOPER_NAME
```

#### 4.2 Test API Connectivity

1. **Test Token Generation**
   ```bash
   curl -X POST "$MIAW_SCRT_URL/api/v2/messaging/tokens/unauthenticated" \
     -H "Content-Type: application/json" \
     -d '{
       "organizationId": "'$SF_ORG_ID'",
       "developerName": "'$MIAW_DEVELOPER_NAME'"
     }'
   ```

2. **Expected Response**
   ```json
   {
     "token": "eyJ...",
     "continuationToken": "abc123..."
   }
   ```

### Step 5: Troubleshooting Common Issues

#### Issue 1: Invalid Organization ID
**Error**: "Invalid organizationId"
**Solution**: 
- Verify SF_ORG_ID matches your Salesforce org
- Check for extra spaces or characters
- Ensure it's the 15 or 18 character Salesforce ID

#### Issue 2: Invalid Developer Name
**Error**: "Invalid developerName"
**Solution**:
- Verify MIAW_DEVELOPER_NAME matches exactly
- Check spelling and case sensitivity
- Ensure the deployment exists and is active

#### Issue 3: CORS Errors
**Error**: "CORS policy blocked"
**Solution**:
- Add your domain to Salesforce CORS settings
- Include both HTTP and HTTPS variants
- Add localhost:3000 for development

#### Issue 4: SSE Connection Failed
**Error**: "EventSource connection failed"
**Solution**:
- Check network connectivity
- Verify SSE endpoint URL
- Check browser compatibility

### Step 6: Production Deployment

#### 6.1 Environment-Specific Configuration

**Development (.env.local)**
```env
MIAW_SCRT_URL=https://orgfarm-bc9c32a6ca-dev-ed.develop.my.salesforce-scrt.com
```

**Production (.env.production)**
```env
MIAW_SCRT_URL=https://your-production-site.force.com
```

#### 6.2 Security Considerations

1. **Never commit .env files** to version control
2. **Use secure environment variable storage** in production
3. **Regularly rotate access tokens** if using authenticated mode
4. **Monitor API usage** and set appropriate limits

### Step 7: Advanced Configuration

#### 7.1 Custom Message Types

To support additional message types, update the MIAW deployment:

```javascript
// Supported message types
const messageTypes = [
  'StaticContentMessage',
  'FileMessage',
  'RichContentMessage'
];

// Supported format types
const formatTypes = [
  'Text',
  'RichText',
  'Buttons',
  'QuickReplies'
];
```

#### 7.2 Authentication Setup

For authenticated conversations:

1. **Configure User Verification**
2. **Set up JWT token validation**
3. **Update API calls to use authenticated endpoints**

```env
# Additional variables for authenticated mode
SF_CLIENT_ID=your_connected_app_client_id
SF_CLIENT_SECRET=your_connected_app_client_secret
MIAW_AUTH_MODE=authenticated
```

### Step 8: Monitoring and Analytics

#### 8.1 Enable Logging

Add comprehensive logging to track:
- Session creation/deletion
- Message sending/receiving
- SSE connection status
- Error occurrences

#### 8.2 Performance Monitoring

Monitor key metrics:
- Session duration
- Message response times
- SSE connection uptime
- Error rates

### Testing Checklist

- [ ] Environment variables loaded correctly
- [ ] Token generation works
- [ ] Conversation creation succeeds
- [ ] Messages can be sent and received
- [ ] SSE connection establishes
- [ ] Typing indicators work
- [ ] Read receipts function
- [ ] Session cleanup works
- [ ] Error handling responds appropriately
- [ ] CORS configuration allows requests

### Support Resources

1. **Salesforce Documentation**
   - [MIAW API Reference](https://developer.salesforce.com/docs/service/messaging-api)
   - [Embedded Service Setup](https://help.salesforce.com/s/articleView?id=sf.service_presence_embedded_service.htm)

2. **Sample Code**
   - [Official Sample App](https://github.com/Salesforce-Async-Messaging/messaging-web-api-sample-app)
   - [API Examples](https://developer.salesforce.com/docs/service/messaging-api/guide/get-started.html)

3. **Community**
   - Salesforce Trailblazer Community
   - Stack Overflow (tag: salesforce-service-cloud)

### Getting Help

If you encounter issues:

1. **Check logs** for detailed error messages
2. **Verify configuration** against this guide
3. **Test with sample API calls** using curl or Postman
4. **Contact Salesforce Support** for platform-specific issues
5. **Review the extracted MIAW documentation** in comprehensive_salesforce_messaging_data.json
