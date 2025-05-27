// AWS Lambda function to calculate CSI target based on dispatch order volume
import { getZohoAccessToken, calculateCSIDonationTarget } from '../utils/zohoApi.js';

// CORS headers for Lambda responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // In production, restrict to your actual domain
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,GET',
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
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    let { start_date, end_date } = queryParams;
    
    // If no dates specified, use the current week
    if (!start_date || !end_date) {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
      
      start_date = startOfWeek.toISOString().split('T')[0];
      end_date = endOfWeek.toISOString().split('T')[0];
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
    
    // Calculate CSI target based on finalized dispatch orders
    const targetData = await calculateCSIDonationTarget(
      accessToken,
      start_date,
      end_date
    );
    
    // Get current donation totals for the period
    const currentDonations = await getCurrentDonationTotals(
      accessToken,
      start_date,
      end_date
    );
    
    // Calculate shortfall
    const shortfall = Math.max(0, targetData.target - currentDonations.total_donated);
    
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
          start_date,
          end_date,
          total_dispatched: targetData.total_dispatched,
          csi_target_percentage: 5.9,
          csi_target_quantity: targetData.target,
          current_donations: {
            uplifted_stock: currentDonations.uplifted_stock,
            thfc_baked_stock: currentDonations.thfc_baked_stock,
            total_donated: currentDonations.total_donated
          },
          shortfall,
          dispatch_orders: targetData.dispatch_orders
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
}

/**
 * Get current donation totals for a specific date range
 * @param {string} accessToken - Zoho access token
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Donation totals
 */
async function getCurrentDonationTotals(accessToken, startDate, endDate) {
  // This would make an API call to get donation packages in the date range
  // For now, we'll implement a simplified version
  
  // Import the makeZohoInventoryRequest function
  const { makeZohoInventoryRequest } = await import('../utils/zohoApi.js');
  
  // Get all packages (donation batches) in the date range
  const response = await makeZohoInventoryRequest(
    accessToken,
    'GET',
    `/api/v1/packages?date_start=${startDate}&date_end=${endDate}`
  );
  
  let upliftedStock = 0;
  let thfcBakedStock = 0;
  
  // Process each donation batch to sum up the sources
  if (response.packages && response.packages.length > 0) {
    response.packages.forEach(pkg => {
      if (pkg.custom_fields) {
        // Find uplifted stock quantity
        const upliftedField = pkg.custom_fields.find(f => f.label === 'Uplifted Stock Quantity');
        if (upliftedField && upliftedField.value) {
          upliftedStock += parseInt(upliftedField.value, 10);
        }
        
        // Find THFC-baked stock quantity
        const thfcBakedField = pkg.custom_fields.find(f => f.label === 'THFC-Baked Stock Quantity');
        if (thfcBakedField && thfcBakedField.value) {
          thfcBakedStock += parseInt(thfcBakedField.value, 10);
        }
      }
    });
  }
  
  const totalDonated = upliftedStock + thfcBakedStock;
  
  return {
    uplifted_stock: upliftedStock,
    thfc_baked_stock: thfcBakedStock,
    total_donated: totalDonated
  };
}
