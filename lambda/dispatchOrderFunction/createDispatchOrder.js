// AWS Lambda function to create a dispatch order in Zoho Inventory

import { getZohoAccessToken, createDispatchOrder } from '../utils/zohoApi.js';

// CORS headers for Lambda responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // In production, restrict to your actual domain
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST',
  'Access-Control-Allow-Credentials': true
};

// Main handler function
export async function handler(event, context) {
  // For preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }
  
  try {
    // Parse the incoming request body
    const requestBody = JSON.parse(event.body || '{}');
    const { 
      dispatch_order_ref, 
      crate_items, 
      destination_warehouse 
    } = requestBody;
    
    // Validate required fields
    if (!dispatch_order_ref) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Dispatch order reference is required'
        })
      };
    }
    
    if (!crate_items || !Array.isArray(crate_items) || crate_items.length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'At least one crate item is required'
        })
      };
    }
    
    // Verify authorization
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Not authenticated'
        })
      };
    }
    
    // Get access token for Zoho API
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    if (!refreshToken) {
      throw new Error('Zoho refresh token not configured');
    }
    
    const accessToken = await getZohoAccessToken(refreshToken);
    
    // Create dispatch order in Zoho Inventory
    const dispatchOrderResponse = await createDispatchOrder(
      accessToken,
      dispatch_order_ref,
      crate_items,
      destination_warehouse || 'Spar DC'
    );
    
    // Return success response
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: {
          dispatch_order_ref: dispatch_order_ref,
          dispatch_order_id: dispatchOrderResponse.salesorder.salesorder_id,
          status: dispatchOrderResponse.salesorder.status,
          message: 'Dispatch order created successfully in Zoho Inventory'
        }
      })
    };
    
  } catch (error) {
    console.error('Error processing request:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to process request: ' + (error.message || 'Unknown error')
      })
    };
  }
};
