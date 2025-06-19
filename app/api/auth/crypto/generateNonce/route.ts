import { NextRequest, NextResponse } from "next/server";
import { generateNonce } from "@/services/wallet/generate-nonce";

/**
 * API route handler for generating a nonce for crypto wallet authentication.
 * 
 * This function performs the following steps:
 * 1. Extracts the public address from the request body.
 * 2. Calls the generateNonce service function to create and store a nonce.
 * 3. Returns the nonce and its expiration time in the response.
 * 
 * User steps:
 * 1. User initiates crypto wallet login on the frontend.
 * 2. Frontend sends a POST request to this endpoint with the user's public address.
 * 3. Endpoint generates a nonce and responds with the nonce and its expiration time.
 * 4. Frontend uses the nonce for wallet signature and further authentication steps.
 * 
 * @param {NextRequest} req - The incoming request object.
 * @returns {Promise<NextResponse>} A promise that resolves to a NextResponse object containing the nonce and expiration time, or an error message.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  console.log('API: /api/auth/crypto/generate-nonce - Processing POST request');

  try {
    // Step 1: Extract public address from request body
    const { publicAddress } = await req.json();

    if (!publicAddress) {
      console.error('API: /api/auth/crypto/generate-nonce - Public address not provided');
      return NextResponse.json({ error: "Public address is required" }, { status: 400 });
    }

    // Step 2: Generate nonce using the service function
    const { nonce, expires } = await generateNonce(publicAddress);

    // Step 3: Return the nonce and expiration time
    console.log('API: /api/auth/crypto/generate-nonce - Nonce generated successfully');
    return NextResponse.json({ nonce, expires });
  } catch (error) {
    console.error('API: /api/auth/crypto/generate-nonce - Error generating nonce:', error);
    return NextResponse.json({ error: "Failed to generate nonce" }, { status: 500 });
  }
}

