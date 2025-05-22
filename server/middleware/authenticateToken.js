// server/middleware/authenticateToken.js
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  // Get token from the Authorization header
  // Format is "Bearer TOKEN"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Get the token part after "Bearer "

  if (token == null) {
    // No token provided
    console.log('Auth Middleware: No token provided.');
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('Auth Middleware: FATAL ERROR - JWT_SECRET is not defined in environment variables.');
    return res.status(500).json({ message: 'Internal server error: Authentication configuration issue.' });
  }

  jwt.verify(token, jwtSecret, (err, decodedTokenPayload) => {
    if (err) {
      // Token is not valid (e.g., expired, tampered)
      console.log('Auth Middleware: Invalid token.', err.message);
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Access denied. Token has expired.' });
      }
      return res.status(403).json({ message: 'Access denied. Invalid token.' }); // 403 Forbidden for invalid token
    }

    // Token is valid, attach the decoded payload to the request object
    // This typically includes userId, email, role, etc.
    req.user = decodedTokenPayload;
    console.log('Auth Middleware: Token validated successfully. User:', req.user.email, 'Role:', req.user.role);
    next(); // Proceed to the next middleware or route handler
  });
}

// Optional: Middleware for role-based authorization
// You can create more specific middleware like this if needed
function authorizeRole(roles) { // roles can be a single role string or an array of roles
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      console.log('Role Auth: User or user role not found on request object. Ensure authenticateToken runs first.');
      return res.status(403).json({ message: 'Forbidden: User role not available.' });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      console.log(`Role Auth: Access denied for user ${req.user.email}. Role '${userRole}' not in allowed roles: [${allowedRoles.join(', ')}]`);
      return res.status(403).json({ message: `Forbidden: You do not have the required '${allowedRoles.join(' or ')}' role to access this resource.` });
    }

    console.log(`Role Auth: Access granted for user ${req.user.email} with role '${userRole}'.`);
    next(); // User has one of the allowed roles
  };
}


module.exports = {
    authenticateToken,
    authorizeRole
};
