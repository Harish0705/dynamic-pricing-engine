I have been learning about serverless, microservices, and event-driven architectures and I have applied those skills and developed this project to get hands-on experience.  

# Dynamic Pricing Engine 

A scalable, serverless pricing engine built with AWS CDK (TypeScript) that dynamically updates and serves pricing.   

The application uses services such as **Lambda**, **API Gateway**, **DynamoDB**, **Cognito**, **EventBridge**, and **SNS**

##How it works: 

Whenever, the user places an order, an event will be triggered by the Order microservice which will be consumed by the Demand-Analysis microservice that updates the product demand data in the DB and triggers an event if the High demand threshold is breached.  This high demand event will be consumed by the Dynamic pricing microservice which will dynamically update the product price based on the pricing logic we have set up. It will then emit a pricing-changed event which will be consumed by the Notification microservice. Then the notification service will publish notification to a SNS topic.  

Future steps. From the SNS topic we can take the necessary next steps such as sending email notifications to the users or admins about the price change, etc. 

##Components: 

- **Infrastructure**: Set up the resources using AWS CDK Infrastructure-as-code 

- **Authentication**: Amazon Cognito 

- **API Layer**: Amazon API Gateway integrated with Lambda. 

- **Business Logic**: Microservices developed using AWS Lambda functions for handling the logic and triggering events 

- **Database**: DynamoDB stores data in order, demand and pricing tables.  

- **Event Bus**: Amazon EventBridge to trigger the workflows. 

- **Notifications**: Amazon SNS used for sending alerts and updates. 
 

##Front end React App: 

I have created a front app to mimic the user order placement functionality.  I have integrated the AWS Cognito User pool (that we have created using the AWS CDK above.) which handles the signup and login functionalities.  You can use this app to test the Authentication and the backend microservices by placing an order using a dummy product id.  

##Components 

- **Infrastructure**: Deployed the front-end app to AWS using AWS CDK

- **Cognito**: For Authentication, Use the user pool and client id created by the AWS CDK.  

- **S3 Bucket**: Build the front-end and deploy the build file it to S3 Bucket and host it as static website 

- **CloudFront**: As S3 bucket serves http only, I have used Cloud Front and integrated it with S3 Origin and serving the front app securely using https.  

