
const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 120
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: ''
  },
  deadline: {
    type: Date,
    required: true
  },
  teamLeaderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  memberIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true,
  versionKey: false
});

projectSchema.index({ teamLeaderId: 1 });
projectSchema.index({ memberIds: 1 });

module.exports =
  mongoose.models.Project ||
  mongoose.model('Project', projectSchema);
