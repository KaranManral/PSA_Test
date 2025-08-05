/*
  This API route handles sending acknowledgments (read receipts and delivery confirmations) using MIAW API.
  Uses centralized authentication from MiawApiClient.
*/

import { NextRequest, NextResponse } from "next/server";
import { MiawApiClient } from "@/app/lib/miawApiService";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messageId, acknowledgmentType } = body;

  // Validate required parameters
  if (!messageId) {
    return NextResponse.json(
      { message: "Message ID is required" },
      { status: 400 }
    );
  }

  if (!acknowledgmentType || !['Delivered', 'Read'].includes(acknowledgmentType)) {
    return NextResponse.json(
      { message: "Valid acknowledgment type (Delivered or Read) is required" },
      { status: 400 }
    );
  }

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
      { message: "Invalid session data - missing conversation ID" },
      { status: 400 }
    );
  }

  try {
    // Initialize MIAW API client (handles token management internally)
    const miawClient = new MiawApiClient();

    // Set continuation token if available for session-based operations
    if (continuationToken) {
      miawClient.setContinuationToken(continuationToken);
    }

    // Send acknowledgment using continuation token when available
    await miawClient.sendAcknowledgment(conversationId, messageId, acknowledgmentType);

    return NextResponse.json(
      { message: "success", acknowledgmentType },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error sending acknowledgment:", error);
    return NextResponse.json(
      { message: "Failed to send acknowledgment", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
