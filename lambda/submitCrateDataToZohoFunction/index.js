// AWS Lambda function to submit crate data to Zoho

const { 
  getZohoAccessToken, 
  getZohoInventoryItem,
  updateZohoInventoryStock,
  updateItemCustomFields,
  getDispatchOrder
} = require('../utils/zohoApi');

// CORS headers for Lambda responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // In production, restrict to your actual domain
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST',
  'Access-Control-Allow-Credentials': true
};

// Main handler function
exports.handler = async (event, context) => {
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
      crate_id_input, 
      bread_quantity, 
      device_scan_id, 
      is_offline_scan,
      stock_source,
      dispatch_order_ref,
      donation_batch_ref,
      location
    } = requestBody;
    
    // Validate required fields
    if (!crate_id_input) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Crate ID is required'
        })
      };
    }
    
    if (bread_quantity === undefined || bread_quantity === null) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Bread quantity is required'
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
    
    // Check if crate exists in Zoho Inventory
    let crateItem;
    try {
      const itemResponse = await getZohoInventoryItem(accessToken, crate_id_input);
      crateItem = itemResponse.item;
    } catch (error) {
      return {
        statusCode: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: `Crate not found in Zoho Inventory: ${crate_id_input}`
        })
      };
    }
    
    // Set warehouse based on location or use default
    const warehouse = location || 'Warehouse';
    
    // Update crate stock in Zoho Inventory
    await updateZohoInventoryStock(
      accessToken,
      crateItem.item_id,
      bread_quantity,
      warehouse,
      'set' // Set the stock to the new value
    );
    
    // Add custom field data for stock source if provided
    if (stock_source) {
      await updateItemCustomFields(
        accessToken,
        crateItem.item_id,
        [
          {
            label: 'Stock Source',
            value: stock_source
          }
        ]
      );
    }
    
    // Associate with dispatch order if provided
    let dispatchOrderData = null;
    if (dispatch_order_ref) {
      try {
        // Check if dispatch order exists, if not create it
        let dispatchOrder = await getDispatchOrder(accessToken, dispatch_order_ref);
        
        // Add this crate to the dispatch order
        // This would require additional implementation details
        dispatchOrderData = {
          reference: dispatch_order_ref,
          status: dispatchOrder.status
        };
      } catch (error) {
        console.warn(`Dispatch order ${dispatch_order_ref} not found:`, error.message);
      }
    }
    
    // Associate with donation batch if provided
    let donationBatchData = null;
    if (donation_batch_ref) {
      try {
        // Add this crate to the donation batch
        // This would require additional implementation details
        donationBatchData = {
          reference: donation_batch_ref
        };
      } catch (error) {
        console.warn(`Donation batch ${donation_batch_ref} not found:`, error.message);
      }
    }
    
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
          crate_id: crate_id_input,
          bread_quantity: bread_quantity,
          stock_source: stock_source,
          warehouse: warehouse,
          dispatch_order: dispatchOrderData,
          donation_batch: donationBatchData,
          last_updated: new Date().toISOString(),
          message: 'Crate data submitted successfully to Zoho Inventory'
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
