const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high'],
      message: '{VALUE} is not a valid priority'
    },
    required: [true, 'Priority is required']
  },
  deadline: {
    type: Date,
    required: [true, 'Deadline is required'],
    set: function(val) {
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
        return new Date(`${val}T23:59:59.999Z`);
      }
      return val;
    }
  },
  status: {
    type: String,
    enum: {
      values: ['todo', 'inProgress', 'completed'],
      message: '{VALUE} is not a valid status'
    },
    default: 'todo'
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project ID is required']
  },
  assigneeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator ID is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

taskSchema.virtual('isOverdue').get(function() {
  if (!this.deadline) return false;
  return this.deadline < new Date() && this.status !== 'completed';
});

module.exports = mongoose.model('Task', taskSchema);
