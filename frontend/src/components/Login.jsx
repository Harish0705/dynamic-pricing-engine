import { useState } from "react";
import {
  CognitoUser,
  AuthenticationDetails,
  CognitoUserPool,
} from "amazon-cognito-identity-js";
import { config } from "../config";

const poolData = {
  UserPoolId: config.userPoolId,
  ClientId: config.clientId,
};

const userPool = new CognitoUserPool(poolData);

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);

  const handleLogin = () => {
    const user = new CognitoUser({
      Username: username,
      Pool: userPool,
    });

    const authDetails = new AuthenticationDetails({
      Username: username,
      Password: password,
    });

    user.authenticateUser(authDetails, {
      onSuccess: (result) => {
        console.log("Login success!", result);
        const idToken = result.getIdToken().getJwtToken();
        // you can use this access token for testing the lambda function in console if needed
        // const accessToken = result.getAccessToken().getJwtToken();
        setLoggedInUser({
          username,
          token: idToken,
        });
        alert("Logged in!");
        localStorage.setItem("idToken", idToken);
      },
      onFailure: (err) => {
        alert(err.message || JSON.stringify(err));
      },
    });
  };

  return (
    <div>
      <h2>Login</h2>
      <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>

      {loggedInUser && (
        <div>
          <p>Welcome, {loggedInUser.email}</p>
          <p>Token: <code>{loggedInUser.token.slice(0, 30)}...</code></p>
        </div>
      )}
    </div>
  );
}
