import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import Signup from "./components/Signup";
import Login from "./components/Login";
import CreateOrder from "./components/CreateOrder";

const App = () => {
  return (
    <Router>
      <nav>
        <Link to="/signup">Signup</Link>| <Link to="/login">Login</Link> |{" "}
        <Link to="/orders">CreateOrder</Link>
      </nav>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/orders" element={<CreateOrder />} />
      </Routes>
    </Router>
  );
};

export default App;
