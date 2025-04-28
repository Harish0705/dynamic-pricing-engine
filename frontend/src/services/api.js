import { config } from "../config";
import axios from "axios";

const API_BASE = config.apiBaseUrl;

export const createOrder = async (productId, quantity) => {
  const token = localStorage.getItem("idToken");
  console.log(token);

  try {
    const response = await axios.post(
      `${API_BASE}/orders`,
      {
        product_id: productId,
        quantity: quantity,
      },
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Order created:", response.data);
    return response.data;
  } catch (err) {
    console.error("Failed to create order:", err);
  }
};
