const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config/default');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const scopeRoutes = require('./routes/scopeRoutes');
const staticHostRoutes = require('./routes/staticHostRoutes');
const leaseRoutes = require('./routes/leaseRoutes');
const serviceRoutes = require('./routes/serviceRoutes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/scopes', scopeRoutes);
app.use('/api/static-hosts', staticHostRoutes);
app.use('/api/leases', leaseRoutes);
app.use('/api/service', serviceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      dhcp4: config.dhcpService,
      ctrlAgent: config.ctrlAgentService
    },
    keaCtrlAgentUrl: config.keaCtrlAgentUrl,
    time: new Date().toISOString()
  });
});

// Serve frontend in production build if client/dist exists
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[API Error]:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(config.port, () => {
  console.log(`===============================================`);
  console.log(`Kea DHCP Server Web Management Service`);
  console.log(`URL:              http://localhost:${config.port}`);
  console.log(`DHCPv4 Service:   ${config.dhcpService}`);
  console.log(`Control Agent:    ${config.ctrlAgentService} (${config.keaCtrlAgentUrl})`);
  console.log(`Kea Config:       ${config.confPath}`);
  console.log(`Backups:          ${config.backupDir}`);
  console.log(`===============================================`);
});
