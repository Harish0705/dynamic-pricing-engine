import { useState } from 'react';
import { createOrder } from '../services/api';

const CreateOrder = () => {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState("");

  const handleCreateOrder = async () => {
    try {
      const order = await createOrder(productId, quantity);
      setMessage(`Order created: ${order.order_id}`);
      setProductId("");
    } catch (err) {
      console.error(err);
      setMessage("Failed to create order.");
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Product Id"
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
      />
      <input
        type="text"
        placeholder="Product quantity"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
      />
      <button onClick={handleCreateOrder}>Create Order</button>
      {message && <p>{message}</p>}
    </div>
  );
}

export default CreateOrder
