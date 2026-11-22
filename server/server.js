// server.js — The Innocence Archive Backend API

// Import necessary packages
// Use require for standard Node.js CommonJS modules unless your package.json has "type": "module"
require('dotenv').config(); // Load .env variables into process.env FIRST
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const individualRoutes = require('./routes/individuals'); // Add this line
const mediaWorksRoutes = require('./routes/mediaworks');
const mediaItemsRoutes = require('./routes/mediaitems');  
const organizationRoutes = require('./routes/organizations'); // Add this line
const contributingFactorRoutes = require('./routes/contributingfactors');
const crimeCategoryRoutes = require('./routes/crimecategories');  
const involvedPersonRoutes = require('./routes/involvedpersons');  
const updateRoutes = require('./routes/updates');  
const homepageRouter = require('./routes/homepage'); // Import the new router
const searchRoutes = require('./routes/search');
const settingsRoutes = require('./routes/settings');
const authRoutes = require('./routes/auth'); // <<< ADD THIS LINE
const adminExternalApiRoutes = require('./routes/adminExternalApi'); // <<< ADD THIS LINE
const adminRoutes = require('./routes/admin');
const adminImportRoutes = require('./routes/adminImport');
const adminToolsRoutes = require('./routes/adminTools');
   

// --- Initialization ---
const app = express(); // Initialize Express application
const prisma = new PrismaClient(); // Initialize Prisma Client
const PORT = process.env.PORT || 3001; // Use port from .env or default to 3001

// --- Middleware ---
// Enable CORS for all origins (adjust in production later for security)
app.use(cors());
// Enable Express to parse JSON request bodies (15mb limit for admin CSV/JSON import batches)
app.use(express.json({ limit: '15mb' }));

// --- Routes ---

// Basic root route to check if the server is running
app.get('/', (req, res) => {
  res.send('Hello from The Innocence Archive Backend!');
});

// Example API route to test database connection (AFTER running migrations)
// This route attempts a simple count query on the 'organizations' table
app.get('/api/test-db', async (req, res) => {
  console.log('Received request for /api/test-db'); // Log request
  try {
    // Ensure the 'organization' table exists (run migrations first!)
    const orgCount = await prisma.organization.count();
    console.log(`Found ${orgCount} organizations.`); // Log success
    res.json({
      message: 'Database connection successful!',
      organizationCount: orgCount
    });
  } catch (error) {
    console.error('Database connection error:', error); // Log error details
    res.status(500).json({
      message: 'Database connection failed',
      error: error.message // Send back error message
    });
  }
});

// --- TODO: Add your actual API routes here later ---
// --- API Routes ---
app.use('/api/individuals', individualRoutes); 
app.use('/api/mediaworks', mediaWorksRoutes);
app.use('/api/mediaitems', mediaItemsRoutes);
app.use('/api/organizations',organizationRoutes); 
app.use('/api/contributingfactors',contributingFactorRoutes); 
app.use('/api/crimecategories',crimeCategoryRoutes); 
app.use('/api/persons',involvedPersonRoutes); 
app.use('/api/updates', updateRoutes); 
app.use('/api/homepage', homepageRouter); // Mount at /api/homepage
app.use('/api/search', searchRoutes);
app.use('/api/settings', settingsRoutes); // Mount the routes
app.use('/api/auth', authRoutes);         
app.use('/api/admin/external-search', adminExternalApiRoutes); // <<< ADD THIS LINE
app.use('/api/admin/import', adminImportRoutes);
app.use('/api/admin/tools', adminToolsRoutes);
app.use('/api/admin', adminRoutes);
    



// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}`);
});

// --- Graceful Shutdown ---
// Optional: Ensures Prisma disconnects cleanly when server stops
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  console.log('Prisma Client disconnected. Server shutting down.');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  console.log('Prisma Client disconnected. Server shutting down.');
  process.exit(0);
});
