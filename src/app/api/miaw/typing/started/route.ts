import { NextRequest, NextResponse } from "next/server";
import { MiawApiClient } from "@/app/lib/miawApiService";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {

  // Retrieve the MIAW chat session from cookies
  const chatSession = req.cookies.get("miawChatSession")?.value;
  if (!chatSession) {
    return NextResponse.json(
      { message: "Invalid Session. Start a new session." },
      { status: 400 }
    );
  }

  let sessionData;
  try {
    sessionData = JSON.parse(chatSession);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { message: "Invalid session data. Start a new session." },
      { status: 400 }
    );
  }

  const { conversationId, continuationToken } = sessionData;

  if (!conversationId) {
    return NextResponse.json(
      { message: "Invalid session data. Start a new session." },
      { status: 400 }
    );
  }

  try {
    // Get MIAW API client instance
    const miawClient = MiawApiClient.getInstance();

    // Check if user has an active session
    if (!miawClient.hasActiveSession()) {
      return NextResponse.json(
        { error: "No active MIAW session. Please create a session first." },
        { status: 401 }
      );
    }

    // Generate a unique typing indicator ID
    const typingId = randomUUID();

    // Send typing started indicator
    await miawClient.sendTypingIndicator(
      conversationId,
      "TypingStartedIndicator",
      typingId
    );

    return NextResponse.json({
      message: "Typing indicator started successfully",
      typingId: typingId,
      conversationId: conversationId
    });

  } catch (error) {
    console.error("Error starting typing indicator:", error);

    return NextResponse.json(
      {
        error: "Failed to start typing indicator",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
