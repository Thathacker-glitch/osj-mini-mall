const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// In-Memory Database (For local testing)
let orders = [];
let walletBalance = 45750.00;

// ==========================================
// 1. CHECKOUT & ESCROW API
// ==========================================
app.post('/api/checkout', (req, res) => {
  const { amount, productType, offerPrice } = req.body;

  let finalPrice = amount;

  // Haggle Validation: Maximum 10% discount allowed
  if (offerPrice) {
    const discount = ((amount - offerPrice) / amount) * 100;
    if (discount > 10) {
      return res.status(400).json({
        success: false,
        message: "Rejected: Offer exceeds the maximum 10% haggle limit."
      });
    }
    finalPrice = offerPrice;
  }

  // Escrow Rules:
  // In-Stock items = 50% upfront payment
  // Pre-Order items = 100% full upfront payment
  let upfrontPercentage = productType === 'pre_order' ? 1.0 : 0.5;
  let upfrontRequired = finalPrice * upfrontPercentage;

  const newOrder = {
    orderId: "OSJ-" + Math.floor(10000 + Math.random() * 90000),
    totalAmount: finalPrice,
    upfrontPaid: upfrontRequired,
    remainingBalance: finalPrice - upfrontRequired,
    status: "Pending Escrow",
    productType: productType,
    createdAt: new Date()
  };

  orders.push(newOrder);

  res.json({
    success: true,
    message: "Order placed successfully in Escrow!",
    paymentDetails: {
      total: finalPrice,
      upfront: upfrontRequired,
      remaining: finalPrice - upfrontRequired,
      status: newOrder.status
    },
    order: newOrder
  });
});

// ==========================================
// 2. ESCROW CONFIRMATION API
// ==========================================
app.post('/api/confirm-delivery', (req, res) => {
  const { orderId, role } = req.body;

  const order = orders.find(o => o.orderId === orderId);
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  if (role === 'buyer') {
    order.buyerConfirmed = true;
  } else if (role === 'seller') {
    order.sellerConfirmed = true;
  }

  // Release funds only when BOTH parties confirm
  if (order.buyerConfirmed && order.sellerConfirmed) {
    order.status = "Completed - Funds Released";
  }

  res.json({
    success: true,
    message: `${role} confirmed delivery.`,
    orderStatus: order.status
  });
});

// ==========================================
// 3. WALLET BALANCE API
// ==========================================
app.get('/api/wallet', (req, res) => {
  res.json({
    success: true,
    balance: walletBalance,
    virtualAccount: {
      bank: "Example Bank",
      accountName: "Oversabijojo - Joshua",
      accountNumber: "1234567890"
    }
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Oversabijojo Backend running at http://localhost:${PORT}`);
});
