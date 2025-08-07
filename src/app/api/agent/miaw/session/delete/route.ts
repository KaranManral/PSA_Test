/*
  This API route handles ending MIAW chat sessions.
  It closes the conversation and revokes the access token.
  Uses centralized authentication from MiawApiClient.
*/

import { NextRequest, NextResponse } from "next/server";
import { MiawApiClient } from "@/app/lib/miawApiService";

export async function DELETE(req: NextRequest) {
  // Retrieve the MIAW chat session from cookies
  const chatSession = req.cookies.get("miawChatSession")?.value;
  
  if (!chatSession) {
    return NextResponse.json(
      { message: "No active session found" },
      { status: 200 }
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

  try {
    // Initialize MIAW API client (handles token management internally)
    const miawClient = MiawApiClient.getInstance();

    // Set continuation token if available for session-based operations
    if (continuationToken) {
      miawClient.setContinuationToken(continuationToken);
    }

    // End the conversation (this will automatically clear continuation token)
    await miawClient.closeConversation(conversationId);

    // Prepare the response and delete the session cookie
    const response = NextResponse.json({ message: "success" }, { status: 200 });
    response.cookies.delete("miawChatSession");
    
    return response;

  } catch (error) {
    console.error("Error ending MIAW session:", error);
    
    // Even if there's an error, we should clean up the cookie
    const response = NextResponse.json(
      { message: "Session ended with errors", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 200 }
    );
    response.cookies.delete("miawChatSession");
    
    return response;
  }
}
