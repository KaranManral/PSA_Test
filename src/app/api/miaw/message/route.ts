// pages/api/miaw/message.ts (or app/api/miaw/message/route.ts for Next 13)
// Server-side handler -------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { MiawApiClient } from '@/app/lib/miawApiService';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ message: 'Invalid request body', data: [] }, { status: 400 });
  }

  const { messageId, messageType, msg, optionIdentifier, answers, inReplyToMessageId } = body;

  if (!messageId) {
    return NextResponse.json({ message: 'Error: Message ID is required', data: [] }, { status: 400 });
  }

  // Retrieve session
  const chatSession = req.cookies.get('miawChatSession')?.value;
  if (!chatSession) {
    return NextResponse.json({ message: 'Invalid Session. Start a new session.', data: [] }, { status: 400 });
  }

  let sessionData;
  try {
    sessionData = JSON.parse(chatSession);
  } catch (err) {
    return NextResponse.json({ message: 'Invalid session data. Start a new session.', data: [] }, { status: 400 });
  }

  const { conversationId, continuationToken } = sessionData;
  if (!conversationId) {
    return NextResponse.json({ message: 'Invalid session data. Start a new session.', data: [] }, { status: 400 });
  }

  // Only allow three outgoing message types: text, choice, form
  if (!['text', 'choice', 'form'].includes(messageType)) {
    return NextResponse.json({ message: 'Unsupported messageType. Allowed: text|choice|form', data: [] }, { status: 400 });
  }

  try {
    const miawClient = MiawApiClient.getInstance();
    if (continuationToken) miawClient.setContinuationToken(continuationToken);

    // Build MIAW-compatible abstract message payload based on requested type
    let messageContent: any = null;
    let miawMessageType: string = ''; // the abstractMessage.messageType

    if (messageType === 'text') {
      // Validate text length server-side (2000 char)
      if (!msg) {
        return NextResponse.json({ message: 'Error: msg is required for text messages', data: [] }, { status: 400 });
      }
      if (msg.length > 2000) {
        return NextResponse.json({ message: 'Error: Message too long', data: [] }, { status: 400 });
      }

      miawMessageType = 'StaticContentMessage';
      messageContent = {
        staticContent: {
          formatType: 'Text',
          text: msg,
        },
      };
    } else if (messageType === 'choice') {
      // optionIdentifier and inReplyToMessageId are required
      if (!optionIdentifier) {
        return NextResponse.json({ message: 'Error: optionIdentifier is required for choice messages', data: [] }, { status: 400 });
      }
      if (!inReplyToMessageId) {
        return NextResponse.json({ message: 'Error: inReplyToMessageId is required for choice messages', data: [] }, { status: 400 });
      }

      miawMessageType = 'ChoicesResponseMessage';
      messageContent = {
        inReplyToMessageId,
        choicesResponse: {
          formatType: 'Selections',
          selectedOptions: [
            {
              optionIdentifier, // canonical id for the chosen option
            },
          ],
        },
      };
    } else if (messageType === 'form') {
      // answers (array) and inReplyToMessageId required
      if (!Array.isArray(answers) || answers.length === 0) {
        return NextResponse.json({ message: 'Error: answers (non-empty array) required for form messages', data: [] }, { status: 400 });
      }
      if (!inReplyToMessageId) {
        return NextResponse.json({ message: 'Error: inReplyToMessageId is required for form messages', data: [] }, { status: 400 });
      }

      // NOTE: The exact expected shape for a form response can vary in different MIAW implementations.
      // Here we send a generic 'answers' payload. If your MIAW expects a different structure,
      // adapt the `formResponse` object below accordingly.
      miawMessageType = 'FormResponseMessage';
      messageContent = {
        inReplyToMessageId,
        formResponse: {
          formatType: 'Answers', // best-effort; change if your MIAW expects a different format
          answers: answers.map((a: any) => ({
            inputId: a.inputId ?? a.id ?? null,
            value: a.value ?? null,
          })),
        },
      };
    }

    // Send via Miaw client
    const sendResult = await miawClient.sendMessage(
      conversationId,
      messageId,
      miawMessageType,
      messageContent,
      false,
      'en_US'
    );

    // Optional: update continuation token from client if returned
    // if (sendResult?.continuationToken) { persist it into session cookie if needed }

    // Return a consistent API response
    const formattedResponse = {
      message: 'success',
      data: [
        {
          id: messageId,
          payload: body,
          type: messageType,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    return NextResponse.json(formattedResponse, { status: 200 });
  } catch (err) {
    console.error('Error in MIAW message API:', err);
    return NextResponse.json({ message: 'Failed to send message', data: [] }, { status: 500 });
  }
}
