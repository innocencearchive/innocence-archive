// server/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// --- Login Endpoint ---
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // 1. Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }, // Store and check emails in lowercase for consistency
    });

    if (!user) {
      console.log(`Login attempt failed: No user found for email ${email.toLowerCase()}`);
      return res.status(401).json({ message: 'Invalid credentials.' }); // Generic message for security
    }

    // 2. Compare the provided password with the stored hash
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      console.log(`Login attempt failed: Invalid password for email ${email.toLowerCase()}`);
      return res.status(401).json({ message: 'Invalid credentials.' }); // Generic message
    }

    // 3. Generate JWT if credentials are valid
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      // You can add other non-sensitive info here if needed
    };

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('FATAL ERROR: JWT_SECRET is not defined in environment variables.');
        return res.status(500).json({ message: 'Internal server error: Authentication configuration missing.' });
    }

    const token = jwt.sign(
      tokenPayload,
      jwtSecret,
      { expiresIn: '4h' }
    );

    console.log(`User ${user.email} logged in successfully. Role: ${user.role}`);

    // 4. Send the token (and optionally some user info) back to the client
    res.json({
      message: 'Login successful!',
      token: token,
      user: { // Send back some user info, but NOT the passwordHash
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'An error occurred during the login process.' });
  }
});


// --- (Optional) Register Endpoint - For creating users initially if needed ---
// For now, you're creating users "behind the scenes".
// If you wanted a registration endpoint later, it would look something like this:
/*
router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  // Consider adding more robust validation (e.g., password strength)

  try {
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use.' }); // 409 Conflict
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role: role || 'USER', // Default to USER if no role specified
      },
    });

    // Don't send passwordHash back
    const userResponse = { ...newUser };
    delete userResponse.passwordHash;

    res.status(201).json({ message: 'User registered successfully', user: userResponse });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
         // Prisma unique constraint violation on email
        return res.status(409).json({ message: 'Email already in use.' });
    }
    res.status(500).json({ message: 'An error occurred during registration.' });
  }
});
*/

module.exports = router;
