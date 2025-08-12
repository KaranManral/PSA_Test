// ChatBot component provides a full-featured chat interface using MIAW (Messaging for In-App and Web) API.
// Handles session management, message sending, receiving, typing indicators, read receipts, and real-time updates.
"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, MoreVertical } from "lucide-react";

// Browser-compatible UUID generation function
const generateUUID = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

type OutgoingMessageType = "text" | "choice" | "form";

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
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

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
  const showToast = (message: string, type: "error" | "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000); // Hide after 5 seconds
  };

  useEffect(() => {
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
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
      inline: "nearest",
    });
  };

  // Setup Server-Sent Events for real-time messaging using fetch with stream processing
  const setupEventSource = async (): Promise<void> => {
    try {
      const response = await fetch("/api/miaw/events");

      if (!response.ok) {
        throw new Error(`SSE fetch failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      console.log("SSE connection established");
      setIsConnected(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Process SSE stream
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log("SSE stream ended");
              setIsConnected(false);
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events (ending with \n\n)
            const events = buffer.split("\n\n");
            buffer = events.pop() || ""; // Keep incomplete event in buffer

            for (const eventData of events) {
              if (eventData.trim()) {
                // Parse SSE event
                const lines = eventData.split("\n");
                const event: any = {};

                for (const line of lines) {
                  if (line.startsWith("event:")) {
                    event.type = line.substring(6).trim();
                  } else if (line.startsWith("data:")) {
                    event.data = line.substring(5).trim();
                  } else if (line.startsWith("id:")) {
                    event.id = line.substring(3).trim();
                  }
                }

                // Route all events through the main event handler to avoid duplicates
                try {
                  let eventData = {};
                  if (event.data) {
                    eventData =
                      typeof event.data === "string"
                        ? JSON.parse(event.data)
                        : event.data;
                  }

                  // Special handling for typing indicators (no need to parse data)
                  if (event.type === "CONVERSATION_TYPING_STARTED_INDICATOR") {
                    console.log("Typing started");
                    setAgentTyping(true);
                  } else if (
                    event.type === "CONVERSATION_TYPING_STOPPED_INDICATOR"
                  ) {
                    console.log("Typing stopped");
                    setAgentTyping(false);
                  } else if (event.type === "ping") {
                    console.log("Received ping event, connection alive");
                  } else {
                    // Route all other events through the main handler
                    handleMiawEvent({
                      type: event.type,
                      eventType: event.type,
                      data: eventData,
                      timestamp: new Date().toISOString(),
                    });
                  }
                } catch (parseError) {
                  console.error(
                    "Error processing event:",
                    event.type,
                    parseError
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error("Error processing SSE stream:", error);
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
      console.error("Error setting up SSE:", error);
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
      case "CONVERSATION_MESSAGE":
        handleIncomingMessage(event.data);
        break;
      // case 'CONVERSATION_DELIVERY_ACKNOWLEDGEMENT':
      //   handleDeliveryAcknowledgement(event.data);
      //   break;
      // case 'CONVERSATION_READ_ACKNOWLEDGEMENT':
      //   handleReadAcknowledgement(event.data);
      //   break;
      // case 'CONVERSATION_CLOSE_CONVERSATION':
      //   console.log('Conversation closed by agent');
      //   handleCloseSession();
      //   break;
      case "CONVERSATION_PARTICIPANT_CHANGED":
        // Handle routing events if needed
        handleParticipantChange(event.data);
        break;
      case "HEARTBEAT":
        // Keep connection alive
        break;
      default:
        console.log("Unhandled MIAW event:", event);
    }
  };

  // Handle incoming messages from agent
  const handleIncomingMessage = async (data: any): Promise<void> => {
    console.log("Processing incoming message:", data);

    try {
      if (
        !data ||
        !data.conversationEntry ||
        !data.conversationEntry.entryPayload
      ) {
        console.warn("Invalid Data:", data);
        return;
      }

      const message = JSON.parse(data.conversationEntry.entryPayload);
      const messageId: string | undefined = message?.id;
      const sender: string | undefined = data.conversationEntry?.sender?.role;

      if (!messageId) {
        console.warn("Message has no id, skipping:", message);
        return;
      }

      // Only process messages from agents/bots, skip end-user messages
      if (sender === "EndUser") {
        console.log(
          "Skipping user message (already added locally):",
          messageId
        );
        return;
      }

      // Dedupe
      if (processedMessageIds.current.has(messageId)) {
        console.log(
          "Message already processed, skipping duplicate:",
          messageId
        );
        return;
      }
      processedMessageIds.current.add(messageId);

      const messageType: string | undefined =
        message?.abstractMessage?.messageType;
      const abstract = message?.abstractMessage ?? {};
      let content: any = null;

      const buildReferenceMap = (refs: Array<any> | null) => {
        const map: Record<string, any> = {};
        if (Array.isArray(refs)) {
          refs.forEach((r: any) => {
            if (r?.id) map[r.id] = r;
          });
        }
        return map;
      };

      switch (messageType) {
        case "StaticContentMessage": {
          const staticContent = abstract.staticContent || {};
          const format = staticContent.formatType;

          if (format === "Text") {
            content = {
              kind: "text",
              text: staticContent.text ?? "",
            };
          } else if (format === "RichLink") {
            const linkItem = staticContent.linkItem ?? {};
            const title = linkItem.titleItem?.title ?? null;
            const url = linkItem.url ?? null;
            const imageUrl = staticContent.image?.assetUrl ?? null;

            content = {
              kind: "richlink",
              title,
              url,
              imageUrl,
              raw: staticContent,
            };
          } else if (format === "Attachments") {
            const refsMap = buildReferenceMap(abstract.references ?? null);
            const attachments = (staticContent.attachments ?? []).map(
              (att: any) => ({
                id: att.id,
                name: att.name,
                mimeType: att.mimeType,
                url: att.url,
                referenceId: att.referenceId,
                // try to attach linked record if present in references
                recordReference: refsMap?.[att.referenceId] ?? null,
                raw: att,
              })
            );

            content = {
              kind: "attachments",
              attachments,
              raw: staticContent,
            };
          } else if (format === "WebView") {
            content = {
              kind: "webview",
              url: staticContent.url ?? null,
              displayType: staticContent.displayType ?? null,
              title: staticContent.title?.title ?? null,
              messageReason: message.messageReason ?? null,
              raw: staticContent,
            };
          } else {
            console.warn(
              "Unhandled StaticContent formatType:",
              staticContent.formatType,
              messageId
            );
            content = { kind: "unknown_static", raw: staticContent };
          }
          break;
        }

        case "ChoicesMessage": {
          const choices = abstract.choices ?? {};
          const format = choices.formatType;

          // helper to read option items (buttons/quick replies)
          const buildOptionList = (optionItems: any[] | undefined) =>
            (optionItems ?? []).map((opt: any) => ({
              optionIdentifier: opt.optionIdentifier ?? opt.optionId ?? null,
              title: opt.titleItem?.title ?? opt.titleItem?.itemTitle ?? null,
              raw: opt,
            }));

          if (format === "Buttons" || format === "QuickReplies") {
            const options = buildOptionList(
              choices.optionItems ?? choices.optionItems
            );
            content = {
              kind: "choices",
              formatType: format,
              text: choices.text ?? null,
              options,
              raw: choices,
            };
          } else if (format === "Carousel") {
            // Build image map if present
            const imagesById: Record<string, any> = {};
            (choices.images ?? []).forEach((img: any) => {
              if (img?.id) imagesById[img.id] = img;
            });

            const items = (choices.items ?? []).map((it: any) => {
              const titleItem = it.titleItem ?? {};
              const imageId = titleItem.imageId ?? null;
              const imageAsset = imageId ? imagesById[imageId] : null;

              const interactions = (it.interactionItems ?? []).map(
                (i: any) => ({
                  optionIdentifier: i.optionIdentifier ?? null,
                  title: i.titleItem?.title ?? null,
                  raw: i,
                })
              );

              return {
                title: titleItem.title ?? null,
                subTitle: titleItem.subTitle ?? null,
                imageAsset: imageAsset
                  ? { id: imageAsset.id, url: imageAsset.assetUrl }
                  : null,
                interactions,
                raw: it,
              };
            });

            content = {
              kind: "choices",
              formatType: "Carousel",
              items,
              // also surface images array for UI mapping if needed
              images: choices.images ?? [],
              raw: choices,
            };
          } else {
            console.warn(
              "Unhandled ChoicesMessage formatType:",
              choices.formatType,
              messageId
            );
            content = { kind: "unknown_choices", raw: choices };
          }
          break;
        }

        case "FormMessage": {
          const form = abstract.form ?? {};
          const sections = (form.sections ?? []).map((s: any) => {
            const input = s.input ?? {};
            return {
              sectionType: s.sectionType ?? null,
              submitForm: !!s.submitForm,
              input: {
                id: input.id ?? null,
                inputType: input.inputType ?? null,
                label: input.label?.title ?? null,
                required: !!input.required,
                maximumCharacterCount: input.maximumCharacterCount ?? null,
                multipleSelection: input.multipleSelection ?? null,
                optionItems: (input.optionItems ?? []).map((opt: any) => ({
                  optionIdentifier: opt.optionIdentifier ?? null,
                  title: opt.titleItem?.title ?? null,
                  raw: opt,
                })),
                raw: input,
              },
              raw: s,
            };
          });

          content = {
            kind: "form",
            formTitle: form.formTitle?.title ?? null,
            message: form.message?.title ?? null,
            reply: form.reply?.title ?? null,
            sections,
            raw: form,
          };
          break;
        }

        default:
          console.warn("Unhandled messageType:", messageType, messageId);
          content = { kind: "unknown", raw: abstract };
      }

      // If we couldn't get content, bail out
      if (!content) {
        console.warn(
          "Could not extract message content for messageId:",
          messageId,
          message
        );
        return;
      }

      const uiMessageId = `${messageId}-${Date.now()}`;
      const botMessage: any = {
        id: uiMessageId, // UI-safe id (for React keys)
        type: sender ?? "Agent", // sender role (Agent/Bot/etc.)
        content, // structured content object for UI rendering
        timestamp: new Date(),
        messageId, // original message id (useful for acks)
        raw: message, // keep raw payload if you need it later
      };

      console.log("Adding bot message to chat:", botMessage);
      setMessages((prev: any[]) => [...prev, botMessage]);

      // optional: sendDeliveryAcknowledgement(messageId);
      // optional: setTimeout(() => sendReadAcknowledgement(messageId), 1000);
    } catch (err) {
      console.error("Error processing incoming message:", err);
    }
  };

  const handleParticipantChange = async (data: any): Promise<void> => {
    if (data && data.conversationEntry && data.conversationEntry.entryPayload) {
      const entryPayload = JSON.parse(data.conversationEntry.entryPayload);
      if (entryPayload) {
        if (entryPayload.entries && entryPayload.entries.length > 0) {
          // Process the valid entry payload
          const operation = entryPayload.entries[0].operation;
          if (operation && operation === "remove") {
            await handleCloseSession();
          } else if (operation && operation === "add") {
            console.log("Agent has joined");
          }
        } else {
          console.warn("Invalid Operation type");
        }
      } else {
        console.warn("Invalid Entry Payload");
      }
    } else {
      console.warn("Invalid participant change data:", data);
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
            throw new Error(
              "Thank you for your interest. Your Pre Screening is already completed."
            );
          case 404:
            throw new Error("Service not found. Please check configuration.");
          case 500:
            throw new Error("Server Error: Please try again later.");
          default:
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.message || `Unexpected Error (${response.status})`
            );
        }
      }

      const data = await response.json();

      if (data.message === "success" && data.conversationId) {
        // Clear processed message IDs for new session
        processedMessageIds.current.clear();
        setIsSessionActive(true);
      } else {
        throw new Error("Failed to start session: Invalid response format.");
      }
    } catch (error) {
      console.error("Error starting session:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to start session",
        "error"
      );
    } finally {
      setIsCreatingSession(false);
    }
  };

  const sendToServer = async (payload: any) => {
    const res = await fetch("/api/miaw/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API Error: ${res.status} ${res.statusText} ${txt}`);
    }
    return res.json();
  };

  // Sends a user message using MIAW API
  const handleSendMessage = async (): Promise<void> => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isSending) return;

    if (trimmedInput.length > MAX_MESSAGE_LENGTH) {
      showToast(
        `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`,
        "error"
      );
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

    try {
      const payload = {
        messageId,
        messageType: "text" as OutgoingMessageType,
        msg: trimmedInput,
      };

      const data = await sendToServer(payload);

      if (data?.message === "success") {
        console.log("Message sent successfully");
        // Response will arrive via SSE
      } else {
        throw new Error("Unexpected response from server");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      showToast("Failed to send message. Please try again.", "error");

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

  // helper to send a choice selection back to MIAW
  // optionIdentifier: the UUID from the choices option
  // inReplyToMessageId: the original choices message id (required)
  const sendChoiceSelection = async (
    optionIdentifier: string,
    inReplyToMessageId: string,
    messageId = generateUUID()
  ) => {
    if (!optionIdentifier || !inReplyToMessageId) {
      throw new Error(
        "optionIdentifier and inReplyToMessageId are required for choice responses"
      );
    }

    // Add local user message to chat (so UI shows selection immediately)
    const userMessage: Message = {
      id: messageId,
      type: "EndUser",
      content: optionIdentifier, // UI can translate to human text if needed
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const payload = {
      messageId,
      messageType: "choice" as OutgoingMessageType,
      optionIdentifier,
      inReplyToMessageId,
    };

    return sendToServer(payload);
  };

  // helper to submit a form response
  // answers: array of { inputId: string, value: string } (adapt if your server expects different keys)
  // inReplyToMessageId: the original form message id (required)
  const sendFormResponse = async (
    answers: Array<{ inputId: string; value: any }>,
    inReplyToMessageId: string,
    messageId = generateUUID()
  ) => {
    if (!Array.isArray(answers) || !inReplyToMessageId) {
      throw new Error(
        "answers (array) and inReplyToMessageId are required for form responses"
      );
    }

    const userMessage: Message = {
      id: messageId,
      type: "EndUser",
      content: "[Submitted Form]", // UI can expand to show values if desired
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const payload = {
      messageId,
      messageType: "form" as OutgoingMessageType,
      answers, // [{ inputId, value }, ...]
      inReplyToMessageId,
    };

    return sendToServer(payload);
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
        setTimeout(() => {
          showToast("Conversation has been closed", "error");
          // Reset the chat state to the initial screen
          setMessages([]);
          setInputValue("");
          setIsSessionActive(false);
          setTermsAccepted(false);
          // Clear processed message IDs
          processedMessageIds.current.clear();
          cleanupEventSource();
        }, 1500);
      } else {
        throw new Error("Failed to close session.");
      }
    } catch (error) {
      console.error("Error closing session:", error);
      showToast(
        "Could not close the session properly. Please refresh the page.",
        "error"
      );
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

  // Render a simple text/paragraph for message content (preserves whitespace)
  const RenderTextContent = ({ text }: { text?: string }) => (
    <p className="text-gray-800 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: text ?? "" }}></p>
  );

  // Rich Link
  const RichLinkMessage = ({ content }: { content: any }) => {
    return (
      <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
        {content.imageUrl && (
          <a
            href={content.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="block mb-3"
          >
            <img
              src={content.imageUrl}
              alt={content.title ?? "link"}
              className="max-w-full rounded"
            />
          </a>
        )}
        {content.title && (
          <a
            href={content.url ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="text-gray-800 font-medium block mb-1"
          >
            {content.title}
          </a>
        )}
        {content.url && (
          <a
            href={content.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-blue-600 underline"
          >
            {content.url}
          </a>
        )}
      </div>
    );
  };

  // Attachments (list)
  const AttachmentsMessage = ({ content }: { content: any }) => {
    return (
      <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
        {(content.attachments ?? []).map((att: any) => (
          <div key={att.id} className="mb-3">
            {att.mimeType?.startsWith?.("image") ? (
              <a href={att.url} target="_blank" rel="noreferrer">
                <img
                  src={att.url}
                  alt={att.name}
                  className="max-w-xs rounded"
                />
              </a>
            ) : (
              <a
                href={att.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 underline"
              >
                {att.name ?? "Download"}
              </a>
            )}
            <div className="text-xs text-gray-500 mt-1">{att.mimeType}</div>
          </div>
        ))}
      </div>
    );
  };

  // WebView
  const WebViewMessage = ({ content }: { content: any }) => {
    return (
      <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
        {content.title && (
          <div className="font-medium mb-2">{content.title}</div>
        )}
        {content.messageReason && (
          <div className="text-xs text-gray-500 mb-2">
            {content.messageReason}
          </div>
        )}
        {content.url && (
          <a
            href={content.url}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm text-blue-600 underline"
          >
            Open Link
          </a>
        )}
      </div>
    );
  };

  // Choices (Buttons / QuickReplies)
  const ChoicesMessageRenderer = ({ msg }: { msg: any }) => {
    const [disabled, setDisabled] = useState(false);
    const choices = msg.content.options ?? [];
    const text = msg.content.text ?? null;

    const onOptionClick = async (opt: any) => {
      if (!opt?.optionIdentifier) return;
      setDisabled(true);
      try {
        // Optimistically show user message if you want — sendChoiceSelection does it already in previous code
        await sendChoiceSelection(opt.optionIdentifier, msg.messageId);
      } catch (err) {
        console.error("sendChoiceSelection failed", err);
        showToast?.("Failed to send selection. Please try again.", "error");
        setDisabled(false);
      }
    };

    return (
      <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
        {text && <div className="mb-3 text-gray-800">{text}</div>}
        <div className="flex flex-wrap gap-2">
          {choices.map((opt: any) => (
            <button
              key={opt.optionIdentifier ?? opt.title ?? Math.random()}
              onClick={() => onOptionClick(opt)}
              disabled={disabled}
              className="bg-white border border-gray-300 text-gray-800 px-3 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {opt.title ?? opt.optionIdentifier}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Carousel renderer (items with interactions)
  const CarouselMessageRenderer = ({ msg }: { msg: any }) => {
    const [disabled, setDisabled] = useState(false);
    const items = msg.content.items ?? [];

    const onInteraction = async (interaction: any) => {
      if (!interaction?.optionIdentifier) return;
      setDisabled(true);
      try {
        await sendChoiceSelection(interaction.optionIdentifier, msg.messageId);
      } catch (err) {
        console.error("Carousel interaction failed", err);
        showToast?.("Failed to send selection. Please try again.", "error");
        setDisabled(false);
      }
    };

    return (
      <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
        <div className="space-y-4">
          {items.map((item: any, idx: number) => (
            <div key={idx} className="border border-gray-200 rounded p-3">
              {item.imageAsset?.url && (
                <img
                  src={item.imageAsset.url}
                  alt={item.title}
                  className="max-w-full rounded mb-2"
                />
              )}
              <div className="font-medium">{item.title}</div>
              {item.subTitle && (
                <div className="text-sm text-gray-600">{item.subTitle}</div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {(item.interactions ?? []).map((i: any) => (
                  <button
                    key={i.optionIdentifier ?? i.title ?? Math.random()}
                    onClick={() => onInteraction(i)}
                    disabled={disabled}
                    className="bg-white border border-gray-300 text-gray-800 px-3 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {i.title ?? "Select"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Form renderer + submit handler
  const FormMessageRenderer = ({ msg }: { msg: any }) => {
    // Build initial state
    const sections = msg.content.sections ?? [];
    const initState = sections.reduce((acc: any, s: any) => {
      const id =
        s.input?.id ?? `input_${Math.random().toString(36).slice(2, 8)}`;
      acc[id] = "";
      return acc;
    }, {});
    const [values, setValues] = useState<Record<string, any>>(initState);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
      // if form changes, reset values
      const newInit = sections.reduce((acc: any, s: any) => {
        const id =
          s.input?.id ?? `input_${Math.random().toString(36).slice(2, 8)}`;
        acc[id] = values[id] ?? "";
        return acc;
      }, {});
      setValues((prev) => ({ ...newInit, ...prev }));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [msg.messageId]);

    const handleChange = (inputId: string, val: any) =>
      setValues((p) => ({ ...p, [inputId]: val }));

    const onSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const answers = Object.entries(values).map(([inputId, value]) => ({
          inputId,
          value,
        }));
        await sendFormResponse(answers, msg.messageId);
      } catch (err) {
        console.error("Form submit failed", err);
        showToast?.("Failed to submit form. Please try again.", "error");
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <form
        onSubmit={onSubmit}
        className="bg-gray-100 rounded-lg p-4 max-w-2xl"
      >
        {msg.content.formTitle && (
          <div className="font-medium mb-2">{msg.content.formTitle}</div>
        )}
        {sections.map((section: any) => {
          const inputId = section.input?.id ?? Math.random().toString();
          const label = section.input?.label ?? inputId;
          return (
            <div key={inputId} className="mb-3">
              <label className="block text-sm text-gray-700 mb-1">
                {label}
              </label>

              {section.input?.inputType === "SelectInput" ? (
                <select
                  value={values[inputId] ?? ""}
                  onChange={(ev) => handleChange(inputId, ev.target.value)}
                  required={section.input?.required}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  <option value="">Select</option>
                  {(section.input?.optionItems ?? []).map((opt: any) => (
                    <option
                      key={opt.optionIdentifier}
                      value={opt.optionIdentifier}
                    >
                      {opt.title ?? opt.optionIdentifier}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={
                    section.input?.keyboardType === "PhonePad" ? "tel" : "text"
                  }
                  value={values[inputId] ?? ""}
                  onChange={(ev) => handleChange(inputId, ev.target.value)}
                  required={section.input?.required}
                  maxLength={section.input?.maximumCharacterCount ?? undefined}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                />
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    );
  };

  // --- End helpers ---

  return (
    <div className="h-[75vh] bg-gray-100 relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium animate-fade-in ${
            toast.type === "error" ? "bg-red-600" : "bg-green-600"
          }`}
        >
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
                <div
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isConnected
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  {isConnected ? "● Connected" : "● Reconnecting..."}
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
                    ) : (
                      <MoreVertical className="w-5 h-5" />
                    )}
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
                  const isLastBotInSequence =
                    message.type === "Chatbot" &&
                    (index === messages.length - 1 ||
                      messages[index + 1]?.type !== "Chatbot");

                  // If message is a bot message with structured content (from handleIncomingMessage)
                  if (message.type === "Chatbot") {
                    const content: any = message.content ?? {};
                    // If content is a plain string (backwards compatibility), render as text
                    if (typeof content === "string") {
                      return (
                        <div key={message.id} className="animate-fade-in">
                          <div className="flex items-start space-x-3">
                            {isLastBotInSequence ? (
                              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                                AA
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"></div>
                            )}
                            <div className="flex-1">
                              <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
                                <RenderTextContent text={content} />
                              </div>
                              {isLastBotInSequence && (
                                <div className="flex items-center mt-1 text-xs text-gray-500">
                                  <span>
                                    {agentName} •{" "}
                                    {formatTime(message.timestamp)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // If content is structured object (newer messages)
                    const kind = content.kind ?? "text";

                    return (
                      <div key={message.id} className="animate-fade-in">
                        <div className="flex items-start space-x-3">
                          {isLastBotInSequence ? (
                            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                              AA
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"></div>
                          )}

                          <div className="flex-1">
                            {/* choose renderer by kind */}
                            {kind === "text" && (
                              <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
                                <RenderTextContent
                                  text={
                                    content.text ??
                                    content.raw?.staticContent?.text
                                  }
                                />
                              </div>
                            )}

                            {kind === "richlink" && (
                              <RichLinkMessage content={content} />
                            )}

                            {kind === "attachments" && (
                              <AttachmentsMessage content={content} />
                            )}

                            {kind === "webview" && (
                              <WebViewMessage content={content} />
                            )}

                            {kind === "choices" &&
                              content.formatType !== "Carousel" && (
                                <ChoicesMessageRenderer msg={message} />
                              )}

                            {kind === "choices" &&
                              content.formatType === "Carousel" && (
                                <CarouselMessageRenderer msg={message} />
                              )}

                            {kind === "form" && (
                              <FormMessageRenderer msg={message} />
                            )}

                            {/* fallback */}
                            {[
                              "text",
                              "richlink",
                              "attachments",
                              "webview",
                              "choices",
                              "form",
                            ].indexOf(kind) === -1 && (
                              <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                                  {JSON.stringify(
                                    content.raw ?? content,
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            )}

                            {isLastBotInSequence && (
                              <div className="flex items-center mt-1 text-xs text-gray-500">
                                <span>
                                  {agentName} • {formatTime(message.timestamp)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // EndUser messages unchanged (keeps your existing design)
                  if (message.type === "EndUser") {
                    return (
                      <div key={message.id} className="animate-fade-in">
                        <div className="flex flex-col items-end justify-end">
                          <div className="bg-red-600 text-white rounded-lg p-4 max-w-2xl">
                            <p className="whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                            <span>
                              {message.isRead
                                ? "Read"
                                : message.isDelivered
                                ? "Delivered"
                                : "Sent"}{" "}
                              • {formatTime(message.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // fallback for any other message types (preserve UI)
                  return (
                    <div key={message.id} className="animate-fade-in">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"></div>
                        <div className="flex-1">
                          <div className="bg-gray-100 rounded-lg p-4 max-w-2xl">
                            <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(message.content, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {agentTyping && (
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
                  <div
                    className={`text-xs ${
                      inputValue.length > MAX_MESSAGE_LENGTH * 0.8
                        ? "text-red-500"
                        : "text-gray-500"
                    }`}
                  >
                    {inputValue.length}/{MAX_MESSAGE_LENGTH}
                  </div>
                  {/* Typing indicator status */}
                  {isTyping && (
                    <div className="text-xs text-blue-500">typing...</div>
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
