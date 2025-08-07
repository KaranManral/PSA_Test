/*
  This API route handles retrieving conversations and their entries using MIAW API.
  It lists all conversations and optionally fetches entries for specific conversations.
  Uses centralized authentication from MiawApiClient.
*/

import { NextRequest, NextResponse } from "next/server";
import { MiawApiClient } from "@/app/lib/miawApiService";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');
  const includeEntries = searchParams.get('includeEntries') === 'true';

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

  const { continuationToken } = sessionData;

  try {
    // Initialize MIAW API client (handles token management internally)
    const miawClient = MiawApiClient.getInstance();

    // Set continuation token if available for session-based operations
    if (continuationToken) {
      miawClient.setContinuationToken(continuationToken);
    }

    // If specific conversation ID is provided, return that conversation with entries
    if (conversationId) {
      try {
        const conversationEntries = await miawClient.listConversationEntries(conversationId);
        
        return NextResponse.json({
          message: "success",
          data: {
            conversationId: conversationId,
            entries: conversationEntries.entries || [],
            endOfData: conversationEntries.endOfData || true,
            nextOffset: conversationEntries.nextOffset || null,
            totalEntries: conversationEntries.entries?.length || 0
          }
        }, { status: 200 });
        
      } catch (error) {
        console.error(`Error fetching entries for conversation ${conversationId}:`, error);
        return NextResponse.json(
          { message: "Failed to fetch conversation entries", error: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    }

    // List all conversations
    const conversationsList = await miawClient.listConversations();

    // If includeEntries is true, fetch entries for each conversation
    if (includeEntries && conversationsList.conversations && conversationsList.conversations.length > 0) {
      const conversationsWithEntries = await Promise.allSettled(
        conversationsList.conversations.map(async (conversation) => {
          try {
            const entries = await miawClient.listConversationEntries(conversation.conversationId);
            return {
              ...conversation,
              entries: entries.entries || [],
              entryCount: entries.entries?.length || 0,
              hasMoreEntries: !entries.endOfData
            };
          } catch (error) {
            console.error(`Failed to fetch entries for conversation ${conversation.conversationId}:`, error);
            return {
              ...conversation,
              entries: [],
              entryCount: 0,
              hasMoreEntries: false,
              entriesError: error instanceof Error ? error.message : "Unknown error"
            };
          }
        })
      );

      // Extract successful results and failed results
      const successfulConversations = conversationsWithEntries
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value);

      const failedConversations = conversationsWithEntries
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason);

      if (failedConversations.length > 0) {
        console.warn(`Failed to fetch entries for ${failedConversations.length} conversations:`, failedConversations);
      }

      return NextResponse.json({
        message: "success",
        data: {
          conversations: successfulConversations,
          totalConversations: conversationsList.conversations.length,
          conversationsWithEntries: successfulConversations.length,
          failedEntryFetches: failedConversations.length,
          endOfData: conversationsList.endOfData || true,
          nextOffset: conversationsList.nextOffset || null
        }
      }, { status: 200 });
    }

    // Return conversations without entries
    return NextResponse.json({
      message: "success",
      data: {
        conversations: conversationsList.conversations || [],
        totalConversations: conversationsList.conversations?.length || 0,
        endOfData: conversationsList.endOfData || true,
        nextOffset: conversationsList.nextOffset || null
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Error in conversations API:", error);
    return NextResponse.json(
      { 
        message: "Failed to fetch conversations", 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { conversationIds, includeEntries = true } = body;

  // Validate required parameters
  if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
    return NextResponse.json(
      { message: "Array of conversation IDs is required" },
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

  const { continuationToken } = sessionData;

  try {
    // Initialize MIAW API client (handles token management internally)
    const miawClient = MiawApiClient.getInstance();

    // Set continuation token if available for session-based operations
    if (continuationToken) {
      miawClient.setContinuationToken(continuationToken);
    }

    // Fetch entries for specific conversation IDs
    const results = await Promise.allSettled(
      conversationIds.map(async (conversationId: string) => {
        try {
          if (includeEntries) {
            const entries = await miawClient.listConversationEntries(conversationId);
            return {
              conversationId,
              entries: entries.entries || [],
              entryCount: entries.entries?.length || 0,
              endOfData: entries.endOfData || true,
              nextOffset: entries.nextOffset || null
            };
          } else {
            return {
              conversationId,
              entries: [],
              entryCount: 0,
              endOfData: true,
              nextOffset: null
            };
          }
        } catch (error) {
          throw new Error(`Failed to fetch data for conversation ${conversationId}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      })
    );

    // Separate successful and failed results
    const successfulResults = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    const failedResults = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result, index) => ({
        conversationId: conversationIds[index],
        error: result.reason instanceof Error ? result.reason.message : "Unknown error"
      }));

    return NextResponse.json({
      message: "success",
      data: {
        conversations: successfulResults,
        successful: successfulResults.length,
        failed: failedResults.length,
        errors: failedResults.length > 0 ? failedResults : undefined
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Error in conversations POST API:", error);
    return NextResponse.json(
      { 
        message: "Failed to fetch conversation data", 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}
