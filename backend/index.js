require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const User = require("./models/User");
const Loan = require("./models/Loan");
const auth = require("./middleware/auth");

const app = express();
const server = http.createServer(app);

// ✅ Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;

// ✅ Enable CORS
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// ✅ Middleware
app.use(express.json());

// ✅ MongoDB connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));


// ===================== AUTH ROUTES =====================

// Register
app.post("/api/register", async (req, res) => {
  const { name, email, password, role, occupation, contactNumber } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPass = await bcrypt.hash(password, 10);
    const newUser = new User({
      name, email, password: hashedPass, role, occupation, contactNumber
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const payload = { userId: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        occupation: user.occupation,
        contactNumber: user.contactNumber,
      }
    });
  } catch (e) {
    res.status(500).json({ message: "Server error", e });
  }
});


// ===================== LOAN ROUTES =====================

function isLender(req, res, next) {
  if (req.user.role !== "lender")
    return res.status(403).json({ message: "Only lenders allowed" });

  next();
}

// Create loan (Lender)
app.post("/api/loans", auth, isLender, async (req, res) => {
  const { amount, interestRate, durationMonths } = req.body;

  try {
    const loan = new Loan({
      amount,
      interestRate,
      durationMonths,
      lenderId: req.user.userId,
    });
    await loan.save();
    res.status(201).json({ message: "Loan offer created", loan });
  } catch (e) {
    res.status(500).json({ message: "Server error", e });
  }
});

// Get loans (Borrower)
app.get("/api/loans", auth, async (req, res) => {
  try {
    const loans = await Loan.find({ status: "available" }).populate(
      "lenderId",
      "name occupation contactNumber email"
    );
    res.json(loans);
  } catch (e) {
    res.status(500).json({ message: "Server error", e });
  }
});


// ===================== SOCKET.IO CHAT =====================

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // Join chat room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`${socket.id} joined room: ${roomId}`);
  });

  // Send message
  socket.on("sendMessage", ({ roomId, message, sender }) => {
    io.to(roomId).emit("receiveMessage", {
      message,
      sender,
      timestamp: new Date()
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});


// ✅ Start Server (socket.io requires server.listen)
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
