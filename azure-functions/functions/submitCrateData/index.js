const { app } = require('@azure/functions');
const zohoApi = require('../utils/zohoApi');

app.http('submitCrateData', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log('Processing crate data submission');

        try {
            // Parse the request body
            const crateData = await request.json();
            
            // Validate the request data
            if (!crateData || !crateData.crateId || !crateData.quantity) {
                return { 
                    status: 400, 
                    body: JSON.stringify({ 
                        error: 'Missing required fields: crateId and quantity are required' 
                    }),
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                };
            }

            // Process the crate data (example: create a sales order in Zoho)
            const salesOrderData = {
                customer_id: crateData.customerId || '',
                line_items: [
                    {
                        item_id: crateData.itemId,
                        quantity: crateData.quantity,
                        rate: crateData.rate || 0
                    }
                ],
                date: new Date().toISOString().split('T')[0],
                status: 'sent'
            };

            // Create sales order in Zoho
            const result = await zohoApi.createSalesOrder(salesOrderData);

            return {
                status: 200,
                body: JSON.stringify({
                    message: 'Crate data processed successfully',
                    data: result
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };

        } catch (error) {
            context.log(`Error processing request: ${error.message}`);
            
            return {
                status: 500,
                body: JSON.stringify({
                    error: 'Failed to process crate data',
                    details: error.message
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        }
    }
});
