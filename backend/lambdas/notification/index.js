import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({});
const snsTopicArn = process.env.SNS_TOPIC_ARN;

export const handler = async (event) => {
  console.log("Notification Service Event:", JSON.stringify(event, null, 2));

  const body = event.detail;
  const { product_id, new_price } = body;

  // Compose your notification message
  const message = `The price of product ${product_id} has been updated to $${new_price}.`;

  // Send the notification (e.g., via SNS)
  const command = new PublishCommand({
    TopicArn: snsTopicArn,
    Message: message,
    Subject: "Price Update Notification",
  });

  try {
    const snsResponse = await snsClient.send(command);
    console.log("Notification sent:", snsResponse);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Notification sent successfully" }),
    };
  } catch (error) {
    console.error("Error sending notification:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to send notification", error: error.message }),
    };
  }
};
