import { defineConfig } from 'cypress';
import { configureVisualRegression } from 'cypress-visual-regression/dist/plugin';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173', // Your Vite dev server URL
    setupNodeEvents(on, config) {
      // Configure visual regression testing
      configureVisualRegression(on, config);
      
      // Add custom task to invoke Lambda functions locally
      on('task', {
        invokeLambda({ functionName, payload }) {
          console.log(`Invoking Lambda function: ${functionName}`);
          // This is a placeholder. In a real implementation, you would use
          // the AWS SDK or serverless framework to invoke the function.
          return Promise.resolve({ success: true, data: payload });
        }
      });
      
      return config;
    },
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
    setupNodeEvents(on, config) {
      // Component test specific setup
      return config;
    },
  },
  env: {
    visualRegressionType: 'regression',
    API_URL: 'https://your-api-gateway-id.execute-api.region.amazonaws.com/dev',
  },
});
