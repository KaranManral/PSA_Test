// ChatBot component provides a full-featured chat interface using MIAW (Messaging for In-App and Web) API.
// Handles session management, message sending, receiving, typing indicators, read receipts, and real-time updates.
"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, MoreVertical } from "lucide-react";

// Browser-compatible UUID generation function
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Message interface defines the structure of each chat message
interface Message {
  id: string;
  type: "EndUser" | "Chatbot";
  content: string;
  timestamp: Date;
  isDelivered?: boolean;
  isRead?: boolean;
  messageId?: string; // For MIAW message tracking
}

// MIAW Server-Sent Event interface
interface MiawEvent {
  type: string;
  eventType: string;
  data: any;
  timestamp: string;
}

export default function ChatBot({
  jobApplicationNumber,
}: {
  jobApplicationNumber: string;
}) {

  //Details about agent
  const [agentName, setAgentName] = useState<string>("Adecco Agent");

  // State for chat messages, input, and UI flags
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [agentTyping, setAgentTyping] = useState<boolean>(false);

  // State variables for session management
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [isClosingSession, setIsClosingSession] = useState<boolean>(false);

  // New state for terms and conditions agreement
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  
  // State for menu dropdown
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  
  // State for toast notifications
  const [toast, setToast] = useState<{message: string; type: 'error' | 'success'} | null>(null);

  // Real-time connection state
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track processed message IDs to prevent duplicates
  const processedMessageIds = useRef<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const MAX_MESSAGE_LENGTH = 2000;

  // Function to show toast notifications
  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000); // Hide after 5 seconds
  };

  useEffect(()=>{
    setAgentName("Adecco Agent");
  }, []);

  // Scrolls to the bottom of the chat when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Setup real-time event listening when session is active
  useEffect(() => {
    if (isSessionActive && !eventSourceRef.current) {
      setupEventSource();
    }

    return () => {
      cleanupEventSource();
    };
  }, [isSessionActive]);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth",block: "end", inline: "nearest" });
  };

  // Setup Server-Sent Events for real-time messaging using fetch with stream processing
  const setupEventSource = async (): Promise<void> => {
    try {
      const response = await fetch('/api/miaw/events');
      
      if (!response.ok) {
        throw new Error(`SSE fetch failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      console.log('SSE connection established');
      setIsConnected(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Process SSE stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('SSE stream ended');
              setIsConnected(false);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            
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
                
                // Route all events through the main event handler to avoid duplicates
                try {
                  let eventData = {};
                  if (event.data) {
                    eventData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                  }
                  
                  // Special handling for typing indicators (no need to parse data)
                  if (event.type === 'CONVERSATION_TYPING_STARTED_INDICATOR') {
                    console.log('Typing started:', event.data);
                    setAgentTyping(true);
                  } else if (event.type === 'CONVERSATION_TYPING_STOPPED_INDICATOR') {
                    console.log('Typing stopped:', event.data);
                    setAgentTyping(false);
                  } else if (event.type === 'ping') {
                    console.log('Received ping event, connection alive');
                  } else {
                    // Route all other events through the main handler
                    handleMiawEvent({ 
                      type: event.type, 
                      eventType: event.type, 
                      data: eventData, 
                      timestamp: new Date().toISOString() 
                    });
                  }
                } catch (parseError) {
                  console.error('Error processing event:', event.type, parseError);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error processing SSE stream:', error);
          setIsConnected(false);
          
          // Attempt to reconnect after 5 seconds
          setTimeout(() => {
            if (isSessionActive) {
              setupEventSource();
            }
          }, 5000);
        }
      };

      processStream();
      
    } catch (error) {
      console.error('Error setting up SSE:', error);
      setIsConnected(false);
      
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (isSessionActive) {
          setupEventSource();
        }
      }, 5000);
    }
  };

  // Handle incoming MIAW events
  const handleMiawEvent = (event: MiawEvent): void => {
    switch (event.eventType) {
      case 'CONVERSATION_MESSAGE':
        handleIncomingMessage(event.data);
        break;
      case 'CONVERSATION_TYPING_STARTED_INDICATOR':
        setAgentTyping(true);
        break;
      case 'CONVERSATION_TYPING_STOPPED_INDICATOR':
        setAgentTyping(false);
        break;
      // case 'CONVERSATION_DELIVERY_ACKNOWLEDGEMENT':
      //   handleDeliveryAcknowledgement(event.data);
      //   break;
      // case 'CONVERSATION_READ_ACKNOWLEDGEMENT':
      //   handleReadAcknowledgement(event.data);
      //   break;
      case 'CONVERSATION_CLOSE_CONVERSATION':
        console.log('Conversation closed by agent');
        handleCloseSession();
        break;
      case 'CONVERSATION_ROUTING_RESULT':
        // Handle routing events if needed
        console.log('Routing result:', event.data);
        break;
      case 'HEARTBEAT':
        // Keep connection alive
        break;
      default:
        console.log('Unhandled MIAW event:', event);
    }
  };

  // Handle incoming messages from agent
  const handleIncomingMessage = async (data: any): Promise<void> => {
    console.log('Processing incoming message:', data);
// {
//       channelPlatformKey: data.conversationEntry.channelPlatformKey,
//       channelType: data.conversationEntry.channelType,
//       sender: data.conversationEntry.sender.role,
//       senderDisplayName: data.conversationEntry.senderDisplayName,
//     };
    if (data && data.conversationEntry && data.conversationEntry.entryPayload) {
      const message = await JSON.parse(data.conversationEntry.entryPayload);

      const messageId = message.id;
      const messageContent = message.abstractMessage.staticContent.text;
      const sender = data.conversationEntry.sender.role;

      // Only process messages from agents/bots, skip user messages
      if (sender === 'EndUser') {
        console.log('Skipping user message (already added locally):', messageId);
        return;
      }

      if (messageId && messageContent) {
        // Check if we've already processed this message
        if (processedMessageIds.current.has(messageId)) {
          console.log('Message already processed, skipping duplicate:', messageId);
          return;
        }
        
        // Mark message as processed
        processedMessageIds.current.add(messageId);
        
        // Generate a unique UI ID to prevent React key conflicts
        const uiMessageId = `${messageId}-${Date.now()}`;
        
        const botMessage: Message = {
          id: uiMessageId,  // Use unique UI ID for React key
          type: sender,
          content: messageContent,
          timestamp: new Date(),
          messageId: messageId  // Keep original message ID for acknowledgments
        };

        console.log("Adding bot message to chat:", botMessage);

        setMessages((prev) => [...prev, botMessage]);

        // // Send delivery acknowledgement immediately
        // sendDeliveryAcknowledgement(messageId);

        // // Send read acknowledgement for the last message after a short delay
        // setTimeout(() => {
        //   sendReadAcknowledgement(messageId);
        // }, 1000);
      } else {
        console.warn("Could not extract message content from data:", data);
      }
    } else {
      console.warn("Invalid Data:", data);
    }
  };

  // // Handle delivery acknowledgements
  // const handleDeliveryAcknowledgement = (data: any): void => {
  //   if (data.messageId) {
  //     setMessages((prev) => 
  //       prev.map(msg => 
  //         msg.messageId === data.messageId 
  //           ? { ...msg, isDelivered: true }
  //           : msg
  //       )
  //     );
  //   }
  // };

  // // Handle read acknowledgements
  // const handleReadAcknowledgement = (data: any): void => {
  //   if (data.messageId) {
  //     setMessages((prev) => 
  //       prev.map(msg => 
  //         msg.messageId === data.messageId 
  //           ? { ...msg, isRead: true }
  //           : msg
  //       )
  //     );
  //   }
  // };

  // Cleanup event source
  const cleanupEventSource = (): void => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  };

  // // Send delivery acknowledgement
  // const sendDeliveryAcknowledgement = async (messageId: string): Promise<void> => {
  //   try {
  //     await fetch('/api/miaw/acknowledgment/delivery', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         conversationEntryId: messageId
  //       }),
  //     });
  //   } catch (error) {
  //     console.error('Error sending delivery acknowledgement:', error);
  //   }
  // };

  // // Send read acknowledgement
  // const sendReadAcknowledgement = async (messageId: string): Promise<void> => {
  //   try {
  //     await fetch('/api/miaw/acknowledgment/read', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify({
  //         conversationEntryId: messageId
  //       }),
  //     });
  //   } catch (error) {
  //     console.error('Error sending read acknowledgement:', error);
  //   }
  // };

  // // Send started typing indicator
  // const sendStartedTypingIndicator = async (): Promise<void> => {
  //   try {
  //     const path = '/api/miaw/typing/started';
  //     await fetch(path, { method: 'POST' });
  //   } catch (error) {
  //     console.error('Error sending started typing indicator:', error);
  //   }
  // };

  // // Send stopped typing indicator
  // const sendStoppedTypingIndicator = async (): Promise<void> => {
  //   try {
  //     const path = '/api/miaw/typing/stopped';
  //     await fetch(path, { method: 'POST' });
  //   } catch (error) {
  //     console.error('Error sending stopped typing indicator:', error);
  //   }
  // };

  // // Handle typing indicator with debouncing to avoid too many requests
  // const handleTypingIndicator = (typing: boolean): void => {
  //   if (typingTimeoutRef.current) {
  //     clearTimeout(typingTimeoutRef.current);
  //   }

  //   if (typing) {
  //     // Only send typing start if not already typing
  //     if (!isTyping) {
  //       setIsTyping(true);
  //       sendStartedTypingIndicator();
  //     }
      
  //     // Stop typing indicator after 3 seconds of inactivity
  //     typingTimeoutRef.current = setTimeout(() => {
  //       setIsTyping(false);
  //       sendStoppedTypingIndicator();
  //     }, 3000);
  //   } else {
  //     // Send stop immediately if user clears input or sends message
  //     if (isTyping) {
  //       setIsTyping(false);
  //       sendStoppedTypingIndicator();
  //     }
  //   }
  // };

  // Starts a new chat session with the MIAW API
  const handleStartSession = async (): Promise<void> => {
    setIsCreatingSession(true);

    try {
  const response = await fetch("/api/miaw/session/create", {
        method: "POST",
        body: JSON.stringify({
          jobApplicationNumber: jobApplicationNumber,
          termsAndConditionAgreed: termsAccepted,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        switch (response.status) {
          case 401:
            throw new Error("Unauthorized: Invalid configuration.");
          case 403:
            throw new Error("Thank you for your interest. Your Pre Screening is already completed.");
          case 404:
            throw new Error("Service not found. Please check configuration.");
          case 500:
            throw new Error("Server Error: Please try again later.");
          default:
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Unexpected Error (${response.status})`);
        }
      }

      const data = await response.json();

      if (data.message === "success" && data.conversationId ) {
        // Clear processed message IDs for new session
        processedMessageIds.current.clear();
        setIsSessionActive(true);
      } else {
        throw new Error("Failed to start session: Invalid response format.");
      }
    } catch (error) {
      console.error("Error starting session:", error);
      showToast(error instanceof Error ? error.message : "Failed to start session", 'error');
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Sends a user message using MIAW API
  const handleSendMessage = async (): Promise<void> => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isSending) return;

    // Check message length
    if (trimmedInput.length > MAX_MESSAGE_LENGTH) {
      showToast(`Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`, 'error');
      return;
    }

    const messageId = generateUUID();

    const userMessage: Message = {
      id: messageId,
      type: "EndUser",
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);
    
    // // Stop typing indicator
    // handleTypingIndicator(false);

    try {
  const response = await fetch("/api/miaw/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messageId: messageId,
          msg: trimmedInput
        }),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.message === "success") {
        // Message sent successfully - response will come via SSE
        console.log('Message sent successfully');
      } else if (data.message === "Error: Message too long") {
        showToast("Message is too long. Please shorten your message and try again.", 'error');
      } else {
        throw new Error("Invalid response from message API.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      showToast("Failed to send message. Please try again.", 'error');

      const errorMessage: Message = {
        id: generateUUID(),
        type: "Chatbot",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  // Closes the current chat session and resets state using MIAW API
  const handleCloseSession = async (): Promise<void> => {
    setIsClosingSession(true);
    try {
  const response = await fetch("/api/miaw/session/delete", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      if (response.status === 200) {
        showToast('Conversation has been closed', 'error');
        // Reset the chat state to the initial screen
        setMessages([]);
        setInputValue("");
        setIsSessionActive(false);
        setTermsAccepted(false);
        // Clear processed message IDs
        processedMessageIds.current.clear();
        cleanupEventSource();
      } else {
        throw new Error("Failed to close session.");
      }
    } catch (error) {
      console.error("Error closing session:", error);
      showToast("Could not close the session properly. Please refresh the page.", 'error');
    } finally {
      setIsClosingSession(false);
    }
  };

  // Handles Enter key for sending messages
  const handleKeyPress = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Formats the timestamp for display
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Dynamically adjusts textarea height as user types and handles typing indicator
  const adjustTextareaHeight = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ): void => {
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    setInputValue(textarea.value);

    // // Handle typing indicator
    // if (textarea.value.trim()) {
    //   handleTypingIndicator(true);
    // } else {
    //   handleTypingIndicator(false);
    // }
  };

  return (
    <div className="h-[75vh] bg-gray-100 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium animate-fade-in ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
        }`}>
          {toast.message}
        </div>
      )}

      {!isSessionActive ? (
        <div className="h-[75vh] bg-gray-100 flex flex-col">
          {/* Chat Container */}
          <div className="flex-1 max-w-4xl mx-auto w-full bg-white flex flex-col my-6 shadow-lg rounded-b-xl">
            {/* Chat Header */}
            <div className="bg-black text-white text-center py-4 rounded-t-xl">
              <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-xl font-semibold">{agentName}</h1>
              </div>
            </div>
            {/* Main Content */}
            <div className="flex-1 p-8 flex flex-col items-center justify-center text-center">
              <div className="mb-8">
                <p className="text-gray-600 text-lg mb-6">
                  By proceeding, I acknowledge that I have read the{" "}
                  <a href="#" className="text-blue-600 underline">
                    Privacy Policy
                  </a>{" "}
                  and accepted the{" "}
                  <a href="#" className="text-blue-600 underline">
                    Terms of Use
                  </a>
                  .
                </p>

                {/* Terms and Conditions Checkbox */}
                <div className="flex items-center justify-center space-x-3 mb-8">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="w-5 h-5 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label htmlFor="terms" className="text-gray-700 select-none">
                    I accept
                  </label>
                </div>

                <button
                  onClick={handleStartSession}
                  disabled={isCreatingSession || !termsAccepted}
                  className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingSession ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin inline" />
                      Starting...
                    </>
                  ) : (
                    "Begin Pre Screening"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-[75vh] bg-gray-100 flex flex-col">
          {/* Chat Container */}
          <div className="h-[65vh] flex-1 max-w-4xl mx-auto w-full bg-white flex flex-col my-6 shadow-lg rounded-b-xl">
            {/* Chat Header */}
            <div className="bg-black text-white text-center py-4 rounded-t-xl relative">
              {/* Connection Status in Header */}
              <div className="absolute top-2 right-2">
                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isConnected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                  {isConnected ? '● Connected' : '● Reconnecting...'}
                </div>
              </div>
              
              <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
                {/* Menu Icon */}
                <div className="relative">
                  <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="text-white hover:text-gray-300 transition-colors p-1 cursor-pointer"
                  >
                    {isClosingSession ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ):<MoreVertical className="w-5 h-5" />}
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isMenuOpen && (
                    <div className="absolute top-8 left-0 bg-white rounded-lg shadow-lg py-2 z-10 min-w-[160px]">
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          handleCloseSession();
                        }}
                        disabled={isClosingSession}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center cursor-pointer"
                      >
                        {isClosingSession ? "Closing..." : "End Conversation"}
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Title */}
                <h1 className="text-xl font-semibold flex-1">{agentName}</h1>

                {/* Spacer for balance */}
                <div className="w-7"></div>
              </div>
            </div>
            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto">
              {/* Today timestamp */}
              <div className="text-center mb-6">
                <span className="text-sm text-gray-500">
                  Today •{" "}
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Message received indicator */}
              <div className="text-center mb-6">
                <span className="text-sm text-gray-500">Message received</span>
              </div>

              {/* Messages */}
              <div className="space-y-4">
                {messages.map((message, index) => {
                  // Check if this is the last bot message in a sequence
                  const isLastBotInSequence = message.type === "Chatbot" && 
                    (index === messages.length - 1 || messages[index + 1]?.type !== "Chatbot");
                  
                  return (
                    <div key={message.id} className="animate-fade-in">
                      {message.type === "Chatbot" && (
                        <div className="flex items-start space-x-3">
                          {isLastBotInSequence ? (
                            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                              AA
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
                              <p className="text-gray-800 whitespace-pre-wrap">
                                {message.content}
                              </p>
                            </div>
                            {isLastBotInSequence && (
                              <div className="flex items-center mt-1 text-xs text-gray-500">
                                <span>{agentName} • {formatTime(message.timestamp)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {message.type === "EndUser" && (
                        <div className="flex flex-col items-end justify-end">
                          <div className="bg-red-600 text-white rounded-lg p-4 max-w-2xl">
                            <p className="whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                            <span>
                              {message.isRead ? 'Read' : message.isDelivered ? 'Delivered' : 'Sent'} • {formatTime(message.timestamp)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {(agentTyping) && (
                  <div className="flex items-start space-x-3 animate-fade-in">
                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                      AA
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-2 flex items-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {agentName} is typing...
                      </div>
                      <div className="bg-gray-100 rounded-lg p-4">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex space-x-3">
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={adjustTextareaHeight}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none min-h-[48px] max-h-[120px] overflow-y-auto"
                  rows={1}
                  disabled={isSending}
                  maxLength={MAX_MESSAGE_LENGTH}
                />
                <div className="flex flex-col items-end space-y-1">
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSending}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                  <div className={`text-xs ${inputValue.length > MAX_MESSAGE_LENGTH * 0.8 ? 'text-red-500' : 'text-gray-500'}`}>
                    {inputValue.length}/{MAX_MESSAGE_LENGTH}
                  </div>
                  {/* Typing indicator status */}
                  {isTyping && (
                    <div className="text-xs text-blue-500">
                      typing...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
