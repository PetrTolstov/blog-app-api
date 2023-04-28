// user.js
const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  }, 
  bio: {
    type: String,
    required: false
  },
  image: {
    type: String,
    required: false
  }
});


userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
const User = mongoose.model("User", userSchema);

module.exports = User;
