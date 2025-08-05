// This module handles Salesforce authentication using the OAuth 2.0 Client Credentials flow.
// It retrieves and caches an access token from Salesforce for API requests.
// This access token is used to communicate with the connected app in salesforce.
import axios from "axios";
import { NextResponse } from "next/server";

// Salesforce environment variables for authentication
const SF_DOMAIN = process.env.SF_DOMAIN ?? "";
const SF_CLIENT_ID = process.env.SF_CLIENT_ID ?? "";
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET ?? "";

// In-memory cache for the access token and its expiry time
let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

// Main function to get (and cache) Salesforce access token
export async function getSalesforceAccessV2Token() {
  const now = Date.now();
  // Return cached token if still valid (with 1 minute buffer)
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt - 60_000) {
    return NextResponse.json(
      { message: "success", access_token: cachedToken },
      { status: 200 }
    );
  }

  // Salesforce token endpoint
  const endpoint = `${SF_DOMAIN}/services/oauth2/token`;

  // Prepare parameters for the client credentials grant
  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", SF_CLIENT_ID);
  params.append("client_secret", SF_CLIENT_SECRET);

  try {
    // Request a new access token from Salesforce
    const response = await axios.post(endpoint, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const { access_token, expires_in } = response.data;
    // Cache the token and its expiry time
    cachedToken = access_token;
    tokenExpiresAt = now + expires_in * 1000;
    return NextResponse.json(
      { message: "success", access_token: response.data.access_token },
      { status: 200 }
    );
  } catch (error) {
    // Log and return error response if token retrieval fails
    console.log("Error getting access token: " + error);
    return NextResponse.json(
      { message: "failed", access_token: "" },
      { status: 500 }
    );
  }
}
