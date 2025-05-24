// AWS Lambda function to create a donation batch in Zoho Inventory

import { getZohoAccessToken, createDonationBatch } from '../utils/zohoApi.js';

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
      donation_batch_ref, 
      crate_items, 
      source_breakdown 
    } = requestBody;
    
    // Validate required fields
    if (!donation_batch_ref) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Donation batch reference is required'
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
    
    if (!source_breakdown || typeof source_breakdown !== 'object') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Source breakdown is required'
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
    
    // Create donation batch in Zoho Inventory
    const donationBatchResponse = await createDonationBatch(
      accessToken,
      donation_batch_ref,
      crate_items,
      source_breakdown
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
          donation_batch_ref: donation_batch_ref,
          package_id: donationBatchResponse.package.package_id,
          total_bread: donationBatchResponse.package.custom_fields.find(f => f.label === 'Total Bread Quantity')?.value || '0',
          food_forward_quantity: donationBatchResponse.package.custom_fields.find(f => f.label === 'Food Forward SA Quantity')?.value || '0',
          sa_harvest_quantity: donationBatchResponse.package.custom_fields.find(f => f.label === 'SA Harvest Quantity')?.value || '0',
          total_value: donationBatchResponse.package.custom_fields.find(f => f.label === 'Total Donation Value')?.value || '0',
          message: 'Donation batch created successfully in Zoho Inventory'
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
