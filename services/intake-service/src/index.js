require('dotenv').config();
const express = require('express');
const cors = require('cors');
const reportsRoutes = require('./routes/reports.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/reports', reportsRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'intake-service' }));

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`intake-service running on port ${PORT}`));
