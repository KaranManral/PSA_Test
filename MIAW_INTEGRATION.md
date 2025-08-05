# MIAW API Integration Guide

This document explains the implementation of Messaging for In-App and Web (MIAW) API in the Pre-Screening Agent application.

## Overview

The application has been updated to use Salesforce's MIAW API instead of the Einstein Agent API. This provides enhanced messaging capabilities including:

- Real-time messaging with Server-Sent Events (SSE)
- Typing indicators
- Read receipts and delivery confirmations
- Better session management
- Unauthenticated messaging support

## Environment Configuration

### Required Environment Variables

Create or update your `.env.local` file with the following variables:

```env
# Salesforce Configuration for MIAW API
SF_ORG_ID=00DgL0000071swn
SF_BASE_URL=https://orgfarm-bc9c32a6ca-dev-ed.develop.my.salesforce-scrt.com
MIAW_SCRT_URL=https://orgfarm-bc9c32a6ca-dev-ed.develop.my.salesforce-scrt.com
MIAW_DEVELOPER_NAME=Pre_Screening_Agent_With_Custom_UI

# Optional: Legacy Einstein API Configuration (for fallback)
SF_DOMAIN=https://orgfarm-bc9c32a6ca-dev-ed.develop.my.salesforce-scrt.com
SF_API_HOST=https://orgfarm-bc9c32a6ca-dev-ed.develop.my.salesforce-scrt.com
SF_AGENT_ID=
Get_All_Details_From_Application_Number_FLOW_NAME=
```

### Getting Required Values

1. **SF_ORG_ID**: Your Salesforce Organization ID (from configFile.json)
2. **MIAW_SCRT_URL**: Your Salesforce Community/Experience site URL
3. **MIAW_DEVELOPER_NAME**: Your Embedded Service Deployment developer name

To find these values:
1. Go to Setup > Embedded Service Deployments
2. Find your deployment for Messaging for In-App and Web
3. Copy the Organization ID and Developer Name
4. Use your Salesforce site URL for MIAW_SCRT_URL

## API Endpoints

### Session Management

#### Create Session
- **URL**: `/api/agent/miaw/session/create`
- **Method**: POST
- **Purpose**: Creates a new MIAW conversation session

#### Delete Session
- **URL**: `/api/agent/miaw/session/delete`
- **Method**: DELETE
- **Purpose**: Closes the conversation and revokes tokens

### Messaging

#### Send Message
- **URL**: `/api/agent/miaw/message`
- **Method**: POST
- **Purpose**: Sends messages and typing indicators

#### Send Acknowledgments
- **URL**: `/api/agent/miaw/acknowledgment`
- **Method**: POST
- **Purpose**: Sends read receipts and delivery confirmations

#### Real-time Events
- **URL**: `/api/agent/miaw/events`
- **Method**: GET (Server-Sent Events)
- **Purpose**: Receives real-time updates from MIAW

## Features Implemented

### 1. Real-time Messaging
- Server-Sent Events for instant message delivery
- Automatic reconnection on connection loss
- Connection status indicator

### 2. Typing Indicators
- Shows when user is typing to the agent
- Displays when agent is typing to the user
- Debounced to prevent excessive API calls

### 3. Read Receipts & Delivery Confirmations
- Automatic delivery confirmations for received messages
- Read receipts sent when messages are viewed
- Visual indicators for message status (Sent/Delivered/Read)

### 4. Session Management
- Secure token-based authentication
- Automatic session cleanup
- Cookie-based session persistence

### 5. Error Handling
- Graceful error handling with user-friendly messages
- Automatic retry for failed connections
- Fallback mechanisms for network issues

## Component Architecture

### Agent Component (Agent.tsx)
The main chat interface component with the following key features:

- **State Management**: Handles messages, session state, and UI flags
- **Real-time Updates**: Manages SSE connections and event handling
- **Message Handling**: Processes incoming/outgoing messages
- **UI Features**: Typing indicators, read receipts, connection status

### MIAW API Service (miawApiService.ts)
A comprehensive service class for MIAW API interactions:

- **Authentication**: Token generation and management
- **Messaging**: Send messages, typing indicators, acknowledgments
- **Session Management**: Create, manage, and close conversations
- **Real-time Events**: SSE setup and event handling

## MIAW API Endpoints Used

### Authentication
- `POST /api/v2/messaging/tokens/unauthenticated` - Generate access token

### Conversation Management
- `POST /api/v2/messaging/conversations` - Create conversation
- `DELETE /api/v2/messaging/conversations/{id}` - Close conversation
- `GET /api/v2/messaging/conversations/{id}/events` - SSE events

### Messaging
- `POST /api/v2/messaging/conversations/{id}/messages` - Send message
- `POST /api/v2/messaging/conversations/{id}/typing` - Typing indicator
- `POST /api/v2/messaging/conversations/{id}/acknowledgments` - Send acknowledgments

### Token Management
- `DELETE /api/v2/messaging/tokens` - Revoke token

## Supported MIAW Features

Based on the extracted documentation, the following features are supported:

### Server-Sent Events
- CONVERSATION_MESSAGE
- CONVERSATION_PARTICIPANT_CHANGED
- CONVERSATION_ROUTING_RESULT
- CONVERSATION_DELIVERY_ACKNOWLEDGEMENT
- CONVERSATION_READ_ACKNOWLEDGEMENT
- CONVERSATION_TYPING_STARTED_INDICATOR
- CONVERSATION_TYPING_STOPPED_INDICATOR
- CONVERSATION_CLOSE_CONVERSATION

### Message Types
- StaticContentMessage with Text format

### Authentication
- Unauthenticated conversations (User Verification not implemented)

### Pre-Chat Support
- UI support for form fields
- 'Every Conversation' and 'Every Session' display frequency

### Session Continuity
- Same browser tab session continuity
- Page reload continues conversation
- Limited cross-tab support

## Migration from Einstein Agent API

### Key Changes

1. **API Endpoints**: All API calls now use MIAW endpoints instead of Einstein Agent API
2. **Authentication**: Uses MIAW token-based authentication
3. **Real-time Updates**: Implements SSE instead of polling
4. **Message Format**: Uses MIAW message structure
5. **Session Management**: Uses MIAW conversation management

### Preserved Features

1. **UI Design**: Exact same visual design and layout
2. **User Experience**: Same interaction patterns
3. **Functionality**: All original features maintained
4. **Error Handling**: Enhanced error handling

## Testing

### Basic Testing Checklist

1. **Session Creation**
   - [ ] Terms acceptance required
   - [ ] Session starts successfully
   - [ ] Welcome message appears

2. **Messaging**
   - [ ] Send user messages
   - [ ] Receive bot responses
   - [ ] Message length validation

3. **Real-time Features**
   - [ ] Typing indicators work
   - [ ] Read receipts appear
   - [ ] Connection status updates

4. **Session Management**
   - [ ] End conversation works
   - [ ] Session cleanup occurs
   - [ ] Cookies are cleared

## Troubleshooting

### Common Issues

1. **Environment Variables**
   - Ensure all required variables are set
   - Verify URLs don't have trailing slashes
   - Check Organization ID format

2. **CORS Issues**
   - Ensure your Salesforce site allows CORS
   - Check domain whitelisting

3. **Connection Issues**
   - Verify MIAW_SCRT_URL is accessible
   - Check network connectivity
   - Monitor browser console for errors

4. **SSE Connection**
   - Check if EventSource is supported
   - Monitor network tab for SSE connection
   - Verify server-side SSE implementation

### Debugging

1. **Browser Console**: Check for JavaScript errors
2. **Network Tab**: Monitor API calls and SSE connection
3. **Application Tab**: Check cookies and local storage
4. **Server Logs**: Monitor API endpoint logs

## Security Considerations

1. **Token Management**: Tokens are stored securely in HTTP-only cookies
2. **Session Timeout**: Sessions have defined timeouts
3. **Input Validation**: All user inputs are validated
4. **Error Information**: Sensitive error details are not exposed to users

## Performance Optimizations

1. **Typing Debouncing**: Reduces API calls for typing indicators
2. **Message Batching**: Efficient message handling
3. **Connection Reuse**: SSE connection reused for all real-time updates
4. **Automatic Cleanup**: Resources are properly cleaned up

## Future Enhancements

### Potential Improvements

1. **File Upload Support**: Implement file message types
2. **Rich Message Types**: Support for more message formats
3. **Multi-tab Support**: Enhanced session continuity
4. **User Authentication**: Implement authenticated conversations
5. **Push Notifications**: Add push notification support
6. **Message History**: Persist conversation history

### MIAW Features to Implement

1. **Hidden Pre-Chat**: Support for hidden pre-chat fields
2. **Cross-tab Continuity**: Session sharing across tabs
3. **Additional Message Types**: Support for rich content
4. **User Verification**: Authenticated user support

## Documentation References

- [MIAW API Documentation](https://developer.salesforce.com/docs/service/messaging-api)
- [Server-Sent Events](https://developer.salesforce.com/docs/service/messaging-api/references/about/server-sent-events-structure.html)
- [Message Types](https://developer.salesforce.com/docs/service/messaging-api/references/about/message-types-format-types.html)
- [Sample Application](https://github.com/Salesforce-Async-Messaging/messaging-web-api-sample-app)
