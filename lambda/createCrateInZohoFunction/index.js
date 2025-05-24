// AWS Lambda function to create a new crate in Zoho Inventory

import { getZohoAccessToken, createZohoInventoryItem, getZohoInventoryItem } from '../utils/zohoApi.js';

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
    const { crate_id, location, initial_bread_quantity } = requestBody;
    
    // Validate required fields
    if (!crate_id) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Crate ID is required'
        })
      };
    }
    
    // Verify authorization (you can implement your own logic)
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
    
    // Check if crate ID already exists to avoid duplicates
    try {
      await getZohoInventoryItem(accessToken, crate_id);
      // If we get here, the crate already exists
      return {
        statusCode: 409, // Conflict
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: `Crate with ID ${crate_id} already exists in Zoho Inventory`
        })
      };
    } catch (error) {
      // Item not found, which is what we want - proceed with creation
      console.log(`Crate ID ${crate_id} not found in Zoho, proceeding with creation`);
    }
    
    // Create item in Zoho Inventory
    const zohoResponse = await createZohoInventoryItem(accessToken, {
      name: crate_id,
      sku: crate_id,
      description: `THFC Bread Crate - ${crate_id}`,
      unit: 'pcs',
      is_returnable: true,
      item_type: 'inventory',
      initial_stock: initial_bread_quantity || 0,
      initial_stock_location: location || 'Warehouse',
    });
    
    // Return success response
    return {
      statusCode: 201, // Created
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: {
          crate_id: crate_id,
          zoho_item_id: zohoResponse.item?.item_id,
          initial_bread_quantity: initial_bread_quantity || 0,
          location: location || 'Warehouse',
          message: 'Crate created successfully in Zoho Inventory'
        }
      })
    };
    
  } catch (error) {
    console.error('Error creating crate in Zoho:', error);
    
    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to create crate in Zoho: ' + (error.message || 'Unknown error')
      })
    };
  }
};
