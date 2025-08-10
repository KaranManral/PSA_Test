/*
  This API route handles sending read acknowledgments using MIAW API.
  Takes conversationId from session cookie and conversationEntryId from request body.
*/

import { NextRequest, NextResponse } from "next/server";
import { MiawApiClient } from "@/app/lib/miawApiService";

export async function POST(req: NextRequest) {

    const { conversationEntryId } = await req.json();

    // Validate required parameters from request body
    if (!conversationEntryId) {
      return NextResponse.json(
        { error: "conversationEntryId is required" },
        { status: 400 }
      );
    }

    // Retrieve the MIAW chat session from cookies
    const chatSession = req.cookies.get("miawChatSession")?.value;
    
    if (!chatSession) {
      return NextResponse.json(
        { error: "No active session found" },
        { status: 400 }
      );
    }

    let sessionData;
    try {
      sessionData = JSON.parse(chatSession);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid session data" },
        { status: 400 }
      );
    }

    const { conversationId, continuationToken } = sessionData;

    if (!conversationId) {
      return NextResponse.json(
        { error: "Invalid session data - missing conversation ID" },
        { status: 400 }
      );
    }
  try {
    // Initialize MIAW API client
    const miawClient = MiawApiClient.getInstance();

    // Set continuation token if available for session-based operations
    if (continuationToken) {
      miawClient.setContinuationToken(continuationToken);
    }

    // Check if user has an active session
    if (!miawClient.hasActiveSession()) {
      return NextResponse.json(
        { error: "No active MIAW session. Please create a session first." },
        { status: 401 }
      );
    }

    // Send read acknowledgment
    await miawClient.sendAcknowledgment(conversationId, 'Read', conversationEntryId);

    return NextResponse.json({
      message: "Read acknowledgment sent successfully",
      acknowledgmentType: "Read",
      conversationId: conversationId,
      conversationEntryId: conversationEntryId
    });

  } catch (error) {
    console.error("Error sending read acknowledgment:", error);
    
    return NextResponse.json(
      { 
        error: "Failed to send read acknowledgment",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
