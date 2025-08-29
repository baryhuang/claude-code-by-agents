/**
 * AWS Lambda handler for Claude Code Web Agent
 * 
 * This module adapts the Hono application to work with AWS Lambda and API Gateway.
 */

import { handle } from 'hono/aws-lambda';
import { createApp } from './app.js';
import { NodeRuntime } from './runtime/node.js';

// Create runtime and app instance
const runtime = new NodeRuntime();

// Configure for Lambda environment
const app = createApp(runtime, {
  debugMode: process.env.NODE_ENV !== 'production',
  staticPath: './dist/static', // Static files are bundled in dist/static in Lambda package
  claudePath: 'claude', // Assume claude is available in Lambda environment or provided as layer
});

// Wrap the handler with error handling and logging
export const handler = async (event: any, context: any) => {
  try {
    console.log('Lambda Event:', JSON.stringify(event, null, 2));
    
    const result = await handle(app)(event, context);
    
    console.log('Lambda Response:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('Lambda Handler Error:', error);
    
    // Return proper Lambda proxy response format on error
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Amz-Date, Authorization, X-Api-Key, X-Amz-Security-Token, X-Requested-With',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        message: process.env.NODE_ENV !== 'production' ? error.message : 'An error occurred'
      }),
    };
  }
};