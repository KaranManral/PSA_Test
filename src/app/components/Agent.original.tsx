// ChatBot component provides a full-featured chat interface for interacting with the Salesforce Einstein AI Agent.
// Handles session management, message sending, receiving, and UI state for a conversational experience.
"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, MoreVertical } from "lucide-react";

// Message interface defines the structure of each chat message
interface Message {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
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

  // State variables for session management
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [isClosingSession, setIsClosingSession] = useState<boolean>(false); // New state for closing session

  // New state for terms and conditions agreement
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  
  // State for menu dropdown
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  
  // State for toast notifications
  const [toast, setToast] = useState<{message: string; type: 'error' | 'success'} | null>(null);

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

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth",block: "end", inline: "nearest" });
  };

  // Starts a new chat session with the AI agent
  const handleStartSession = async (): Promise<void> => {
    setIsCreatingSession(true);

    try {
      const response = await fetch("/api/agent/session/create", {
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
        throw new Error("Unauthorized: Invalid Token.");
      case 403:
        throw new Error("Thank you for your interest. Your Pre Screening is already completed.");
      case 404:
        throw new Error("Not Found: Invalid URL");
      case 500:
        throw new Error("Server Error: Please Check URL or try again later.");
      default:
        throw new Error(`Unexpected Error (${response.status}): ${await response.text()}`);
    }
      }

      const data = await response.json();

      if (data.status === "success" && data.messages.length > 0) {
        const botResponseContent: string = data.messages[0].message;
        const responseLines = botResponseContent.split('\n').filter(line => line.trim() !== '');

        const newBotMessages: Message[] = responseLines.map((line, index) => ({
          id: `bot-initial-${Date.now()}-${index}`,
          type: 'bot',
          content: line,
          timestamp: new Date(),
        }));

        setMessages(newBotMessages);
        setIsSessionActive(true);
      } else {
        throw new Error("Failed to start session: Invalid response format.");
      }
    } catch (error) {
      console.error("Error starting session:", error);
      alert(error);
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Sends a user message to the AI agent and handles the response
  const handleSendMessage = async (): Promise<void> => {
    const trimmedInput = inputValue.trim();
    if (!trimmedInput || isSending) return;

    // Check message length
    if (trimmedInput.length > MAX_MESSAGE_LENGTH) {
      showToast(`Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`, 'error');
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsSending(true);
    setIsTyping(true);

    try {
      const payload = {
        msg: trimmedInput,
        vars: [],
      };

      const response = await fetch("/api/agent/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.message === "success" && data.data.length > 0) {
        const botMessage: Message = {
          id: `bot-${Date.now()}`,
          type: "bot",
          content: data.data[0].message,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
      } else if (data.message === "error" && data.error === "Message too long") {
        showToast("Message is too long. Please shorten your message and try again.", 'error');
      } else {
        throw new Error("Invalid response from message API.");
      }
    } catch (error) {
      console.error("Error sending message:", error);

      const errorMessage: Message = {
        id: `bot-error-${Date.now()}`,
        type: "bot",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  // Closes the current chat session and resets state
  const handleCloseSession = async (): Promise<void> => {
    setIsClosingSession(true);
    try {
      const response = await fetch("/api/agent/session/delete", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();

      if (data.message === "success") {
        // Reset the chat state to the initial screen
        setMessages([]);
        setInputValue("");
        setIsSessionActive(false);
        setTermsAccepted(false); // Also reset terms agreement
      } else {
        throw new Error("Failed to close session.");
      }
    } catch (error) {
      console.error("Error closing session:", error);
      alert("Could not close the session properly. Please refresh the page.");
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

  // Dynamically adjusts textarea height as user types
  const adjustTextareaHeight = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ): void => {
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    setInputValue(textarea.value);
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
                  const isLastBotInSequence = message.type === "bot" && 
                    (index === messages.length - 1 || messages[index + 1]?.type !== "bot");
                  
                  return (
                    <div key={message.id} className="animate-fade-in">
                      {message.type === "bot" && (
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

                      {message.type === "user" && (
                        <div className="flex flex-col items-end justify-end">
                          <div className="bg-red-600 text-white rounded-lg p-4 max-w-2xl">
                            <p className="whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                                <span>Sent • {formatTime(message.timestamp)}</span>
                              </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex items-start space-x-3 animate-fade-in">
                    <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs">
                      AA
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-500 mb-2 flex items-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Adecco Agent is typing...
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
