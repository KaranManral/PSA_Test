/*
  This API route handles fetching events for real-time messaging with MIAW API.
  It returns events like new messages, typing indicators, read receipts, etc.
*/

import { NextRequest, NextResponse } from "next/server";
import { MiawApiClient } from "@/app/lib/miawApiService";
import { Transform, TransformCallback } from 'stream';

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
    // Initialize MIAW API client
    const miawClient = new MiawApiClient();

    // Subscribe to events
    const eventStream = await miawClient.subscribeEvents(conversationId);

    return new NextResponse(eventStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }});

    // // Create a transform stream to handle SSE data
    // const parser = new Transform({
    //   transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    //     const data = chunk.toString();
    //     if (data.startsWith('event: CONVERSATION_MESSAGE')) {
    //       const eventData = data.split('\ndata: ')[1];
    //       try {
    //         const parsedData = JSON.parse(eventData);
    //         const sender = parsedData.conversationEntry.sender.role.toLowerCase();
    //         if (sender === 'chatbot') {
    //           const payload = JSON.parse(parsedData.conversationEntry.entryPayload);
    //           const message = JSON.stringify({
    //             type: 'CONVERSATION_MESSAGE',
    //             data: {
    //               messageId: parsedData.conversationEntry.id,
    //               conversationId: parsedData.conversationEntry.conversationId,
    //               messageContent: payload.abstractMessage.staticContent.text,
    //               sender: parsedData.conversationEntry.sender,
    //               timestamp: parsedData.conversationEntry.timestamp
    //             }
    //           });
    //           this.push(message + '\n\n');
    //         }
    //       } catch (err: unknown) {
    //         console.error('Message parse error:', err instanceof Error ? err.message : 'Unknown error');
    //       }
    //     }
    //     callback();
    //   }
    // });

    // // Create readable web stream from node stream
    // const readableStream = new ReadableStream({
    //   start(controller) {
    //     // Pipe event stream through parser
    //     eventStream.pipe(parser);

    //     // Handle the parsed data
    //     parser.on('data', (chunk: Buffer) => {
    //       controller.enqueue(chunk);
    //     });

    //     // Handle errors
    //     eventStream.on('error', (error: Error) => {
    //       console.error('Event stream error:', error);
    //       controller.error(error);
    //       parser.end();
    //     });

    //     parser.on('error', (error: Error) => {
    //       console.error('Parser error:', error);
    //       controller.error(error);
    //     });

    //     // Handle end of stream
    //     parser.on('end', () => {
    //       controller.close();
    //     });
    //   },
    //   cancel() {
    //     // Clean up
    //     if (eventStream.destroy) eventStream.destroy();
    //     parser.end();
    //   }
    // });

    // // Return the readable stream as the response
    // return new NextResponse(readableStream, {
    //   headers: {
    //     'Content-Type': 'text/event-stream',
    //     'Cache-Control': 'no-cache',
    //     'Connection': 'keep-alive'
    //   }
    // });
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
