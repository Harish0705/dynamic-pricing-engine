import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";

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

    const orderLambda = new lambda.Function(this, "OrderLambda", {
      functionName: "OrderLambda",
      description: "Lambda function to handle order processing",
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambdas/order"),
      environment: {
        TABLE_NAME: table.tableName,
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
      },
    });

    demandTable.grantReadWriteData(demandAnalysisLambda);
    table.grantReadData(demandAnalysisLambda); // Grant read access to the order table for demand analysis

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
  }
}
