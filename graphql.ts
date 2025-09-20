import { getToken } from './auth';
import { OctopusAccount } from './accounts';

// Constants
const GRAPHQL_ENDPOINT = 'https://api.octopus.energy/v1/graphql/';

interface GraphQLVariables {
    [key: string]: any;
}

interface GraphQLQueryObject {
    operation: string;
    query: string;
    variables?: GraphQLVariables;
}

interface GraphQLRequest {
    operationName: string;
    variables?: GraphQLVariables;
    query: string;
}

interface GraphQLResponse {
    data?: any;
    errors?: any[];
}

/**
 * Makes a GraphQL request to the Octopus Energy API
 * @param operationName The name of the GraphQL operation
 * @param query The GraphQL query string
 * @param additionalVariables Any additional variables beyond the default accountNumber
 * @returns The GraphQL response data
 */
export async function makeGraphQLRequest(
    operationName: string,
    query: string,
    account: OctopusAccount,
    additionalVariables: GraphQLVariables = {}
): Promise<GraphQLResponse> {
    try {
        // Get authentication token for this account
        const token = await getToken(account);
        
        // Prepare the request body with default variables
        const variables = {
            accountNumber: account.accountNumber,
            ...additionalVariables
        };

        const requestBody: GraphQLRequest = {
            operationName,
            variables,
            query
        };

        // Make the GraphQL request
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json() as GraphQLResponse;

        // Check for HTTP errors
        if (response.status < 200 || response.status >= 300) {
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
        }

        // Check for GraphQL errors
        if (data.errors && data.errors.length > 0) {
            throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
        }

        return data;

    } catch (error) {
        console.error('GraphQL request failed:', error);
        throw error;
    }
}

/**
 * Convenience function for making GraphQL queries that expect a successful response
 * Throws an error if the request fails or returns errors
 * @param account The Octopus account to use for authentication
 * @param queryObjectOrOperationName Either a query object with {operation, query, variables} or an operation name string
 * @param queryOrVariables Either the GraphQL query string (if first param is string) or additional variables (if first param is object)
 * @param additionalVariables Additional variables (only used when first param is string)
 * @returns The response data (without the 'data' wrapper)
 */
export async function executeGraphQLQuery(
    account: OctopusAccount,
    queryObjectOrOperationName: GraphQLQueryObject | string,
    queryOrVariables?: string | GraphQLVariables,
    additionalVariables: GraphQLVariables = {}
): Promise<any> {
    let operationName: string;
    let query: string;
    let variables: GraphQLVariables;

    if (typeof queryObjectOrOperationName === 'object') {
        // Using the object structure
        operationName = queryObjectOrOperationName.operation;
        query = queryObjectOrOperationName.query;
        // Merge default variables from query object with additional variables
        variables = {
            ...(queryObjectOrOperationName.variables || {}),
            ...((queryOrVariables as GraphQLVariables) || {})
        };
    } else {
        // Using the traditional structure
        operationName = queryObjectOrOperationName;
        query = queryOrVariables as string;
        variables = additionalVariables;
    }

    const response = await makeGraphQLRequest(operationName, query, account, variables);
    return response.data;
}