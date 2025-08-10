// MIAW (Messaging for In-App and Web) API Service
// This service handles all interactions with the Salesforce Messaging for In-App and Web API
// Includes centralized token management and authentication
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck


import axios, { AxiosResponse } from 'axios';
import fs from "fs";
import path from "path";
import https from "https";
import { randomUUID } from 'crypto';
import { EventSource } from 'eventsource';

const ca = fs.readFileSync(path.resolve(process.cwd(), "salesforce-chain.pem"));

const httpsAgent = new https.Agent({ ca });

// Types for MIAW API

export interface MiawCapabilities {
  choiceLists?: boolean;
  fileTransfer?: {
    endUserToAgent?: boolean;
    maxFileSize?: number;
  };
  transcriptDownload?: boolean;
}

export interface ChoiceListValue {
  order: number;
  choiceListValueName: string;
  choiceListValueId: string;
  isDefaultValue: boolean;
}

// Choice list interface
export interface ChoiceList {
  choiceListId: string;
  choiceListValues: ChoiceListValue[];
}

// Form field interface
export interface FormField {
  name: string;
  order: number;
  type: string;
  required: boolean;
  maxLength: number;
  isHidden: boolean;
  choiceListId: string;
}

// Form interface
export interface Form {
  formType: string;
  displayContext: string;
  formFields: FormField[];
}

// Embedded service messaging channel interface
export interface EmbeddedServiceMessagingChannel {
  channelAddressIdentifier: string;
  authMode: string;
}

// Attachments configuration interface
export interface AttachmentsConfig {
  endUserToAgent: boolean;
  maxFileSize: number;
}

// Choice list configuration interface
export interface ChoiceListConfig {
  choiceList: ChoiceList[];
}

// Transcript configuration interface
export interface TranscriptConfig {
  allowTranscriptDownload: boolean;
}

// Embedded service configuration interface
export interface EmbeddedServiceConfig {
  name: string;
  deploymentType: string;
  embeddedServiceMessagingChannel: EmbeddedServiceMessagingChannel;
  forms: Form[];
  attachments: AttachmentsConfig;
  choiceListConfig: ChoiceListConfig;
  transcript: TranscriptConfig;
}

// Configuration interface
export interface Configuration {
  embeddedServiceConfig: EmbeddedServiceConfig;
  timestamp: number;
}

// End user interface
export interface EndUser {
  appType: string;
  role: string;
  subject: string;
  displayName: string;
}

// Context interface
export interface Context {
  deviceId: string;
  endUser: EndUser;
  configuration: Configuration;
}

// Success response interface
export interface MiawSuccessResponse {
  accessToken: string;
  lastEventId: string;
  context: {
    configuration: {
      embeddedServiceConfig: {
        name: string;
        deploymentType: string;
        embeddedServiceMessagingChannel: {
          channelAddressIdentifier: string;
          authMode: string;
        };
        forms: any[];
        attachments: {
          endUserToAgent: boolean;
          maxFileSize: number;
        };
        choiceListConfig: {
          choiceList: any[];
        };
        transcript: {
          allowTranscriptDownload: boolean;
        };
      };
      timestamp: number;
    };
    deviceId: string;
    endUser: {
      appType: string;
      role: string;
      subject: string;
    };
  };
}

// Error response interface
export interface MiawErrorResponse {
  message: string;
  errorCode: string;
}

// Union type for all possible responses
export interface ConversationList {
  conversations: MiawConversation[];
  endOfData: boolean;
  nextOffset?: string;
}

export interface ConversationEntry {
  id: string;
  conversationId: string;
  type: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface ConversationEntryList {
  entries: ConversationEntry[];
  endOfData: boolean;
  nextOffset?: string;
}

export type MiawTokenResponse = MiawSuccessResponse | MiawErrorResponse;

export interface MiawConversation {
  conversationId: string;
  status: 'Active' | 'Routing' | 'Closed';
  httpStatus?: number;
}

export interface MiawMessage {
  conversationEntries: [
    {
      id: string,
      clientTimestamp: number
    }
  ]
}

export interface MiawServerSentEvent {
  type: 
    | 'CONVERSATION_MESSAGE' 
    | 'CONVERSATION_PARTICIPANT_CHANGED'
    | 'CONVERSATION_ROUTING_RESULT' 
    | 'CONVERSATION_DELIVERY_ACKNOWLEDGEMENT'
    | 'CONVERSATION_READ_ACKNOWLEDGEMENT' 
    | 'CONVERSATION_TYPING_STARTED_INDICATOR'
    | 'CONVERSATION_TYPING_STOPPED_INDICATOR' 
    | 'CONVERSATION_CLOSE_CONVERSATION'
    | 'CONVERSATION_ERROR';
  data: {
    conversationId: string;
    timestamp: string;
    [key: string]: unknown;
  };
}

export interface MiawPreChatData {
  JobApplicationNumber?: string;
  SessionId?: string;
  [key: string]: string | undefined;
}

// Centralized MIAW API functions for use in API routes
export class MiawApiClient {
  private static instance: MiawApiClient;
  private token: string | null = null;
  private tokenExpiresAt: number | null = null;
  private baseUrl: string;
  private organizationId: string;
  private developerName: string;
  private continuationToken: string | null = null;

  constructor() {
    this.baseUrl = process.env.MIAW_SCRT_URL || '';
    this.organizationId = process.env.SF_ORG_ID || '';
    this.developerName = process.env.MIAW_DEVELOPER_NAME || '';
    
    if (!this.baseUrl || !this.organizationId || !this.developerName) {
      throw new Error('Missing required MIAW API configuration');
    }
  }

  public static getInstance(): MiawApiClient {
    if (!MiawApiClient.instance) {
      MiawApiClient.instance = new MiawApiClient();
    }
    return MiawApiClient.instance;
  }

  // Get valid MIAW token (with caching)
  private async getToken(forceRefresh: boolean = false): Promise<string> {
    const now = Date.now();
    
    // Return cached token if still valid (with 5 minute buffer)
    if (!forceRefresh && this.token && this.tokenExpiresAt && now < this.tokenExpiresAt - 300_000) {
      return this.token;
    }

    // Generate new token
    const tokenResponse = await this.generateNewToken();
    if ('accessToken' in tokenResponse) {
      this.token = tokenResponse.accessToken;
      // MIAW tokens typically don't have explicit expiry, so we set a reasonable cache time (1 hour)
      this.tokenExpiresAt = now + (60 * 60 * 1000);
      return this.token;
    }
    
    throw new Error('Failed to get valid access token');
  }

  // Generate new MIAW token
  private async generateNewToken(): Promise<MiawSuccessResponse> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/authorization/unauthenticated/access-token`;
    
    const payload = {
      orgId: this.organizationId,
      esDeveloperName: this.developerName,
      capabilitiesVersion: "1",
      platform: "Web"
    };

    try {
      const response: AxiosResponse<MiawTokenResponse> = await axios.post(endpoint, payload, {
        httpsAgent, 
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if ('errorCode' in response.data) {
        throw new Error(`MIAW API Error: ${response.data.message}`);
      }

      return response.data as MiawSuccessResponse;
    } catch (error) {
      console.error('Error generating MIAW token:', error);
      throw new Error('Failed to generate MIAW access token');
    }
  }

  // Clear cached tokens (for logout/session cleanup)
  public clearToken(): void {
    this.token = null;
    this.tokenExpiresAt = null;
    this.continuationToken = null; // Clear session token too
    console.log('All MIAW tokens cleared');
  }

  // Emergency cleanup method (only use when conversation closure fails multiple times)
  public forceCleanup(): void {
    console.warn('⚠️ Force cleanup initiated - clearing all tokens without conversation closure');
    this.clearToken();
  }

  // Get authenticated headers
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Generate continuation token for session continuity
  public async generateContinuationToken(): Promise<string> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/authorization/continuation-access-token`;

    try {
      const headers = await this.getAuthHeaders();
      const response: AxiosResponse<{ accessToken: string, lastEventId: string }> = await axios.get(endpoint, {
        httpsAgent,
        headers
      });
      
      // ✅ Auto-store the continuation token for immediate use
      this.setContinuationToken(response.data.accessToken);
      return response.data.accessToken;
    } catch (error) {
      console.error('Error generating continuation token:', error);
      throw new Error('Failed to generate continuation token');
    }
  }

  // Ensure we have a continuation token before session-scoped operations
  private async ensureContinuationToken(): Promise<void> {
    if (this.continuationToken) return;
    await this.generateContinuationToken();
    if (!this.continuationToken) {
      throw new Error('No continuation token available. Please start a session first.');
    }
  }

  // Set continuation token for subsequent requests
  public setContinuationToken(token: string): void {
    this.continuationToken = token;
  }

  // Get current continuation token
  public getContinuationToken(): string | null {
    return this.continuationToken;
  }

  // Check if user has an active session
  public hasActiveSession(): boolean {
    return !!this.continuationToken;
  }

  // Get current access token (for backwards compatibility)
  public async getCurrentToken(): Promise<string> {
    return this.getToken();
  }

  // Get auth headers with smart token selection
  private async getAuthHeadersWithContinuation(): Promise<Record<string, string>> {
    // Prefer continuation token for session operations, fallback to access token
    const token = this.continuationToken || await this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Get ONLY Authorization header (no Content-Type) with continuation fallback
  private async getAuthOnlyHeaderWithContinuation(): Promise<Record<string, string>> {
    const token = this.continuationToken || await this.getToken();
    return { 'Authorization': `Bearer ${token}` };
  }

  // Create conversation
  public async createConversation(preChatData?: MiawPreChatData): Promise<MiawConversation> {
    await this.subscribeEvents();
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation`;
    
    const conversationId = preChatData?.SessionId || randomUUID();

    const payload = {
      conversationId: conversationId,
      esDeveloperName: this.developerName,
      language: "en_US",
      routingAttributes: {
        X_Conversation_ID: conversationId,
        jobApplicationNumber: preChatData?.JobApplicationNumber,
      }
    };

    try {
      // Use access token for conversation creation (continuation token doesn't exist yet)
      const headers = await this.getAuthHeaders();
      const response: AxiosResponse<MiawConversation> = await axios.post(endpoint, payload, { httpsAgent, headers });
      
      // ✅ Auto-generate continuation token for the new session
      await this.generateContinuationToken();
      
      return {
        conversationId: conversationId,
        status: 'Active',
        httpStatus: response.status
      }
    } catch (error) {
      console.error('Error creating MIAW conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  // Send message
  public async sendMessage(
    conversationId: string, 
    messageId: string, 
    messageType: string, 
    messageContent, 
    isNewMessagingSession: boolean, 
    language: string
  ): Promise<MiawMessage> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/message`;
    
    const payload = {
      message: {
        id: messageId,
        messageType: messageType,
        ...messageContent
      },
      esDeveloperName: this.developerName,
      isNewMessagingSession: isNewMessagingSession,
      language: language
    };

    try {
      // Messages require a continuation token (no fallback to access token)
      await this.ensureContinuationToken();
      const headers = await this.getAuthHeadersWithContinuation();
      const response: AxiosResponse<MiawMessage> = await axios.post(endpoint, payload, { httpsAgent, headers });
      return response.data;
    } catch (error) {
      console.error('Error sending MIAW message:', error);
      throw new Error('Failed to send message');
    }
  }

  // Send acknowledgment (delivery or read receipt)
  public async sendAcknowledgment(conversationId: string, acknowledgmentId: string, acknowledgmentType: 'Delivery' | 'Read'): Promise<void> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/acknowledge-entries`;
    
    const payload = {
      acks: [{
        messageId: acknowledgmentId,
        entryType: acknowledgmentType,
        conversationEntryId: conversationId
      }]
    };

    try {
      await this.ensureContinuationToken();
      const headers = await this.getAuthHeadersWithContinuation();
      await axios.post(endpoint, payload, { httpsAgent, headers });
    } catch (error) {
      console.error('Error sending acknowledgment:', error);
      throw new Error('Failed to send acknowledgment');
    }
  }

  // Get SSE events stream with proper event parsing
  public async subscribeEvents(): Promise<Response> {
    await this.ensureContinuationToken();
    const headers = await this.getAuthOnlyHeaderWithContinuation();
    headers['Accept'] = 'text/event-stream';
    headers['X-Org-Id'] = this.organizationId;
    headers['Cache-Control'] = 'no-cache';
    
    const sseEndpoint = `${this.baseUrl}/eventrouter/v1/sse`;
    const data = {
      conversationId: randomUUID(),
      esDeveloperName: this.developerName
    };

    const response = await axios.get(sseEndpoint, { headers, httpsAgent, data, responseType: 'stream' });

    // Create a new ReadableStream to process and forward SSE events
    const stream = new ReadableStream({
      start(controller) {
        let buffer = '';
        
        // Handle incoming data chunks
        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          
          // Process complete SSE events (ending with \n\n)
          const events = buffer.split('\n\n');
          buffer = events.pop() || ''; // Keep incomplete event in buffer
          
          for (const eventData of events) {
            if (eventData.trim()) {
              // Parse SSE event
              const lines = eventData.split('\n');
              const event: any = {};
              
              for (const line of lines) {
                if (line.startsWith('event:')) {
                  event.type = line.substring(6).trim();
                } else if (line.startsWith('data:')) {
                  event.data = line.substring(5).trim();
                } else if (line.startsWith('id:')) {
                  event.id = line.substring(3).trim();
                }
              }
              
              // Log the parsed event
              console.log('SSE Event:', event);
              
              // Handle different event types
              if (event.type === 'ping') {
                console.log('Received ping event, connection alive');
              } else if (event.type === 'CONVERSATION_MESSAGE') {
                console.log('New message received:', event.data);
              } else if (event.type === 'CONVERSATION_ROUTING_RESULT') {
                console.log('Routing result:', event.data);
              } else if (event.type === 'CONVERSATION_PARTICIPANT_CHANGED') {
                console.log('Participant changed:', event.data);
              } else if (event.type === 'CONVERSATION_DELIVERY_ACKNOWLEDGEMENT') {
                console.log('Delivery acknowledgement:', event.data);
              } else if (event.type === 'CONVERSATION_READ_ACKNOWLEDGEMENT') {
                console.log('Read acknowledgement:', event.data);
              } else if (event.type === 'CONVERSATION_TYPING_STARTED_INDICATOR') {
                console.log('Typing started:', event.data);
              } else if (event.type === 'CONVERSATION_TYPING_STOPPED_INDICATOR') {
                console.log('Typing stopped:', event.data);
              } else if (event.type === 'CONVERSATION_CLOSE_CONVERSATION') {
                console.log('Conversation closed:', event.data);
              } else if (event.type === 'CONVERSATION_ERROR') {
                console.log('Conversation error:', event.data);
              }
              
              // Forward the event to the client
              controller.enqueue(new TextEncoder().encode(`${eventData}\n\n`));
            }
          }
        });
        
        response.data.on('end', () => {
          console.log('SSE stream ended');
          controller.close();
        });
        
        response.data.on('error', (error: Error) => {
          console.error('SSE stream error:', error);
          controller.error(error);
        });
      }
    });

    return new Response(response.data, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });
  }

  // Retrieve conversation transcript
  public async getConversationTranscript(conversationId: string) {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/transcript?esDeveloperName=${this.developerName}`;

    try {
      await this.ensureContinuationToken();
      const headers = await this.getAuthOnlyHeaderWithContinuation();
      const response: AxiosResponse<any> = await axios.get(endpoint, { httpsAgent, headers });
      return response.data;
    } catch (error) {
      console.error('Error retrieving conversation transcript:', error);
      throw new Error('Failed to retrieve conversation transcript');
    }
  }

  // Close entire conversation (not just session)
  public async closeConversation(conversationId: string): Promise<void> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}?esDeveloperName=${this.developerName}`;

    try {
      // Ensure we have a valid continuation token for this conversation
      await this.ensureContinuationToken();
      // Use ONLY Authorization header (no Content-Type), and no body
      const headers = await this.getAuthOnlyHeaderWithContinuation();
      await axios.delete(endpoint, { httpsAgent, headers });

      console.log(`Conversation ${conversationId} closed successfully`);
    } catch (error) {
      console.error('Error closing conversation:', error);
      
      // Provide more detailed error information
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
        throw new Error(`Failed to close conversation: ${error.response?.status} ${error.response?.statusText}`);
      }
      
      throw new Error('Failed to close conversation');
    }
  }

  // End session only (for session management)
  public async endSession(conversationId: string): Promise<void> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/session?esDeveloperName=${this.developerName}`;

    try {
      // Ensure we have a valid continuation token for this conversation
      await this.ensureContinuationToken();
      // Use ONLY Authorization header (no Content-Type), and no body
      const headers = await this.getAuthOnlyHeaderWithContinuation();
      await axios.delete(endpoint, { httpsAgent, headers });

      console.log(`Session for conversation ${conversationId} ended successfully`);
    } catch (error) {
      console.error('Error ending session:', error);
      
      // Provide more detailed error information
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
        console.error('Response data:', error.response?.data);
        throw new Error(`Failed to end session: ${error.response?.status} ${error.response?.statusText}`);
      }
      
      throw new Error('Failed to end session');
    }
  }
}