import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";

const eventBridgeClient = new EventBridgeClient({});
const eventBusName = process.env.EVENT_BUS_NAME;

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const demandTableName = process.env.DEMAND_TABLE;
const pricingTableName = process.env.PRICING_TABLE;

export const handler = async (event) => {
  console.log("Received Event: ", JSON.stringify(event));

  // To make the API Gateway work, we need to parse the body from the event.body
  // const body = JSON.parse(event.body);
  // However, since this is an EventBridge event, we can directly use event.detail
  // Extract product_id from the demand event
  const body = event.detail;
  console.log("Parsed Demand event: ", JSON.stringify(body));

  const { product_id } = body;

  if (!product_id) {
    console.error("Invalid event payload: Missing product_id");
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: "Invalid event payload Missing product_id",
      }),
    };
  }

  // Fetch the current demand for the product
  const getDemandCommand = new GetCommand({
    TableName: demandTableName,
    Key: { product_id }, // Using product_id from the order
  });

  const productDemand = await docClient.send(getDemandCommand);

  if (!productDemand.Item) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: "Demand data not found for the product",
      }),
    };
  }

  const demand = parseInt(productDemand.Item.demand);

  // Fetch the pr)icing details for the product
  const getPricingCommand = new GetCommand({
    TableName: pricingTableName,
    Key: { product_id },
  });

  const productPricing = await docClient.send(getPricingCommand);
  let newPrice;

  if (!productPricing.Item) {
    // If pricing doesn't exist for the product, create a new pricing entry
    const basePrice = 100; // Default base price, you can customize this
    const priceFactor = 1.5; // Default factor, can be customized

    const putPricingCommand = new PutCommand({
      TableName: pricingTableName,
      Item: {
        product_id,
        base_price: basePrice,
        price_factor: priceFactor,
        current_price: basePrice + demand * priceFactor, // Calculate initial price
      },
    });

    await docClient.send(putPricingCommand);

    return {
      statusCode: 200,
      body: JSON.stringify({
        product_id,
        price: basePrice + demand * priceFactor,
      }),
    };
  } else {
    const basePrice = productPricing.Item.base_price;
    const priceFactor = productPricing.Item.price_factor;

    // Calculate the new price based on demand
    newPrice = basePrice + demand * priceFactor;

    // Update the current price in the pricing table based on the demand
    const updatePricingCommand = new UpdateCommand({
      TableName: pricingTableName,
      Key: { product_id },
      UpdateExpression: "SET current_price = :newPrice",
      ExpressionAttributeValues: {
        ":newPrice": newPrice,
      },
    });
    await docClient.send(updatePricingCommand);
    // Send the PriceChanged event to EventBridge after updating the price
    const putEventsCommand = new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: "pricing.service",
          DetailType: "PriceChanged",
          Detail: JSON.stringify({
            product_id: product_id,
            new_price: newPrice,
          }),
        },
      ],
    });

    await eventBridgeClient.send(putEventsCommand);
    console.log(
      "Price change event sent:",
      JSON.stringify({ product_id, new_price: newPrice })
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ product_id, price: newPrice }),
  };
};
