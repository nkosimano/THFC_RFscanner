// AWS Lambda function to fetch crate details from Zoho Inventory

import { getZohoAccessToken, getZohoInventoryItem } from '../utils/zohoApi.js';

// CORS headers for Lambda responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // In production, restrict to your actual domain
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST',
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
    // Get crate ID from query parameters or request body
    let crateId;
    
    if (event.httpMethod === 'GET') {
      // Parse query parameters
      const queryParams = event.queryStringParameters || {};
      crateId = queryParams.crateId;
    } else if (event.httpMethod === 'POST') {
      // Parse request body
      const requestBody = JSON.parse(event.body || '{}');
      crateId = requestBody.crateId;
    }
    
    // Validate required fields
    if (!crateId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Crate ID is required'
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
    
    // Fetch crate details from Zoho Inventory
    let crateItem;
    try {
      const itemResponse = await getZohoInventoryItem(accessToken, crateId);
      crateItem = itemResponse.item;
    } catch (error) {
      console.error(`Error fetching crate ${crateId} from Zoho:`, error);
      return {
        statusCode: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: `Crate not found in Zoho Inventory: ${crateId}`
        })
      };
    }
    
    // Extract relevant crate details
    const crateDetails = {
      crate_id: crateId,
      bread_quantity: crateItem.available_stock || 0,
      location: crateItem.warehouse_name || 'Unknown',
      status: crateItem.status || 'active',
      last_updated: crateItem.last_modified_time || new Date().toISOString(),
      last_updated_by: crateItem.last_modified_by || 'System',
      zoho_item_id: crateItem.item_id
    };
    
    // Return success response
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: crateDetails
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
