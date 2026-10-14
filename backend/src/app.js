const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');


const taskRoutes = require('./routes/taskRoutes');
const projectRoutes = require('./routes/projectRoutes');


const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use('/api/projects/:projectId/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);



// 404
app.use(notFoundHandler);

// Error Handling
app.use(errorHandler);

module.exports = app;