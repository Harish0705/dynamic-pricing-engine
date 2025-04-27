import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";

export class DynamicPricingEngineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    //order table
    const table = new dynamodb.Table(this, "OrdersTable", {
      partitionKey: { name: "order_id", type: dynamodb.AttributeType.STRING },
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    const demandTable = new dynamodb.Table(this, "DemandTable", {
      tableName: "DemandTable",
      partitionKey: { name: "product_id", type: dynamodb.AttributeType.STRING },
    });

    const pricingTable = new dynamodb.Table(this, "PricingTable", {
      tableName: "PricingTable",
      partitionKey: { name: "product_id", type: dynamodb.AttributeType.STRING },
    });

    const eventBus = new events.EventBus(this, "DynamicPricingBus", {
      eventBusName: "DynamicPricingBus",
    });

    const notificationTopic = new sns.Topic(this, "PricingNotificationTopic", {
      topicName: "PricingNotificationTopic",
    });

    const orderLambda = new lambda.Function(this, "OrderLambda", {
      functionName: "OrderLambda",
      description: "Lambda function to handle order processing",
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/order"),
      environment: {
        TABLE_NAME: table.tableName,
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
    });

    table.grantReadWriteData(orderLambda);

    const demandAnalysisLambda = new lambda.Function(this, "DemandLambda", {
      functionName: "DemandAnalysisLambda",
      description: "Lambda function to handle demand analysis",
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/demand-analysis"),
      environment: {
        ORDER_TABLE: table.tableName,
        DEMAND_TABLE: demandTable.tableName,
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
    });

    demandTable.grantReadWriteData(demandAnalysisLambda);
    table.grantReadData(demandAnalysisLambda); // Grant read access to the order table for demand analysis

    const pricingLambda = new lambda.Function(this, "PricingLambda", {
      functionName: "PricingLambda",
      description: "Lambda function to calculate price based on demand",
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/dynamic-pricing"),
      environment: {
        DEMAND_TABLE: demandTable.tableName,
        PRICING_TABLE: pricingTable.tableName,
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
    });

    pricingTable.grantReadWriteData(pricingLambda);
    demandTable.grantReadData(pricingLambda);

    // Create the Notification Lambda function
    const notificationLambda = new lambda.Function(this, "NotificationLambda", {
      functionName: "NotificationLambda",
      description: "Lambda function to send notifications",
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/notification"),
      environment: {
        SNS_TOPIC_ARN: notificationTopic.topicArn,
      },
    });

    // Grant the Notification Lambda function permission to publish to the SNS topic
    notificationTopic.grantPublish(notificationLambda);

    const api = new apigateway.RestApi(this, "OrderServiceAPI", {
      restApiName: "Order Service",
      description: "This service handles order processing.",
    });
    const orderResource = api.root.addResource("orders");
    orderResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(orderLambda, {
        proxy: true,
      })
    );
    const demandResource = api.root.addResource("demand");
    demandResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(demandAnalysisLambda, {
        proxy: true,
      })
    );
    const pricingResource = api.root.addResource("pricing");
    pricingResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(pricingLambda, { proxy: true })
    );

    orderLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: ["*"], // (or better, you can restrict to your EventBus ARN later)
      })
    );

    // Grant permission to DemandAnalysisLambda if you need it to emit HighDemandDetected
    demandAnalysisLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: ["*"],
      })
    );
    // Grant permission to PricingLambda if you need it to emit PriceUpdated
    pricingLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: ["*"],
      })
    );

    // Create an EventBridge rule to trigger the DemandAnalysisLambda when an order is placed
    const orderPlacedRule = new events.Rule(this, "OrderPlacedRule", {
      eventBus: eventBus,
      eventPattern: {
        source: ["order.service"], // The source from your event payload
        detailType: ["OrderPlaced"], // The detail type for the event
      },
    });

    orderPlacedRule.addTarget(new targets.LambdaFunction(demandAnalysisLambda));

    // Create an EventBridge rule to trigger the pricingLambda when an demand is high
    const highDemandRule = new events.Rule(this, "HighDemandDetected", {
      eventBus: eventBus,
      eventPattern: {
        source: ["demand.analysis"], // The source from your event payload
        detailType: ["HighDemandDetected"], // The detail type for the event
      },
    });

    highDemandRule.addTarget(new targets.LambdaFunction(pricingLambda));

    // Create an EventBridge rule to listen for PriceChanged events
    const priceChangedRule = new events.Rule(this, "PriceChangedRule", {
      eventBus: eventBus,
      eventPattern: {
        source: ["pricing.service"],
        detailType: ["PriceChanged"],
      },
    });

    // Add the Notification Lambda as a target for the rule
    priceChangedRule.addTarget(new targets.LambdaFunction(notificationLambda));
  }
}
