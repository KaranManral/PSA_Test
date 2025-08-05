// MIAW (Messaging for In-App and Web) API Service
// This service handles all interactions with the Salesforce Messaging for In-App and Web API
// Includes centralized token management and authentication

import axios, { AxiosResponse } from 'axios';
import https from 'https';

// Types for MIAW API
export interface MiawTokenResponse {
  token: string;
  userVerificationToken?: string;
  continuationToken?: string;
}

export interface MiawConversation {
  conversationId: string;
  isAuthenticated: boolean;
  status: 'active' | 'routing' | 'closed';
}

export interface MiawMessage {
  id: string;
  type: 'StaticContentMessage' | 'FileMessage';
  text: string;
  timestamp: string;
  sender: {
    role: 'EndUser' | 'System' | 'Agent';
    name?: string;
  };
  messageReason?: 'NewMessage' | 'MessageDelivered' | 'MessageRead';
}

export interface MiawServerSentEvent {
  type: 'CONVERSATION_MESSAGE' | 'CONVERSATION_PARTICIPANT_CHANGED' | 
        'CONVERSATION_ROUTING_RESULT' | 'CONVERSATION_DELIVERY_ACKNOWLEDGEMENT' |
        'CONVERSATION_READ_ACKNOWLEDGEMENT' | 'CONVERSATION_TYPING_STARTED_INDICATOR' |
        'CONVERSATION_TYPING_STOPPED_INDICATOR' | 'CONVERSATION_CLOSE_CONVERSATION';
  data: any;
}

export interface MiawPreChatData {
  Name?: string;
  Email?: string;
  Phone?: string;
  JobApplicationNumber?: string;
  [key: string]: any;
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
  public async getToken(forceRefresh: boolean = false): Promise<string> {
    const now = Date.now();
    
    // Return cached token if still valid (with 5 minute buffer)
    if (!forceRefresh && this.token && this.tokenExpiresAt && now < this.tokenExpiresAt - 300_000) {
      return this.token;
    }

    // Generate new token
    const tokenResponse = await this.generateNewToken();
    this.token = tokenResponse.token;
    
    // MIAW tokens typically don't have explicit expiry, so we set a reasonable cache time (1 hour)
    this.tokenExpiresAt = now + (60 * 60 * 1000);
    
    return this.token;
  }

  // Generate new MIAW token
  private async generateNewToken(): Promise<MiawTokenResponse> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/messaging/tokens/unauthenticated/access-token`;
    
    const payload = {
        orgId: "00DgL0000071swn",
        esDeveloperName: "Pre_Screening_Agent_With_Custom_UI",
        capabilitiesVersion: "1",
        platform: "Web"
    };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      return await response.json();
    } catch (error) {
      console.error('Error generating MIAW token:', error);
      throw new Error('Failed to generate MIAW access token');
    }
  }

  // Revoke current token
  public async revokeToken(): Promise<void> {
    if (!this.token) {
      return;
    }

    const endpoint = `${this.baseUrl}/iamessage/api/v2/messaging/tokens`;

    try {
      await axios.delete(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
    } catch (error) {
      console.error('Error revoking MIAW token:', error);
      // Don't throw error as revocation might fail if token is already invalid
    } finally {
      this.token = null;
      this.tokenExpiresAt = null;
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

  // Generate continuation token for session continuity
  public async generateContinuationToken(conversationId: string): Promise<string> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/messaging/conversations/${conversationId}/continuationToken`;

    try {
      const headers = await this.getAuthHeaders();
      const response: AxiosResponse<{ continuationToken: string }> = await axios.get(endpoint, { headers });
      
      this.continuationToken = response.data.continuationToken;
      return this.continuationToken;
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
  public async getCurrentToken(): Promise<string> {
    return this.tokenManager.getToken();
  }

  // Get auth headers with continuation token if available, otherwise use access token
  private async getAuthHeadersWithContinuation(): Promise<Record<string, string>> {
    if (this.continuationToken) {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.continuationToken}`
      };
    }
    return this.getAuthHeaders();
  }

  // Get authenticated headers
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.tokenManager.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  // Create conversation
  public async createConversation(preChatData?: MiawPreChatData): Promise<MiawConversation> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/messaging/conversations`;
    
    const payload: any = {
      organizationId: this.organizationId,
      developerName: this.developerName
    };

    if (preChatData) {
      payload.preChatData = preChatData;
    }

    try {
      const headers = await this.getAuthHeaders();
      const response: AxiosResponse<MiawConversation> = await axios.post(endpoint, payload, { headers });
      return response.data;
    } catch (error) {
      console.error('Error creating MIAW conversation:', error);
      throw new Error('Failed to create conversation');
    }
  }

  // Send message
  // Send message
  public async sendMessage(conversationId: string, text: string): Promise<MiawMessage> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/messaging/conversations/${conversationId}/messages`;
    
    const payload = {
      message: {
        type: 'StaticContentMessage',
        staticContent: {
          formatType: 'Text',
          text: text
        }
      }
    };

    try {
      // Use continuation token if available, otherwise use access token
      const headers = await this.getAuthHeadersWithContinuation();
      const response: AxiosResponse<MiawMessage> = await axios.post(endpoint, payload, { headers });
      return response.data;
    } catch (error) {
      console.error('Error sending MIAW message:', error);
      throw new Error('Failed to send message');
    }
  }

  // Send typing indicator
  // Send typing indicator
  public async sendTypingIndicator(conversationId: string, isTyping: boolean): Promise<void> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/messaging/conversations/${conversationId}/typing`;
    
    const payload = {
      typing: isTyping
    };

    try {
      // Use continuation token if available, otherwise use access token
      const headers = await this.getAuthHeadersWithContinuation();
      await axios.post(endpoint, payload, { headers });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
      throw new Error('Failed to send typing indicator');
    }
  }

  // Send acknowledgment (delivery or read receipt)
  // Send acknowledgment (read receipt)
  public async sendAcknowledgment(conversationId: string, messageId: string, acknowledgmentType: 'Delivered' | 'Read' = 'Read'): Promise<void> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/messaging/conversations/${conversationId}/acknowledgments`;
    
    const payload = {
      acknowledgments: [{
        messageId: messageId,
        acknowledgmentType: acknowledgmentType
      }]
    };

    try {
      // Use continuation token if available, otherwise use access token
      const headers = await this.getAuthHeadersWithContinuation();
      await axios.post(endpoint, payload, { headers });
    } catch (error) {
      console.error('Error sending acknowledgment:', error);
      throw new Error('Failed to send acknowledgment');
    }
  }

  // Get SSE events stream URL with authentication token
  public async getEventsStreamUrl(conversationId: string): Promise<string> {
    // Use continuation token if available, otherwise use access token
    const token = this.continuationToken || await this.tokenManager.getToken();
    return `${this.baseUrl}/iamessage/api/v2/messaging/conversations/${conversationId}/events?access_token=${token}`;
  }

  // Close conversation
  public async closeConversation(conversationId: string): Promise<void> {
    const endpoint = `${this.baseUrl}/iamessage/api/v2/messaging/conversations/${conversationId}`;

    try {
      const headers = await this.getAuthHeaders();
      await axios.delete(endpoint, { headers });
    } catch (error) {
      console.error('Error closing conversation:', error);
      throw new Error('Failed to close conversation');
    }
  }

  // Revoke token
  public async revokeToken(): Promise<void> {
    await this.tokenManager.revokeToken();
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
  async generateAccessToken(): Promise<MiawTokenResponse> {
    const token = await this.apiClient.getCurrentToken();
    return { token };
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
    return await this.apiClient.sendMessage(this.conversationId, text);
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

  async revokeToken(): Promise<void> {
    await this.apiClient.revokeToken();
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
