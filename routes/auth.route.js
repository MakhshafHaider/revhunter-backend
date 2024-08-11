// routes/authRoutes.js
const express = require('express');
const auth_controller = require('../controller/auth.controller');
const router = express.Router();

// User login route
router.post('/login/user',auth_controller );

module.exports = router;
