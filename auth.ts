// auth.ts
import dotenv from 'dotenv';

// Initialize dotenv to load environment variables
dotenv.config();

// Get API key from environment variables
const OCTOPUS_API_KEY = process.env.OCTOPUS_API_KEY;
const GRAPHQL_ENDPOINT = 'https://api.octopus.energy/v1/graphql/';

/**
 * Get authentication token from Octopus Energy API
 * @returns Promise with the authentication token
 */
export async function getToken(): Promise<string> {
  if (!OCTOPUS_API_KEY) {
    throw new Error('OCTOPUS_API_KEY environment variable is not defined');
  }

  const tokenMutation = `
    mutation {
      obtainKrakenToken(input: {
        APIKey: "${OCTOPUS_API_KEY}"
      }) {
        token
      }
    }
  `;

  try {
    const tokenResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: tokenMutation
      })
    });

    const tokenData = await tokenResponse.json() as any;
    
    if (tokenResponse.status >= 400 || tokenData.errors) {
      throw new Error(`Authentication failed: ${JSON.stringify(tokenData.errors || tokenData)}`);
    }

    return tokenData.data.obtainKrakenToken.token;
  } catch (error) {
    throw new Error(`Error obtaining token: ${error instanceof Error ? error.message : String(error)}`);
  }
}