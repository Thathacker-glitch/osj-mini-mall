const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Temporary In-Memory Storage (Replace with database like MongoDB/PostgreSQL in production)
let users = [];
let orders = [];

// PRODUCTS DATABASE
const products = [
  { id: 1, name: "Elegant Gold-Tone Necklace", category: "Jewelry", price: 18500, oldPrice: 24000, stockType: "In-Stock" },
  { id: 2, name: "Classic Women's Handbag", category: "Bags", price: 35000, oldPrice: 42000, stockType: "In-Stock" },
  { id: 3, name: "Fashion Sunglasses", category: "Women", price: 12800, oldPrice: 16000, stockType: "In-Stock" },
  { id: 4, name: "Beauty Gift Set", category: "Beauty", price: 22000, oldPrice: 28000, stockType: "Pre-Order" },
  { id: 5, name: "Minimalist Bracelet", category: "Jewelry", price: 15000, oldPrice: 19000, stockType: "In-Stock" },
  { id: 6, name: "Women's Casual Dress", category: "Women", price: 26000, oldPrice: 33000, stockType: "Pre-Order" },
  { id: 7, name: "Kids Educational Toy", category: "Toys", price: 14000, oldPrice: 18000, stockType: "In-Stock" },
  { id: 8, name: "Modern Home Organizer", category: "Household", price: 12900, oldPrice: 17000, stockType: "In-Stock" }
];

// ------------------- API ROUTES -------------------

// 1. Get All Products
app.get('/api/products', (req, res) => {
  res.json({ success: true, data: products });
});

// 2. User Authentication (Signup / Login)
app.post('/api/auth/register', (req, res) => {
  const { name, contact, password } = req.body;
  
  if (!name || !contact || !password) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  let user = users.find(u => u.contact === contact);
  if (!user) {
    user = { id: Date.now(), name, contact, password };
    users.push(user);
  }

  res.json({ success: true, user: { id: user.id, name: user.name, contact: user.contact } });
});

// 3. Initialize Paystack Payment
app.post('/api/checkout/paystack', async (req, res) => {
  const { email, items, location, address } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cart is empty.' });
  }

  // Calculate order total server-side for accuracy
  let totalAmount = 0;
  items.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (product) {
      totalAmount += product.price * item.qty;
    }
  });

  if (totalAmount < 12800 || totalAmount > 2000000) {
    return res.status(400).json({ success: false, message: 'Order total must be between ₦12,800 and ₦2,000,000.' });
  }

  try {
    // Paystack API expects the amount in Kobo (NGN * 100)
    const paystackResponse = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: email,
        amount: totalAmount * 100,
        metadata: {
          delivery_address: address,
          coordinates: location,
          order_items: items
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Save pending order
    const newOrder = {
      orderId: 'OSJ-' + Date.now(),
      email,
      totalAmount,
      items,
      address,
      location,
      status: 'Payment Pending',
      reference: paystackResponse.data.data.reference
    };
    orders.push(newOrder);

    res.json({
      success: true,
      authorization_url: paystackResponse.data.data.authorization_url,
      reference: paystackResponse.data.data.reference
    });

  } catch (error) {
    console.error('Paystack Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, message: 'Failed to initialize payment gateway.' });
  }
});

// 4. Verify Payment Status (Paystack Callback / Webhook)
app.get('/api/checkout/verify/:reference', async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
      }
    });

    if (response.data.data.status === 'success') {
      const order = orders.find(o => o.reference === reference);
      if (order) {
        order.status = 'Paid / Processing';
      }
      return res.json({ success: true, message: 'Payment verified successfully.', order });
    } else {
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error verifying payment.' });
  }
});

// 5. Admin - Fetch All Orders
app.get('/api/admin/orders', (req, res) => {
  res.json({ success: true, orders });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`OSJ Backend Server running on port ${PORT}`));
