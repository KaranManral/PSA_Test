/*
  This API route handles Server-Sent Events (SSE) for real-time messaging with MIAW API.
  It returns events like new messages, typing indicators, read receipts, etc.
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

  const { conversationId } = sessionData;

  if (!conversationId) {
    return NextResponse.json(
      { message: "Invalid session data" },
      { status: 400 }
    );
  }

  try {
    // Initialize MIAW API client (use singleton)
    const miawClient = MiawApiClient.getInstance();

    // Subscribe to events and get the stream response
    const eventStream = await miawClient.subscribeEvents();

    // Return the event stream directly
    return eventStream;

  } catch (error) {
    console.error("Error subscribing to MIAW events:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Failed to subscribe to events"
      },
      { status: 500 }
    );
  }
}
