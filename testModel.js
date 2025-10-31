// testModel.js
const mongoose = require('mongoose');

// Connect to your MongoDB (use your dev/test connection string)
mongoose.connect('mongodb://localhost:27017/test', { useNewUrlParser: true, useUnifiedTopology: true });

const EventRegistration = require('./backend/models/eventRegistration');

console.log('Schema for uploadedFiles:', EventRegistration.schema.paths.uploadedFiles);

mongoose.disconnect();