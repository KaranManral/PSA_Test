/*
  This API route handles sending messages using the MIAW (Messaging for In-App and Web) API.
  Uses centralized authentication from MiawApiClient.
*/

import { NextRequest, NextResponse } from "next/server";
import { MiawApiClient } from "@/app/lib/miawApiService";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messageId, msg } = body;

  // Validate message length (2000 character limit)
  if (!messageId) {
    return NextResponse.json(
      { message: "Error: Message ID is required", data: [] },
      { status: 400 }
    );
  }
  
  // Validate message length (2000 character limit)
  if (msg && msg.length > 2000) {
    return NextResponse.json(
      { message: "Error: Message too long", data: [] },
      { status: 400 }
    );
  }

  // Retrieve the MIAW chat session from cookies
  const chatSession = req.cookies.get("miawChatSession")?.value;
  
  if (!chatSession) {
    return NextResponse.json(
      { message: "Invalid Session. Start a new session.", data: [] },
      { status: 400 }
    );
  }

  let sessionData;
  try {
    sessionData = JSON.parse(chatSession);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { message: "Invalid session data. Start a new session.", data: [] },
      { status: 400 }
    );
  }

  const { conversationId, continuationToken } = sessionData;

  if (!conversationId) {
    return NextResponse.json(
      { message: "Invalid session data. Start a new session.", data: [] },
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

    // Send the actual message
    if (msg) {
      const messageContent = {
        staticContent: {
          formatType: "Text",
          text: msg
        }
      };

      const messageData = await miawClient.sendMessage(
        conversationId,
        messageId,
        'StaticContentMessage', // messageType
        messageContent,
        false, // isNewMessagingSession
        'en_US' // language
      );

      // Format response to match existing interface
      const formattedResponse = {
        message: "success",
        data: [
          {
            id: messageId,
            message: msg,
            type: "user",
            timestamp: new Date().toISOString()
          }
        ]
      };

      return NextResponse.json(formattedResponse, { status: 200 });
    }

    return NextResponse.json({ message: "success", data: [] }, { status: 200 });

  } catch (error) {
    console.error("Error in MIAW message API:", error);
    return NextResponse.json(
      { message: "Failed to send message", data: [] },
      { status: 500 }
    );
  }
}
