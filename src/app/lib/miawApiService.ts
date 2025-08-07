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

const ca = fs.readFileSync(path.resolve(process.cwd(), "salesforce-chain.pem"));

const httpsAgent = new https.Agent({ ca });

// Types for MIAW API
export interface MiawErrorResponse {
  code: string;
  message: string;
  enhancedErrorType?: string;
  fields?: string[];
}

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

export interface ConversationTranscript {
  conversationId: string;
  transcript: string;
  timestamp: string;
}

export type MiawTokenResponse = MiawSuccessResponse | MiawErrorResponse;

export interface MiawConversation {
  conversationId: string;
  tenantId: string;
  orgId: string;
  participantId: string;
  status: 'Active' | 'Routing' | 'Closed';
  routingResult?: {
    routingState: string;
    routingStateReason: string;
    routingTarget?: string;
  };
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
  Name?: string;
  Email?: string;
  Phone?: string;
  JobApplicationNumber?: string;
  [key: string]: string | undefined;
}

// Centralized MIAW Token Manager
class MiawTokenManager {
  private static instance: MiawTokenManager;
  private token: string | null = null;
  private tokenExpiresAt: number | null = null;
  private baseUrl: string;
  private organizationId: string;
  private developerName: string;

  private constructor() {
    this.baseUrl = process.env.MIAW_SCRT_URL || '';
    this.organizationId = process.env.SF_ORG_ID || '';
    this.developerName = process.env.MIAW_DEVELOPER_NAME || '';
    
    if (!this.baseUrl || !this.organizationId || !this.developerName) {
      throw new Error('Missing required MIAW API configuration');
    }
  }

  public static getInstance(): MiawTokenManager {
    if (!MiawTokenManager.instance) {
      MiawTokenManager.instance = new MiawTokenManager();
    }
    return MiawTokenManager.instance;
  }

  // Get valid MIAW token (with caching)
  public async getToken(forceRefresh: boolean = false): Promise<string|undefined> {
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
        throw new Error(response.data.message);
      }

      return response.data as MiawSuccessResponse;
    } catch (error) {
      console.error('Error generating MIAW token:', error);
      throw new Error('Failed to generate MIAW access token');
    }
  }

  // Clear cached token (for logout/cleanup)
  public clearToken(): void {
    this.token = null;
    this.tokenExpiresAt = null;
  }
}

// Centralized MIAW API functions for use in API routes
export class MiawApiClient {
  private tokenManager: MiawTokenManager;
  private baseUrl: string;
  private organizationId: string;
  private developerName: string;
  private continuationToken: string | null = null;

  constructor() {
    this.tokenManager = MiawTokenManager.getInstance();
    this.baseUrl = process.env.MIAW_SCRT_URL || '';
    this.organizationId = process.env.SF_ORG_ID || '';
    this.developerName = process.env.MIAW_DEVELOPER_NAME || '';
  }

  // Get authenticated headers
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.tokenManager.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Generate continuation token for session continuity
  public async generateContinuationToken():string {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/authorization/continuation-access-token`;

    try {
      const headers = this.getAuthHeaders();
      const response: AxiosResponse<{ accessToken: string,lastEventId:string }> = await axios.get(endpoint,{
        httpsAgent,
        headers
      });
      
      return response.data.accessToken;
    } catch (error) {
      console.error('Error generating continuation token:', error);
      throw new Error('Failed to generate continuation token');
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

  // Get current access token (for backwards compatibility)
  public async getCurrentToken(): Promise<string|undefined> {
    return this.tokenManager.getToken();
  }

  // Get auth headers with continuation token
  private async getAuthHeadersWithContinuation(): Promise<Record<string, string>> {
    if (this.continuationToken) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.continuationToken}`
      };
    }
    return this.getAuthHeaders();
  }

  // Create conversation
  public async createConversation(preChatData?: MiawPreChatData): Promise<MiawConversation> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation`;

    const conversationId = randomUUID();
    
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
      const headers = await this.getAuthHeadersWithContinuation();
      const response: AxiosResponse<MiawConversation> = await axios.post(endpoint, payload, { httpsAgent, headers });
      return response.data;
    } catch (error) {
      console.error('Error creating MIAW conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  // Send message
  public async sendMessage(conversationId:string, messageId:string, messageType:string, messageContent, isNewMessagingSession:boolean, language:string): Promise<MiawMessage> {
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
      // Use continuation token if available, otherwise use access token
      const headers = await this.getAuthHeadersWithContinuation() || await this.getAuthHeaders();
      const response: AxiosResponse<MiawMessage> = await axios.post(endpoint, payload, { httpsAgent, headers });
      return response.data;
    } catch (error) {
      console.error('Error sending MIAW message:', error);
      throw new Error('Failed to send message');
    }
  }

  // Send typing indicator
  // Send typing indicator
  public async sendTypingIndicator(conversationId: string, isTyping: boolean): Promise<void> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/entry`;
    
    const payload = {
      typing: isTyping
    };

    try {
      // Use continuation token if available, otherwise use access token
      const headers = await this.getAuthHeadersWithContinuation();
      await axios.post(endpoint, payload, { httpsAgent, headers });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
      throw new Error('Failed to send typing indicator');
    }
  }

  // Send acknowledgment (delivery or read receipt)
  public async sendAcknowledgment(conversationId: string, messageId: string, acknowledgmentType: 'Delivered' | 'Read' = 'Read'): Promise<void> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/acknowledge-entries`;
    
    const payload = {
      acknowledgments: [{
        messageId: messageId,
        acknowledgmentType: acknowledgmentType
      }]
    };

    try {
      // Use continuation token if available, otherwise use access token
      const headers = await this.getAuthHeadersWithContinuation();
      await axios.post(endpoint, payload, { httpsAgent, headers });
    } catch (error) {
      console.error('Error sending acknowledgment:', error);
      throw new Error('Failed to send acknowledgment');
    }
  }

  // Get SSE events stream URL with authentication token
  public async getEventsStreamUrl(conversationId: string): Promise<string> {
    // Use continuation token if available, otherwise use access token
    const token = this.continuationToken || await this.tokenManager.getToken();
    return `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/events?access_token=${token}`;
  }

  // List all conversations
  public async listConversations(): Promise<ConversationList> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/list`;

    try {
      const headers = await this.getAuthHeadersWithContinuation();
      const response: AxiosResponse<ConversationList> = await axios.get(endpoint, { httpsAgent, headers });
      return response.data;
    } catch (error) {
      console.error('Error listing conversations:', error);
      throw new Error('Failed to list conversations');
    }
  }

  // List conversation entries
  public async listConversationEntries(conversationId: string): Promise<ConversationEntryList> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/entries`;

    try {
      const headers = await this.getAuthHeadersWithContinuation();
      const response: AxiosResponse<ConversationEntryList> = await axios.get(endpoint, { httpsAgent, headers });
      return response.data;
    } catch (error) {
      console.error('Error listing conversation entries:', error);
      throw new Error('Failed to list conversation entries');
    }
  }

  // Retrieve conversation transcript
  public async getConversationTranscript(conversationId: string): Promise<ConversationTranscript> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/transcript`;

    try {
      const headers = await this.getAuthHeadersWithContinuation();
      const response: AxiosResponse<ConversationTranscript> = await axios.get(endpoint, { httpsAgent, headers });
      return response.data;
    } catch (error) {
      console.error('Error retrieving conversation transcript:', error);
      throw new Error('Failed to retrieve conversation transcript');
    }
  }

  // Close conversation
  public async closeConversation(conversationId: string): Promise<void> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/conversation/${conversationId}/session`;

    try {
      const headers = await this.getAuthHeaders();
      await axios.delete(endpoint, { httpsAgent, headers });
    } catch (error) {
      console.error('Error closing conversation:', error);
      throw new Error('Failed to close conversation');
    }
  }
}

// Legacy class for backward compatibility (if needed)
export class MiawApiService {
  private apiClient: MiawApiClient;
  private conversationId: string | null = null;
  private eventSource: EventSource | null = null;

  constructor() {
    this.apiClient = new MiawApiClient();
  }

  // Legacy methods that delegate to the new API client
  async generateAccessToken(): Promise<string|undefined> {
    const accessToken = await this.apiClient.getCurrentToken();
    return accessToken;
      }

  async createConversation(preChatData?: MiawPreChatData): Promise<MiawConversation> {
    const conversation = await this.apiClient.createConversation(preChatData);
    this.conversationId = conversation.conversationId;
    return conversation;
  }

  async sendMessage(text: string): Promise<MiawMessage> {
    if (!this.conversationId) {
      throw new Error('No active conversation. Please start a conversation first.');
    }
    return await this.apiClient.sendMessage(
      this.conversationId,
      text,
      randomUUID(),
      '',
      false,
      { jobApplicationNumber: 'JAR-0001' },
      'en_US'
    );
  }

  async sendTypingIndicator(isTyping: boolean): Promise<void> {
    if (!this.conversationId) {
      throw new Error('No active conversation. Please start a conversation first.');
    }
    await this.apiClient.sendTypingIndicator(this.conversationId, isTyping);
  }

  async sendDeliveryAcknowledgement(messageId: string): Promise<void> {
    if (!this.conversationId) {
      throw new Error('No active conversation. Please start a conversation first.');
    }
    await this.apiClient.sendAcknowledgment(this.conversationId, messageId, 'Delivered');
  }

  async sendReadReceipt(messageId: string): Promise<void> {
    if (!this.conversationId) {
      throw new Error('No active conversation. Please start a conversation first.');
    }
    await this.apiClient.sendAcknowledgment(this.conversationId, messageId, 'Read');
  }

  async closeConversation(): Promise<void> {
    if (!this.conversationId) {
      throw new Error('No active conversation. Please start a conversation first.');
    }
    
    await this.apiClient.closeConversation(this.conversationId);
    this.conversationId = null;
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  // Getters
  get isAuthenticated(): boolean {
    return true; // Will be true if token manager can get a token
  }

  get hasActiveConversation(): boolean {
    return !!this.conversationId;
  }

  get currentConversationId(): string | null {
    return this.conversationId;
  }

  // Cleanup method
  cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.conversationId = null;
  }
}

export default MiawApiService;