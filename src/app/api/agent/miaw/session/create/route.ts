/*
  This API route creates a new MIAW chat session using Messaging for In-App and Web API.
  It handles pre-chat data collection and conversation initialization.
  Uses centralized authentication from MiawApiClient.
*/

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { MiawApiClient } from "@/app/lib/miawApiService";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const jobApplicationNumber: string = body.jobApplicationNumber ?? "";
  const termsAndConditionAgreed: boolean = body.termsAndConditionAgreed === true;

  // Validate required parameters
  if (!jobApplicationNumber) {
    return NextResponse.json(
      { message: "Job application number is required", sessionId: "" },
      { status: 400 }
    );
  }

  if (!termsAndConditionAgreed) {
    return NextResponse.json(
      { message: "Terms and conditions must be accepted", sessionId: "" },
      { status: 400 }
    );
  }

  try {
    // Initialize MIAW API client (handles token management internally)
    const miawClient = MiawApiClient.getInstance();

    // Create conversation with pre-chat data
    const preChatData = {
      JobApplicationNumber: jobApplicationNumber,
      SessionId: randomUUID()
    };

    // Create conversation (this will auto-generate continuation token)
    const conversationData = await miawClient.createConversation(preChatData);

    // Get tokens for response
    const accessToken = await miawClient.getCurrentToken();
    const continuationToken = miawClient.getContinuationToken();

    // Prepare the session object to store in a cookie
    const session = {
      status: "success",
      accessToken: accessToken,
      continuationToken: continuationToken,
      conversationId: conversationData.conversationId,
      messages: [
        {
          id: `bot-welcome-${Date.now()}`,
          message: "Hello! I'm your Adecco Pre-Screening Assistant. I'll help you with your job application screening process. How can I assist you today?",
          type: "bot",
          timestamp: new Date().toISOString()
        }
      ],
      isAuthenticated: conversationData.status === 'Active'
    };

    // Set the session cookie and return the session info
    const response = NextResponse.json(session, { status: 200 });
    response.cookies.set("miawChatSession", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return response;

  } catch (error) {
    console.error("Error creating MIAW session:", error);
    return NextResponse.json(
      { message: "Session creation failed", sessionId: "", error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
