import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const demandTableName = process.env.DEMAND_TABLE;
const orderTableName = process.env.ORDER_TABLE;
const eventBusName = process.env.EVENT_BUS_NAME;
const eventBridgeClient = new EventBridgeClient({});
const HIGH_DEMAND_THRESHOLD = 20; // threshold for high demand

export const handler = async (event) => {
  console.log("Received Event: ", JSON.stringify(event));

  // To make the API Gateway work, we need to parse the body from the event.body
  // const body = JSON.parse(event.body);
  // However, since this is an EventBridge event, we can directly use event.detail
  // Extract product_id and quantity from the order event
  const body = event.detail;

  console.log("Parsed Event Body: ", JSON.stringify(body));
  const { product_id, quantity, order_id } = body;

  if (!product_id || !quantity || !order_id) {
    console.error(
      "Invalid event payload: Missing product_id, quantity, or order_id"
    );
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid event payload" }),
    };
  }

  // Fetch product details from the order table (if needed)
  const getOrderCommand = new GetCommand({
    TableName: orderTableName,
    Key: { order_id: order_id }, // You can use the order_id to fetch the order
  });

  const orderData = await docClient.send(getOrderCommand);

  // You can further process `orderData` if needed, but the important part is using the `product_id`
  if (orderData.Item) {
    // Check current demand in the demand analysis table
    const getDemandCommand = new GetCommand({
      TableName: demandTableName,
      Key: { product_id }, // Using product_id from the order
    });

    const productDemand = await docClient.send(getDemandCommand);
    console.log("Current demand data:", productDemand);

    let updatedCommand;
    let newDemand = parseInt(quantity) || 0;

    if (productDemand.Item) {
      // If the product already exists in the demand table, increment the demand
      const currentDemand = parseInt(productDemand.Item?.demand) || 0;
      newDemand += currentDemand;
      const newDemandString = newDemand.toString();
      updatedCommand = new UpdateCommand({
        TableName: demandTableName,
        Key: { product_id },
        UpdateExpression: "SET demand = :quantity",
        ExpressionAttributeValues: {
          ":quantity": newDemandString,
        },
      });
    } else {
      // If the product doesn't exist in the demand table, create a new record
      updatedCommand = new PutCommand({
        TableName: demandTableName,
        Item: {
          product_id,
          demand: quantity,
        },
      });
    }

    const response = await docClient.send(updatedCommand);
    console.log("DynamoDB response:", response);
    console.log("New Demand:", newDemand);

    // Check if demand exceeds threshold and send HighDemandDetected event
    if (newDemand >= HIGH_DEMAND_THRESHOLD) {
      console.log("High demand detected, sending event to EventBridge");

      const putEventsCommand = new PutEventsCommand({
        Entries: [
          {
            EventBusName: eventBusName,
            Source: "demand.analysis",
            DetailType: "HighDemandDetected",
            Detail: JSON.stringify({
              product_id,
              demand: newDemand,
            }),
          },
        ],
      });

      // Send the event to EventBridge
      const eventResponse = await eventBridgeClient.send(putEventsCommand);
      console.log("EventBridge response:", eventResponse);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Demand updated successfully" }),
    };
  } else {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: "Order not found" }),
    };
  }
};
