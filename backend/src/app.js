const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');

const { loginLimiter } = require('./middleware/rateLimits');
const {
  errorHandler,
  notFoundHandler
} = require('./middleware/errorHandler');

const app = express();

// Security headers
app.use(helmet());

// Restrict cross-origin browser requests to configured frontend origins.
const allowedOrigins = (
  process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

// Limit the size of JSON request bodies.
app.use(express.json({ limit: '100kb' }));

app.use(morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
));

// Health and authentication routes
app.use('/api', healthRoutes);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Project and task routes
app.use('/api/projects/:projectId/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// 404 handler
app.use(notFoundHandler);

// Central error handler
app.use(errorHandler);

module.exports = app;
