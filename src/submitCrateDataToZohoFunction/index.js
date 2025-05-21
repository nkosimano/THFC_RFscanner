// Example AWS Lambda function for submitting crate data to Zoho
// This would be deployed as a separate Lambda function

const { createClient } = require('@supabase/supabase-js');
// Consider adding an HTTP client like axios or ensure fetch is available
// const fetch = require('node-fetch'); // Or use axios: const axios = require('axios');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to validate JWT token (in production, use a proper JWT library)
const validateToken = (token) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId, timestamp] = decoded.split(':');
    const expirationTime = parseInt(timestamp) + 24 * 60 * 60 * 1000;
    if (Date.now() > expirationTime) {
      return null;
    }
    return userId;
  } catch (error) {
    return null;
  }
};

exports.handler = async (event) => {
  try {
    // Check authentication
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          error: 'Authorization required'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    const token = authHeader.split(' ')[1];
    const userId = validateToken(token);
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          error: 'Invalid or expired token'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // --- Start: Submit Crate Data to Zoho Logic ---
    const crateData = JSON.parse(event.body); // Assuming crate data is in the event body
    
    // ** CONFIRM AND SET THESE AS ENVIRONMENT VARIABLES IN YOUR LAMBDA **
    const zohoApiModuleEndpoint = process.env.ZOHO_API_MODULE_ENDPOINT; // e.g., https://www.zohoapis.com/inventory/v1/items
    const zohoOrgId = process.env.ZOHO_ORGANIZATION_ID; // This will be '888009057' for you
    const zohoAuthToken = process.env.ZOHO_AUTHTOKEN;

    if (!zohoApiModuleEndpoint || !zohoOrgId || !zohoAuthToken) {
        console.error('Zoho API configuration missing in environment variables. Ensure ZOHO_API_MODULE_ENDPOINT, ZOHO_ORGANIZATION_ID, and ZOHO_AUTHTOKEN are set.');
        return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: 'Zoho API configuration error' }),
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        };
    }

    // Construct the Zoho API URL
    // The Zoho API might expect authtoken in headers or as a query param.
    // The example in the documentation showed it as a query param for GET.
    // For POST, it's often in an Authorization header.
    // **Refer to Zoho's specific API documentation for the module you are using.**
    
    // Option 1: Authtoken as a query parameter
    const fullZohoUrl = `${zohoApiModuleEndpoint}?organization_id=${zohoOrgId}&authtoken=${zohoAuthToken}`;
    
    // Option 2: Authtoken in Authorization header (more common for POST)
    // const fullZohoUrl = `${zohoApiModuleEndpoint}?organization_id=${zohoOrgId}`;
    // const headers = {
    //   'Content-Type': 'application/json',
    //   'Authorization': `Zoho-oauthtoken ${zohoAuthToken}` // or `authtoken ${zohoAuthToken}` or `Bearer ${zohoAuthToken}`
    // };

    const zohoPayload = {
      // This is a generic example; you'll need to adapt it based on Zoho's API for the specific module.
      // e.g., for creating an item:
      // item_name: crateData.name,
      // description: crateData.description,
      // rate: crateData.price,
      // unit: "pcs", // Example: if crates are sold in pieces
      // ... other fields Zoho expects for the module (e.g., items, composite_items)
      ...crateData // Or map your crateData fields to Zoho's expected fields
    };

    console.log("Sending data to Zoho:", fullZohoUrl, JSON.stringify(zohoPayload));

    // **Choose the fetch call that matches how your authtoken needs to be sent**
    // Using Option 1 (authtoken in URL) for this example structure:
    const zohoResponse = await fetch(fullZohoUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // If using Option 2, add Authorization header here:
        // 'Authorization': `Zoho-oauthtoken ${zohoAuthToken}`,
      },
      body: JSON.stringify(zohoPayload),
    });

    const responseText = await zohoResponse.text(); // Get text for logging, regardless of ok status
    if (!zohoResponse.ok) {
      console.error(`Zoho API error: ${zohoResponse.status}`, responseText);
      return {
        statusCode: zohoResponse.status, // Return Zoho's status code
        body: JSON.stringify({
          success: false,
          error: 'Failed to submit data to Zoho',
          zoho_error_details: responseText 
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    const zohoResult = JSON.parse(responseText); // Parse if response is ok
    // --- End: Submit Crate Data to Zoho Logic ---

    return {
      statusCode: 200, // Or map from zohoResult.code if appropriate (e.g., 201 for created)
      body: JSON.stringify({
        success: true,
        message: 'Data submitted to Zoho successfully',
        zoho_response: zohoResult
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };

  } catch (error) {
    console.error('Internal server error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Internal server error', details: error.message }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};