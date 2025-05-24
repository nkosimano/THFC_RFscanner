// Zoho API integration utilities

import https from 'https';
import querystring from 'querystring';

// Zoho API URLs
const ZOHO_ACCOUNTS_URL = 'accounts.zoho.com';
const ZOHO_INVENTORY_URL = 'inventory.zoho.com';

// Document/Package Types
const DOCUMENT_TYPES = {
  DISPATCH_ORDER: 'salesorder',
  DONATION_BATCH: 'packages'
};

// Stock Sources
const STOCK_SOURCES = {
  FRESHLY_BAKED: 'Freshly Baked',
  UPLIFTED: 'Uplifted Stock',
  THFC_BAKED: 'THFC-Baked Stock'
};

// Recipient Organizations
const RECIPIENT_ORGS = {
  FOOD_FORWARD: {
    name: 'Food Forward SA',
    allocation: 0.4 // 40%
  },
  SA_HARVEST: {
    name: 'SA Harvest',
    allocation: 0.6 // 60%
  }
};

/**
 * Get an access token from Zoho using a refresh token
 * @param {string} refreshToken - The Zoho refresh token
 * @returns {Promise<string>} - The access token
 */
async function getZohoAccessToken(refreshToken) {
  const clientId = process.env.ZOHO_INVENTORY_CLIENT_ID;
  const clientSecret = process.env.ZOHO_INVENTORY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Zoho client credentials not configured');
  }
  
  const data = querystring.stringify({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  });
  
  const options = {
    hostname: ZOHO_ACCOUNTS_URL,
    path: '/oauth/v2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': data.length
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (parsedData.access_token) {
            resolve(parsedData.access_token);
          } else {
            reject(new Error(parsedData.error || 'Failed to get access token'));
          }
        } catch (error) {
          reject(new Error('Invalid response from Zoho: ' + error.message));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error('Error making request to Zoho: ' + error.message));
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Make a request to the Zoho Inventory API
 * @param {string} accessToken - The Zoho access token
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - API endpoint path
 * @param {object} [data] - Request body for POST/PUT requests
 * @returns {Promise<object>} - The response data
 */
/**
 * Creates a new dispatch order in Zoho Inventory
 * @param {string} accessToken - Zoho access token
 * @param {string} dispatchOrderRef - Unique dispatch order reference (e.g., DO20250523-A)
 * @param {Array} crateItems - Array of crate items to include in the dispatch order
 * @param {string} destinationWarehouse - Name of the destination warehouse
 * @returns {Promise<Object>} - Created dispatch order data
 */
async function createDispatchOrder(accessToken, dispatchOrderRef, crateItems, destinationWarehouse) {
  // Format line items for dispatch order
  const lineItems = crateItems.map(crate => ({
    item_id: crate.item_id,
    quantity: crate.bread_quantity,
    warehouse_id: crate.warehouse_id || '',
    rate: 7.75, // Default rate per loaf
    description: `Bread crate ${crate.crate_id}`
  }));

  // Create dispatch order data
  const dispatchOrderData = {
    salesorder: {
      customer_id: '', // This would be the Spar DC customer ID in Zoho
      reference_number: dispatchOrderRef,
      date: new Date().toISOString().split('T')[0],
      shipment_date: new Date().toISOString().split('T')[0],
      is_inclusive_tax: false,
      line_items: lineItems,
      custom_fields: [
        {
          label: 'Destination',
          value: destinationWarehouse
        },
        {
          label: 'Stock Source',
          value: STOCK_SOURCES.FRESHLY_BAKED
        }
      ]
    }
  };

  // Make API request to create dispatch order
  return makeZohoInventoryRequest(
    accessToken,
    'POST',
    '/api/v1/salesorders',
    dispatchOrderData
  );
}

/**
 * Gets a dispatch order from Zoho Inventory by reference number
 * @param {string} accessToken - Zoho access token
 * @param {string} dispatchOrderRef - Dispatch order reference
 * @returns {Promise<Object>} - Dispatch order data
 */
async function getDispatchOrder(accessToken, dispatchOrderRef) {
  // Make API request to get dispatch orders filtered by reference number
  const response = await makeZohoInventoryRequest(
    accessToken,
    'GET',
    `/api/v1/salesorders?reference_number=${encodeURIComponent(dispatchOrderRef)}`
  );

  // Check if the dispatch order exists
  if (!response.salesorders || response.salesorders.length === 0) {
    throw new Error(`Dispatch order not found: ${dispatchOrderRef}`);
  }

  return response.salesorders[0];
}

/**
 * Finalizes a dispatch order in Zoho Inventory
 * @param {string} accessToken - Zoho access token
 * @param {string} dispatchOrderId - Dispatch order ID
 * @returns {Promise<Object>} - Updated dispatch order data
 */
async function finalizeDispatchOrder(accessToken, dispatchOrderId) {
  // Make API request to mark dispatch order as confirmed
  return makeZohoInventoryRequest(
    accessToken,
    'POST',
    `/api/v1/salesorders/${dispatchOrderId}/status/confirmed`
  );
}

/**
 * Creates a donation batch in Zoho Inventory
 * @param {string} accessToken - Zoho access token
 * @param {string} donationBatchRef - Unique donation batch reference (e.g., DN20250524-A)
 * @param {Array} crateItems - Array of crate items to include in the donation batch
 * @param {Object} sourceBreakdown - Breakdown of bread sources {uplifted: 123, thfc_baked: 456}
 * @returns {Promise<Object>} - Created donation batch data
 */
async function createDonationBatch(accessToken, donationBatchRef, crateItems, sourceBreakdown) {
  // Calculate total bread quantity
  const totalBreadQuantity = crateItems.reduce((total, crate) => total + crate.bread_quantity, 0);
  
  // Calculate recipient allocations
  const foodForwardQuantity = Math.floor(totalBreadQuantity * RECIPIENT_ORGS.FOOD_FORWARD.allocation);
  const saHarvestQuantity = totalBreadQuantity - foodForwardQuantity;
  
  // Calculate value
  const pricePerLoaf = 7.75;
  const totalValue = totalBreadQuantity * pricePerLoaf;
  
  // Create package data
  const packageData = {
    package: {
      package_number: donationBatchRef,
      date: new Date().toISOString().split('T')[0],
      reference_number: donationBatchRef,
      delivery_method: 'Charity Donation',
      notes: `Total bread: ${totalBreadQuantity}, Food Forward SA: ${foodForwardQuantity}, SA Harvest: ${saHarvestQuantity}`,
      line_items: crateItems.map(crate => ({
        item_id: crate.item_id,
        quantity: crate.bread_quantity
      })),
      custom_fields: [
        {
          label: 'Total Bread Quantity',
          value: totalBreadQuantity.toString()
        },
        {
          label: 'Food Forward SA Quantity',
          value: foodForwardQuantity.toString()
        },
        {
          label: 'SA Harvest Quantity',
          value: saHarvestQuantity.toString()
        },
        {
          label: 'Uplifted Stock Quantity',
          value: (sourceBreakdown.uplifted || 0).toString()
        },
        {
          label: 'THFC-Baked Stock Quantity',
          value: (sourceBreakdown.thfc_baked || 0).toString()
        },
        {
          label: 'Value Per Loaf',
          value: pricePerLoaf.toString()
        },
        {
          label: 'Total Donation Value',
          value: totalValue.toFixed(2)
        }
      ]
    }
  };
  
  // Make API request to create package (donation batch)
  return makeZohoInventoryRequest(
    accessToken,
    'POST',
    '/api/v1/packages',
    packageData
  );
}

/**
 * Calculates CSI donation target based on finalized dispatch orders
 * @param {string} accessToken - Zoho access token
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Target calculation results
 */
async function calculateCSIDonationTarget(accessToken, startDate, endDate) {
  // Make API request to get all confirmed dispatch orders in date range
  const response = await makeZohoInventoryRequest(
    accessToken,
    'GET',
    `/api/v1/salesorders?filter_by=Status.Confirmed&date_start=${startDate}&date_end=${endDate}`
  );
  
  if (!response.salesorders) {
    return { target: 0, total_dispatched: 0 };
  }
  
  // Calculate total bread dispatched
  let totalDispatched = 0;
  response.salesorders.forEach(order => {
    order.line_items.forEach(item => {
      totalDispatched += parseInt(item.quantity, 10);
    });
  });
  
  // Calculate CSI target (5.9% of total dispatched)
  const csiTarget = Math.ceil(totalDispatched * 0.059);
  
  return {
    target: csiTarget,
    total_dispatched: totalDispatched,
    dispatch_orders: response.salesorders.map(order => order.reference_number)
  };
}

async function makeZohoInventoryRequest(accessToken, method, path, data = null) {
  const organizationId = process.env.ZOHO_INVENTORY_ORGANIZATION_ID;
  
  if (!organizationId) {
    throw new Error('Zoho organization ID not configured');
  }
  
  // Add organization ID to path
  const fullPath = `${path}${path.includes('?') ? '&' : '?'}organization_id=${organizationId}`;
  
  const options = {
    hostname: ZOHO_INVENTORY_URL,
    path: `/api/v1${fullPath}`,
    method: method.toUpperCase(),
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json'
    }
  };
  
  let requestBody = null;
  if (data) {
    requestBody = JSON.stringify(data);
    options.headers['Content-Length'] = requestBody.length;
  }
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`Zoho API error (${res.statusCode}): ${JSON.stringify(parsedData)}`));
          }
        } catch (error) {
          reject(new Error('Invalid response from Zoho: ' + error.message));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error('Error making request to Zoho: ' + error.message));
    });
    
    if (requestBody) {
      req.write(requestBody);
    }
    req.end();
  });
}

/**
 * Create an item in Zoho Inventory
 * @param {string} accessToken - The Zoho access token
 * @param {object} itemData - The item data
 * @returns {Promise<object>} - The created item data
 */
async function createZohoInventoryItem(accessToken, itemData) {
  const data = {
    item: {
      name: itemData.name,
      sku: itemData.sku,
      description: itemData.description,
      unit: itemData.unit || 'pcs',
      is_returnable: itemData.is_returnable || true,
      item_type: itemData.item_type || 'inventory'
    }
  };
  
  // Create the item
  const response = await makeZohoInventoryRequest(accessToken, 'POST', '/items', data);
  
  // If initial stock is specified, update the stock
  if (itemData.initial_stock > 0 && response.item && response.item.item_id) {
    const inventoryAdjustment = {
      adjustment: {
        mode: 'add',
        reason: 'Initial stock entry',
        date: new Date().toISOString().split('T')[0],
        reference_number: `INIT-${itemData.sku}`,
        line_items: [
          {
            item_id: response.item.item_id,
            quantity: itemData.initial_stock,
            warehouse_name: itemData.initial_stock_location || 'Warehouse'
          }
        ]
      }
    };
    
    await makeZohoInventoryRequest(accessToken, 'POST', '/inventoryadjustments', inventoryAdjustment);
  }
  
  return response;
}

/**
 * Get item details from Zoho Inventory
 * @param {string} accessToken - The Zoho access token
 * @param {string} itemIdentifier - Item ID, SKU, or name
 * @returns {Promise<object>} - The item details
 */
async function getZohoInventoryItem(accessToken, itemIdentifier) {
  // First try to get by item ID
  try {
    const response = await makeZohoInventoryRequest(accessToken, 'GET', `/items/${itemIdentifier}`);
    return response;
  } catch (error) {
    // Item ID not found, search by SKU
    const searchResponse = await makeZohoInventoryRequest(
      accessToken, 
      'GET', 
      `/items?sku=${encodeURIComponent(itemIdentifier)}`
    );
    
    if (searchResponse.items && searchResponse.items.length > 0) {
      return { item: searchResponse.items[0] };
    }
    
    // If still not found, throw an error
    throw new Error(`Item not found: ${itemIdentifier}`);
  }
}

/**
 * Update item stock in Zoho Inventory
 * @param {string} accessToken - The Zoho access token
 * @param {string} itemId - The Zoho item ID
 * @param {number} quantity - The quantity to update
 * @param {string} warehouseName - The warehouse name
 * @param {string} [adjustmentType='set'] - The adjustment type (set/add/subtract)
 * @returns {Promise<object>} - The response data
 */
async function updateZohoInventoryStock(accessToken, itemId, quantity, warehouseName, adjustmentType = 'set') {
  const inventoryAdjustment = {
    adjustment: {
      mode: adjustmentType,
      reason: `Stock update via THFC Scanner App`,
      date: new Date().toISOString().split('T')[0],
      reference_number: `ADJ-${itemId}-${Date.now()}`,
      line_items: [
        {
          item_id: itemId,
          quantity: quantity,
          warehouse_name: warehouseName || 'Warehouse'
        }
      ]
    }
  };
  
  return makeZohoInventoryRequest(accessToken, 'POST', '/inventoryadjustments', inventoryAdjustment);
}

async function updateItemCustomFields(accessToken, itemId, customFields) {
  // customFields: array of {label, value}
  const data = {
    item: {
      custom_fields: customFields
    }
  };
  return makeZohoInventoryRequest(accessToken, 'PUT', `/items/${itemId}`, data);
}

module.exports = {
  getZohoAccessToken,
  makeZohoInventoryRequest,
  createZohoInventoryItem,
  getZohoInventoryItem,
  updateZohoInventoryStock,
  updateItemCustomFields,
  getDispatchOrder
};
