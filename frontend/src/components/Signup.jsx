import React, { useState } from "react";
import { CognitoUserPool, CognitoUserAttribute } from "amazon-cognito-identity-js";
import { config } from "../config";

const poolData = {
  UserPoolId: config.userPoolId,
  ClientId: config.clientId,
};

const userPool = new CognitoUserPool(poolData);

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = () => {
    // Create an attribute for email
    const emailAttribute = new CognitoUserAttribute({
      Name: "email", // The name of the attribute in the user pool
      Value: email,  // The value from the state
    });

    // Set up the sign-up parameters
    const attributes = [emailAttribute];

    // Sign up the user using their username, password, and email
    userPool.signUp(username, password, attributes, null, (err, data) => {
      if (err) {
        alert(err.message || JSON.stringify(err));
        return;
      }
      console.log("Signup successful", data);
      // Optionally redirect or display a success message
    });
  };

  return (
    <div>
      <h2>Signup</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleSignup}>Sign Up</button>
    </div>
  );
}
