import { NextRequest, NextResponse } from "next/server";
import { generateNonce } from "@/features/wallet/services/generate-nonce";

/**
 * API route handler for generating a nonce for crypto wallet authentication.
 * 
 * Process overview:
 * - Receives a POST request with a wallet public address in the body.
 * - Validates the presence of `publicAddress`.
 * - Calls the nonce generation service which creates/saves the nonce (possibly in a DB or cache).
 * - Responds with the nonce and its expiration, or an error if something fails.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Log entry to the API handler for debugging/tracing request flow.
  console.log('API: /api/auth/crypto/generate-nonce - Processing POST request');

  try {
    // Extract the JSON body from the request, expecting `publicAddress` field
    const { publicAddress } = await req.json();

    // Validate input: Ensure the request provides a publicAddress to proceed.
    if (!publicAddress) {
      console.error('API: /api/auth/crypto/generate-nonce - Public address not provided');
      return NextResponse.json({ error: "Public address is required" }, { status: 400 });
    }

    // Call service layer: generate a new nonce for the given publicAddress.
    // Assumes generateNonce handles any invalid address format/etc itself.
    const { nonce, expires } = await generateNonce(publicAddress);

    // Respond to client: Send the newly generated nonce and its expiration.
    console.log('API: /api/auth/crypto/generate-nonce - Nonce generated successfully');
    return NextResponse.json({ nonce, expires });
  } catch (error) {
    // Log the error for debugging; return a generic error message to client.
    console.error('API: /api/auth/crypto/generate-nonce - Error generating nonce:', error);
    // TODO: Use standardized error responses (see Next.js 13+ API improvements).
    // TODO: Consider request schema validation (e.g., with Zod) before using the data.
    return NextResponse.json({ error: "Failed to generate nonce" }, { status: 500 });
  }
}
