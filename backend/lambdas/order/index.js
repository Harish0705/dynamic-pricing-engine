import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge"; 

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.TABLE_NAME;
const eventBusName = process.env.EVENT_BUS_NAME;
const eventBridgeClient = new EventBridgeClient({});

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  try {
    const body = JSON.parse(event.body);
    
    if (!body.product_id || !body.quantity) {
      console.error("Missing product_id or quantity in request body.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid request: Missing product_id or quantity",
        }),
      };
    }

    const order = {
      order_id: uuidv4(),
      product_id: body.product_id,
      quantity: body.quantity,
      timestamp: Date.now(),
    };

    // 1. Save the order in DynamoDB
    const command = new PutCommand({
      TableName: tableName,
      Item: order,
    });

    const response = await docClient.send(command);
    console.log("DynamoDB response:", response);

    // 2. Send OrderPlaced event to EventBridge 🛎️
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
      body: JSON.stringify({
        message: "Order placed",
        order_id: order.order_id,
      }),
    };
  } catch (error) {
    console.error("Error processing request:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
        error: error.message,
      }),
    };
  }
};
