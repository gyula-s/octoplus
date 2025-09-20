// auth.ts
import dotenv from 'dotenv';
import { OctopusAccount } from './accounts';

// Initialize dotenv to load environment variables
dotenv.config();

const GRAPHQL_ENDPOINT = 'https://api.octopus.energy/v1/graphql/';

/**
 * Get authentication token from Octopus Energy API for a specific account
 * @param account - The Octopus account to authenticate
 * @returns Promise with the authentication token
 */
export async function getToken(account: OctopusAccount): Promise<string> {
  const tokenMutation = `
    mutation {
      obtainKrakenToken(input: {
        APIKey: "${account.apiKey}"
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