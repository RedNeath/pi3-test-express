var createError = require('http-errors');
var express = require('express');
var cors = require('cors');
var logger = require('morgan');

var transportRouter = require('./routes/transport');

var app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API routes
app.use('/v1', transportRouter);

// 404 handler for API
app.use(function(req, res, next) {
  next(createError(404, 'Not Found'));
});

// Centralized JSON error handler
app.use(function(err, req, res, next) {
  const status = err.status || 500;
  const isDev = req.app.get('env') === 'development';
  const payload = {
    status,
    message: err.message || 'Internal Server Error'
  };
  if (isDev && err.stack) {
    payload.stack = err.stack;
  }
  res.status(status).json(payload);
});

module.exports = app;
