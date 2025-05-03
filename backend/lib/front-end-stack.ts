import { Stack, StackProps, CfnOutput, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";

export class FrontendDeploymentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create an S3 bucket and host a static website.
    const AppBucket = new s3.Bucket(this, "ReactAppBucket", {
      bucketName: "create-order-react-app-bucket", // Change this to a unique name
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        ignorePublicAcls: false,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      publicReadAccess: true, // Make the bucket publicly readable
      removalPolicy: RemovalPolicy.DESTROY, // Use DESTROY only in dev environments
    });

     // Deploy the React app to S3
     new s3deploy.BucketDeployment(this, "DeployReactApp", {
        sources: [s3deploy.Source.asset("../frontend/build")], // Path to your build directory
        destinationBucket: AppBucket
      });

    // Output the S3 URL
    new CfnOutput(this, "SiteURL", {
      value: AppBucket.bucketWebsiteUrl,
      description: "The URL of the S3 bucket static website hosting",
    }); 

    // S3 Bucket will allow only http requests, if you want to allow https requests, you need to use CloudFront

    const s3CorsRule: s3.CorsRule = {
      allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
      allowedOrigins: ["*"],
      allowedHeaders: ["*"],
    };

    // Create an S3 bucket and allow CloudFront to access it to serve https requests
    const CloudFrontBucket = new s3.Bucket(this, "ReactAppBucketCDF", {
      bucketName: "create-order-react-app-bucket-cdf", // Change this to a unique name
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.PRIVATE,
      cors: [s3CorsRule],
      removalPolicy: RemovalPolicy.DESTROY, // Use DESTROY only in dev environments
    });

    // Create Origin Access Identity (OAC) for CloudFront
    const oai = new cloudfront.OriginAccessIdentity(this, "OAI", {
      comment: "OAI for React App Bucket",
    });

    // Grant bucket read permissions to CloudFront
    CloudFrontBucket.grantRead(oai);

    const distribution = new cloudfront.CloudFrontWebDistribution(
      this,
      "ReactAppDistribution",
      {
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: CloudFrontBucket,
              originAccessIdentity: oai,
            },
            behaviors: [
              {
                isDefaultBehavior: true,
                viewerProtocolPolicy:
                  cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
              },
              {
                pathPattern: "/*",
                allowedMethods: cloudfront.CloudFrontAllowedMethods.GET_HEAD,
              },
            ],
          },
        ],
        errorConfigurations: [
          {
            errorCode: 403,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
          {
            errorCode: 404,
            responseCode: 200,
            responsePagePath: "/index.html",
          },
        ],
      }
    );

    // Deploy the React app to S3
    new s3deploy.BucketDeployment(this, "DeployReactAppCdf", {
      sources: [s3deploy.Source.asset("../frontend/build")], // Path to your build directory
      destinationBucket: CloudFrontBucket,
      distribution: distribution,
      distributionPaths: ["/*"],
    });

    new CfnOutput(this, "CloudFrontURL", {
      value: `https://${distribution.distributionDomainName}`,
      description: "The CloudFront distribution URL",
    });
  }
}
