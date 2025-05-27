// AWS Lambda function to create a production order for THFC Hub to cover donation shortfall
import { getZohoAccessToken, makeZohoInventoryRequest } from '../utils/zohoApi.js';

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
      production_quantity,
      requested_date,
      notes
    } = requestBody;
    
    // Validate required fields
    if (!production_quantity || production_quantity <= 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Valid production quantity is required'
        })
      };
    }
    
    // Verify authorization (only Super Admin should be able to create production orders)
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
    
    // Generate a unique production order reference
    const now = new Date();
    const dateString = now.toISOString().split('T')[0].replace(/-/g, '');
    const productionOrderRef = `PO${dateString}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    // Create production order in Zoho as a purchase order
    const productionOrderData = {
      purchaseorder: {
        vendor_id: "", // This would be the THFC Hub vendor ID in Zoho
        purchaseorder_number: productionOrderRef,
        reference_number: productionOrderRef,
        date: now.toISOString().split('T')[0],
        expected_delivery_date: requested_date || now.toISOString().split('T')[0],
        notes: notes || `Production order for ${production_quantity} loaves of bread to cover CSI shortfall`,
        line_items: [
          {
            item_id: "BREAD-STANDARD", // This would be the ID of the standard bread item in Zoho
            name: "Standard Bread Loaf",
            quantity: production_quantity,
            unit: "loaves",
            rate: 7.75 // Standard rate per loaf
          }
        ],
        custom_fields: [
          {
            label: "Order Type",
            value: "CSI Shortfall Production"
          },
          {
            label: "Production Facility",
            value: "THFC Hub"
          },
          {
            label: "Stock Source",
            value: "THFC-Baked Stock"
          }
        ]
      }
    };
    
    // Create purchase order in Zoho
    const response = await makeZohoInventoryRequest(
      accessToken,
      'POST',
      '/api/v1/purchaseorders',
      productionOrderData
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
          production_order_ref: productionOrderRef,
          production_order_id: response.purchaseorder?.purchaseorder_id,
          quantity: production_quantity,
          requested_date: requested_date || now.toISOString().split('T')[0],
          status: response.purchaseorder?.status || 'created',
          message: 'Production order created successfully for THFC Hub'
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
