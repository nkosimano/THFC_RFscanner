// AWS Lambda function to generate a donation report from Zoho Inventory

import { getZohoAccessToken, makeZohoInventoryRequest } from '../utils/zohoApi.js';

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
    // Get parameters from query string
    const queryParams = event.queryStringParameters || {};
    const { start_date, end_date } = queryParams;
    
    // Validate required fields
    if (!start_date) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Start date is required'
        })
      };
    }
    
    if (!end_date) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'End date is required'
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
    
    // Fetch all donation batches (packages) in the date range
    const response = await makeZohoInventoryRequest(
      accessToken,
      'GET',
      `/api/v1/packages?date_start=${start_date}&date_end=${end_date}`
    );
    
    if (!response.packages) {
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          data: {
            donations: [],
            summary: {
              total_donations: 0,
              total_bread: 0,
              total_value: 0
            }
          }
        })
      };
    }
    
    // Process donation data
    const donations = response.packages.map(pkg => {
      // Extract custom field values
      const getCustomFieldValue = (label) => {
        const field = pkg.custom_fields.find(f => f.label === label);
        return field ? field.value : '0';
      };
      
      const totalBread = parseInt(getCustomFieldValue('Total Bread Quantity'), 10) || 0;
      const foodForwardQuantity = parseInt(getCustomFieldValue('Food Forward SA Quantity'), 10) || 0;
      const saHarvestQuantity = parseInt(getCustomFieldValue('SA Harvest Quantity'), 10) || 0;
      const upliftedQuantity = parseInt(getCustomFieldValue('Uplifted Stock Quantity'), 10) || 0;
      const thfcBakedQuantity = parseInt(getCustomFieldValue('THFC-Baked Stock Quantity'), 10) || 0;
      const valuePerLoaf = parseFloat(getCustomFieldValue('Value Per Loaf')) || 7.75;
      const totalValue = parseFloat(getCustomFieldValue('Total Donation Value')) || 0;
      
      // Extract date from package
      const donationDate = pkg.date;
      
      // Format crate IDs
      const crateIds = pkg.line_items.map(item => item.name).join(', ');
      
      // Return formatted donation data
      return {
        donation_date: donationDate,
        donation_quantity: totalBread,
        food_forward_quantity: foodForwardQuantity,
        sa_harvest_quantity: saHarvestQuantity,
        value_per_loaf: valuePerLoaf,
        total_value: totalValue,
        uplifted_stock: upliftedQuantity,
        thfc_baked: thfcBakedQuantity,
        reference: pkg.package_number,
        crate_ids: crateIds
      };
    });
    
    // Calculate summary
    const summary = {
      total_donations: donations.length,
      total_bread: donations.reduce((sum, donation) => sum + donation.donation_quantity, 0),
      total_value: donations.reduce((sum, donation) => sum + donation.total_value, 0),
      food_forward_total: donations.reduce((sum, donation) => sum + donation.food_forward_quantity, 0),
      sa_harvest_total: donations.reduce((sum, donation) => sum + donation.sa_harvest_quantity, 0),
      uplifted_stock_total: donations.reduce((sum, donation) => sum + donation.uplifted_stock, 0),
      thfc_baked_total: donations.reduce((sum, donation) => sum + donation.thfc_baked, 0)
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
        data: {
          donations,
          summary
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
