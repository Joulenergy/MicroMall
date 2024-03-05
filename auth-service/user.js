const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    created_at: {
        type: Date,
        default: Date.now(),
        immutable: true,
    },
    type: { type: String, enum: ["admin", "buyer"], required: true },
});

module.exports = User = mongoose.model("user", UserSchema);
