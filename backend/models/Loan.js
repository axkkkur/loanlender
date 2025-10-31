const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  interestRate: { type: Number, required: true },
  durationMonths: { type: Number, required: true },
  lenderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  loanTakerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  status: {
    type: String,
    enum: ["available", "requested", "approved", "rejected"],
    default: "available",
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Loan", loanSchema);
