// AWS Lambda function for user authentication and management
import { getZohoAccessToken, makeZohoInventoryRequest } from '../utils/zohoApi.js';

// CORS headers for Lambda responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // In production, restrict to your actual domain
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
  'Access-Control-Allow-Credentials': true
};

// User roles
const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  LOGISTICS_COORDINATOR: 'logistics_coordinator',
  PRODUCTION_OPERATOR_PRIMARY: 'production_operator_primary',
  PRODUCTION_OPERATOR_THFC: 'production_operator_thfc',
  CSI_FIELD_WORKER: 'csi_field_worker'
};

// Location types
const LOCATIONS = {
  PRIMARY_HUB: 'primary_hub',
  THFC_HUB: 'thfc_hub',
  FIELD: 'field',
  HEAD_OFFICE: 'head_office'
};

// User permissions by role
const ROLE_PERMISSIONS = {
  [USER_ROLES.SUPER_ADMIN]: {
    canCreateUsers: true,
    canManageSystem: true,
    canCreateDispatchOrders: true,
    canFinalizeDispatchOrders: true,
    canCreateDonationBatches: true,
    canCalculateCSITargets: true,
    canGenerateReports: true,
    canCreateProductionOrders: true,
    canScanCrates: true,
    allowedLocations: [LOCATIONS.PRIMARY_HUB, LOCATIONS.THFC_HUB, LOCATIONS.FIELD, LOCATIONS.HEAD_OFFICE]
  },
  [USER_ROLES.LOGISTICS_COORDINATOR]: {
    canCreateUsers: false,
    canManageSystem: false,
    canCreateDispatchOrders: true,
    canFinalizeDispatchOrders: true,
    canCreateDonationBatches: false,
    canCalculateCSITargets: false,
    canGenerateReports: true,
    canCreateProductionOrders: false,
    canScanCrates: true,
    allowedLocations: [LOCATIONS.PRIMARY_HUB]
  },
  [USER_ROLES.PRODUCTION_OPERATOR_PRIMARY]: {
    canCreateUsers: false,
    canManageSystem: false,
    canCreateDispatchOrders: false,
    canFinalizeDispatchOrders: false,
    canCreateDonationBatches: false,
    canCalculateCSITargets: false,
    canGenerateReports: false,
    canCreateProductionOrders: false,
    canScanCrates: true,
    allowedLocations: [LOCATIONS.PRIMARY_HUB]
  },
  [USER_ROLES.PRODUCTION_OPERATOR_THFC]: {
    canCreateUsers: false,
    canManageSystem: false,
    canCreateDispatchOrders: false,
    canFinalizeDispatchOrders: false,
    canCreateDonationBatches: false,
    canCalculateCSITargets: false,
    canGenerateReports: false,
    canCreateProductionOrders: false,
    canScanCrates: true,
    allowedLocations: [LOCATIONS.THFC_HUB]
  },
  [USER_ROLES.CSI_FIELD_WORKER]: {
    canCreateUsers: false,
    canManageSystem: false,
    canCreateDispatchOrders: false,
    canFinalizeDispatchOrders: false,
    canCreateDonationBatches: false,
    canCalculateCSITargets: false,
    canGenerateReports: false,
    canCreateProductionOrders: false,
    canScanCrates: true,
    allowedLocations: [LOCATIONS.FIELD]
  }
};

/**
 * Authenticates a user and returns their profile with permissions
 */
export async function authenticateUser(event, context) {
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
    const { email, password } = requestBody;
    
    // Validate required fields
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Email and password are required'
        })
      };
    }
    
    // In a real implementation, this would validate against a user database
    // For this example, we'll simulate user authentication
    const user = await getUserByEmail(email);
    
    if (!user || !validateUserPassword(user, password)) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Invalid email or password'
        })
      };
    }
    
    // Generate auth token (in a real implementation, this would be a JWT)
    const authToken = generateAuthToken(user);
    
    // Get role permissions
    const permissions = ROLE_PERMISSIONS[user.role] || ROLE_PERMISSIONS[USER_ROLES.CSI_FIELD_WORKER];
    
    // Return user profile with token and permissions
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            location: user.location
          },
          permissions,
          token: authToken
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
 * Creates a new user (Super Admin only)
 */
export async function createUser(event, context) {
  // For preflight OPTIONS requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }
  
  try {
    // Verify authorization (only Super Admin can create users)
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
    
    // Verify that the authenticated user is a Super Admin
    const currentUser = await getUserFromToken(authHeader.replace('Bearer ', ''));
    if (!currentUser || currentUser.role !== USER_ROLES.SUPER_ADMIN) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Only Super Admins can create users'
        })
      };
    }
    
    // Parse the incoming request body
    const requestBody = JSON.parse(event.body || '{}');
    const { name, email, password, role, location } = requestBody;
    
    // Validate required fields
    if (!name || !email || !password || !role || !location) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'All fields are required (name, email, password, role, location)'
        })
      };
    }
    
    // Validate role
    if (!Object.values(USER_ROLES).includes(role)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Invalid role'
        })
      };
    }
    
    // Validate location
    if (!Object.values(LOCATIONS).includes(location)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: 'Invalid location'
        })
      };
    }
    
    // Create new user (in a real implementation, this would create a record in a database)
    const newUser = await createUserInDatabase({
      name,
      email,
      password, // Would be hashed in a real implementation
      role,
      location
    });
    
    // Return success response
    return {
      statusCode: 201,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        data: {
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            location: newUser.location
          },
          message: 'User created successfully'
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

// Helper functions (in a real implementation, these would interact with a database)
async function getUserByEmail(email) {
  // This is a mock implementation
  // In a real implementation, this would query a database
  const mockUsers = [
    {
      id: '1',
      name: 'Super Admin',
      email: 'admin@thfc.com',
      password: 'admin123', // Would be hashed in a real implementation
      role: USER_ROLES.SUPER_ADMIN,
      location: LOCATIONS.HEAD_OFFICE
    },
    {
      id: '2',
      name: 'Logistics Coordinator',
      email: 'logistics@thfc.com',
      password: 'logistics123', // Would be hashed in a real implementation
      role: USER_ROLES.LOGISTICS_COORDINATOR,
      location: LOCATIONS.PRIMARY_HUB
    },
    {
      id: '3',
      name: 'Production Operator',
      email: 'production@thfc.com',
      password: 'production123', // Would be hashed in a real implementation
      role: USER_ROLES.PRODUCTION_OPERATOR_PRIMARY,
      location: LOCATIONS.PRIMARY_HUB
    },
    {
      id: '4',
      name: 'THFC Production',
      email: 'thfc@thfc.com',
      password: 'thfc123', // Would be hashed in a real implementation
      role: USER_ROLES.PRODUCTION_OPERATOR_THFC,
      location: LOCATIONS.THFC_HUB
    },
    {
      id: '5',
      name: 'CSI Field Worker',
      email: 'csi@thfc.com',
      password: 'csi123', // Would be hashed in a real implementation
      role: USER_ROLES.CSI_FIELD_WORKER,
      location: LOCATIONS.FIELD
    }
  ];
  
  return mockUsers.find(user => user.email === email);
}

function validateUserPassword(user, password) {
  // This is a mock implementation
  // In a real implementation, this would hash the password and compare
  return user.password === password;
}

function generateAuthToken(user) {
  // This is a mock implementation
  // In a real implementation, this would generate a JWT
  return Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  })).toString('base64');
}

async function getUserFromToken(token) {
  // This is a mock implementation
  // In a real implementation, this would validate and decode a JWT
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check if token is expired
    if (decoded.exp < Date.now()) {
      return null;
    }
    
    // Get user by ID
    const mockUsers = [
      {
        id: '1',
        name: 'Super Admin',
        email: 'admin@thfc.com',
        role: USER_ROLES.SUPER_ADMIN,
        location: LOCATIONS.HEAD_OFFICE
      }
    ];
    
    return mockUsers.find(user => user.id === decoded.id);
  } catch (error) {
    return null;
  }
}

async function createUserInDatabase(userData) {
  // This is a mock implementation
  // In a real implementation, this would create a user in a database
  return {
    id: Math.random().toString(36).substring(2, 15),
    ...userData
  };
}
