/*
  This API ends the current chat session by deleting it from Salesforce.
  It uses Einstein AI Agent API to delete the session.
  It retrieves the session ID from cookies, gets an access token from Salesforce, and deletes the session.
*/

import { getSalesforceAccessV2Token } from "@/app/lib/salesforceAuthV2";
import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

const SF_API = process.env.SF_API_HOST ?? "";

export async function DELETE(req: NextRequest) {
  // Retrieve the chat session ID from cookies
  const chatSession = req.cookies.get("chatSession")?.value;
  let sessionId = "";

  if(chatSession){
    sessionId = JSON.parse(chatSession).sessionId;
  }
  
  try {
    // Get Salesforce access token for API requests
    const response = await getSalesforceAccessV2Token();
    const { access_token } = await response.json();

    // If no session ID, return a message to the client
    if (!sessionId) {
      return NextResponse.json(
        { message: "Invalid Session ID" },
        { status: 200 }
      );
    }

    try {
      // Construct the endpoint for deleting the chat session
      const endpoint = `${SF_API}/einstein/ai-agent/v1/sessions/${sessionId}`;

      // Call the Salesforce API to delete/end the session
      await axios.delete(endpoint, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          "x-session-end-reason": "UserRequest",
        },
      });
      
      // Prepare the response and delete the session cookie
      const response = NextResponse.json({ message: "success" }, { status: 200 });
      response.cookies.delete("chatSession");
      return response;

    } catch (error) {
      // Handle errors in deleting the session
      console.log("Error deleting session: " + error);
      return NextResponse.json(
        { message: "Failed to delete session" },
        { status: 500 }
      );
    }
  } catch (error) {
    // Handle errors in getting the access token
    console.log("Error getting access token: " + error);
    return NextResponse.json(
      { message: "Failed to get token" },
      { status: 500 }
    );
  }
}
