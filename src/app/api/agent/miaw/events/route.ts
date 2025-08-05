/*
  This API route handles Server-Sent Events (SSE) for real-time messaging with MIAW API.
  It streams events like new messages, typing indicators, read receipts, etc.
  Uses centralized authentication from MiawApiClient.
*/

import { NextRequest, NextResponse } from "next/server";
import { MiawApiClient } from "@/app/lib/miawApiService";

export async function GET(req: NextRequest) {
  // Retrieve the MIAW chat session from cookies
  const chatSession = req.cookies.get("miawChatSession")?.value;
  
  if (!chatSession) {
    return NextResponse.json(
      { message: "No active session found" },
      { status: 400 }
    );
  }

  let sessionData;
  try {
    sessionData = JSON.parse(chatSession);
  } catch (error) {
    return NextResponse.json(
      { message: "Invalid session data" },
      { status: 400 }
    );
  }

  const { conversationId, continuationToken } = sessionData;

  if (!conversationId) {
    return NextResponse.json(
      { message: "Invalid session data" },
      { status: 400 }
    );
  }

  // Set up SSE response headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Create a TransformStream to handle the SSE connection
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  let eventSource: EventSource | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  try {
    // Initialize MIAW API client (handles token management internally)
    const miawClient = new MiawApiClient();

    // Set continuation token if available for session-based operations
    if (continuationToken) {
      miawClient.setContinuationToken(continuationToken);
    }
    
    // Get SSE endpoint URL with appropriate token
    const sseEndpoint = await miawClient.getEventsStreamUrl(conversationId);

    // Import EventSource for server-side use
    const { EventSource } = await import('eventsource');
    
    eventSource = new EventSource(sseEndpoint);

    if (eventSource) {
      // Handle incoming SSE events from MIAW
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Forward the event to the client
          const sseMessage = `data: ${JSON.stringify({
            type: 'MIAW_EVENT',
            eventType: data.type || 'UNKNOWN',
            data: data,
            timestamp: new Date().toISOString()
          })}\n\n`;

          writer.write(new TextEncoder().encode(sseMessage));
        } catch (error) {
          console.error('Error processing SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('MIAW SSE connection error:', error);
        
        const errorMessage = `data: ${JSON.stringify({
          type: 'ERROR',
          message: 'Connection error',
          timestamp: new Date().toISOString()
        })}\n\n`;

        writer.write(new TextEncoder().encode(errorMessage));
      };
    }

    // Send initial connection message
    const initialMessage = `data: ${JSON.stringify({
      type: 'CONNECTION_ESTABLISHED',
      message: 'Connected to MIAW real-time events',
      timestamp: new Date().toISOString()
    })}\n\n`;

    writer.write(new TextEncoder().encode(initialMessage));

    // Set up heartbeat to keep connection alive
    heartbeatInterval = setInterval(() => {
      const heartbeat = `data: ${JSON.stringify({
        type: 'HEARTBEAT',
        timestamp: new Date().toISOString()
      })}\n\n`;

      try {
        writer.write(new TextEncoder().encode(heartbeat));
      } catch (error) {
        console.error('Error sending heartbeat:', error);
        // Connection likely closed, clean up
        if (eventSource) {
          eventSource.close();
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
        }
      }
    }, 30000); // Send heartbeat every 30 seconds

  } catch (error) {
    console.error('Error setting up MIAW SSE connection:', error);
    
    const errorMessage = `data: ${JSON.stringify({
      type: 'SETUP_ERROR',
      message: 'Failed to establish connection',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })}\n\n`;

    writer.write(new TextEncoder().encode(errorMessage));
    writer.close();
  }

  // Handle client disconnect
  req.signal.addEventListener('abort', () => {
    console.log('Client disconnected from SSE');
    
    if (eventSource) {
      eventSource.close();
    }
    
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    
    writer.close();
  });

  return new NextResponse(stream.readable, {
    headers
  });
}
