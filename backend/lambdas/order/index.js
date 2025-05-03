import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.TABLE_NAME;
const eventBusName = process.env.EVENT_BUS_NAME;
const eventBridgeClient = new EventBridgeClient({});

const getCorsHeaders = (origin) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://create-order-react-app-bucket.s3-website-us-east-1.amazonaws.com",
    "http://create-order-react-app-bucket-cdf.s3-website-us-east-1.amazonaws.com",
    "https://d22c8silp0pnlo.cloudfront.net",
  ];
  if (allowedOrigins.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE",
    };
  }
  return { "Access-Control-Allow-Origin": "null" };
};

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  const origin = event.headers?.origin;
  const corsHeaders = getCorsHeaders(origin);
  // created intially and then used getCorsHeaders for dynamic origin
  /*   const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3000',  // Ensure this is here if you need custom headers
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',  // Allow the methods
  }; */
  if (event.httpMethod === "OPTIONS") {
    // Handle preflight request
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "CORS preflight OK" }),
    };
  }

  try {
    const body = JSON.parse(event.body);

    if (!body.product_id || !body.quantity) {
      console.error("Missing product_id or quantity in request body.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request: Missing product_id or quantity",
        }),
        headers: corsHeaders,
      };
    }

    const order = {
      order_id: uuidv4(),
      product_id: body.product_id,
      quantity: body.quantity,
      timestamp: Date.now(),
    };

    // Save the order in DynamoDB
    const command = new PutCommand({
      TableName: tableName,
      Item: order,
    });

    const response = await docClient.send(command);
    console.log("DynamoDB response:", response);

    // Send OrderPlaced event to EventBridge
    const putEventsCommand = new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName, // Your EventBus name
          Source: "order.service", // Source of the event
          DetailType: "OrderPlaced", // Detail type for event matching
          Detail: JSON.stringify({
            order_id: order.order_id,
            product_id: order.product_id,
            quantity: order.quantity,
            timestamp: order.timestamp,
          }),
        },
      ],
    });

    const eventResponse = await eventBridgeClient.send(putEventsCommand);
    console.log("EventBridge response:", eventResponse);

    // Returning response
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Order placed",
        order_id: order.order_id,
      }),
    };
  } catch (error) {
    console.error("Error processing request:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
    };
  }
};
