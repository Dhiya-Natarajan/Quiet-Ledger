require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const internalRoutes = require('./routes/internal.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/internal', internalRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'identity-service' }));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`identity-service running on port ${PORT}`));
