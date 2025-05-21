// Example AWS Lambda function for submitting crate data to Zoho
// This would be deployed as a separate Lambda function

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to validate JWT token (in production, use a proper JWT library)
const validateToken = (token) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId, timestamp] = decoded.split(':');
    
    // Check if token is expired (24 hour validity for this example)
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
    
    // Get the user to check role and permissions
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .eq('is_active', true)
      .single();
    
    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          error: 'User not found or inactive'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // Parse request body
    const { crateId, defaultBreadQuantity, actualBreadQuantity } = JSON.parse(event.body);
    
    // Validate input
    if (!crateId || actualBreadQuantity === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Crate ID and actual bread quantity are required'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
    
    // In a real implementation, this would connect to Zoho Warehouse API
    // For this example, we'll log the data and return a success response
    
    console.log('Submitting crate data to Zoho:', {
      crateId,
      defaultBreadQuantity,
      actualBreadQuantity,
      submittedBy: userId,
      submissionTime: new Date().toISOString()
    });
    
    // Simulate storing the submission in Supabase (in a real app, you'd create a crate_submissions table)
    // const { data, error } = await supabase
    //   .from('crate_submissions')
    //   .insert({
    //     crate_id: crateId,
    //     default_quantity: defaultBreadQuantity,
    //     actual_quantity: actualBreadQuantity,
    //     user_id: userId,
    //     status: 'pending' // Status before syncing with Zoho
    //   });
    
    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: {
          message: 'Crate data submitted successfully'
        }
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
    
  } catch (error) {
    console.error('Crate submission error:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};