/*
  This API route handles ending MIAW chat sessions.
  It closes the conversation and revokes the access token.
  Uses centralized authentication from MiawApiClient.
*/

import { NextRequest, NextResponse } from "next/server";
import { MiawApiClient } from "@/app/lib/miawApiService";

export async function DELETE(req: NextRequest) {
  console.log("=== MIAW Session Delete Request ===");
  
  // Retrieve the MIAW chat session from cookies
  const chatSession = req.cookies.get("miawChatSession")?.value;
  
  if (!chatSession) {
    console.log("No active session found in cookies");
    return NextResponse.json(
      { message: "No active session found" },
      { status: 200 }
    );
  }

  let sessionData;
  try {
    sessionData = JSON.parse(chatSession);
    console.log("Session data parsed successfully:", { 
      conversationId: sessionData.conversationId,
      hasContinuationToken: !!sessionData.continuationToken 
    });
  } catch (error) {
    console.error("Failed to parse session data:", error);
    return NextResponse.json(
      { message: "Invalid session data" },
      { status: 400 }
    );
  }

  const { conversationId, continuationToken } = sessionData;

  if (!conversationId) {
    console.error("No conversation ID found in session data");
    return NextResponse.json(
      { message: "Invalid session data - missing conversation ID" },
      { status: 400 }
    );
  }

  console.log(`Attempting to close conversation: ${conversationId}`);

  try {
    // Initialize MIAW API client (handles token management internally)
    const miawClient = MiawApiClient.getInstance();

    // Set continuation token if available for session-based operations
    if (continuationToken) {
      miawClient.setContinuationToken(continuationToken);
      console.log("Continuation token set for conversation closure");
    }

    // Step 1: Close the ENTIRE conversation (not just session)
    console.log(`Closing entire conversation: ${conversationId}`);
    await miawClient.closeConversation(conversationId);
    console.log(`✅ Successfully closed entire conversation: ${conversationId}`);
    
    // Step 2: ONLY after successful conversation closure, clear tokens
    console.log("Clearing continuation token after successful conversation closure");
    miawClient.setContinuationToken(''); // Clear continuation token
    
    // Step 3: ONLY after successful conversation closure, delete the session cookie
    console.log("Deleting session cookie after successful conversation closure");
    const response = NextResponse.json({ 
      message: "Conversation closed successfully",
      conversationId: conversationId,
      action: "conversation_closed"
    }, { status: 200 });
    response.cookies.delete("miawChatSession");
    
    return response;

  } catch (error) {
    console.error("❌ Failed to close conversation:", error);
    
    // ❌ IMPORTANT: Do NOT clear tokens or cookies if conversation closure failed
    // This preserves the session state for potential retry
    
    let errorMessage = "Failed to close conversation";
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle specific error cases
      if (error.message.includes('404')) {
        console.log("Conversation already closed or not found");
        errorMessage = "Conversation already closed or not found";
        statusCode = 404;
        
        // For 404, we can clean up since conversation doesn't exist
        const response = NextResponse.json({
          message: "Conversation was already closed",
          conversationId: conversationId,
          action: "already_closed"
        }, { status: 200 });
        response.cookies.delete("miawChatSession");
        return response;
        
      } else if (error.message.includes('403')) {
        console.log("❌ 403 Forbidden - token may be invalid");
        errorMessage = "Authentication failed - please refresh and try again";
        statusCode = 403;
      }
    }
    
    // Return error but preserve session for retry
    return NextResponse.json({
      message: errorMessage,
      conversationId: conversationId,
      action: "close_failed",
      retryable: !(error instanceof Error && error.message?.includes('403')),
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: statusCode });
  }
}
