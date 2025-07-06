import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  alertId: string;
  alertName: string;
  alertType: 'service_down' | 'service_recovery' | 'high_error_rate' | 'response_time' | 'custom';
  severity: 'info' | 'warning' | 'critical';
  status: 'firing' | 'resolved';
  service: string;
  timestamp: Date;
  resolvedAt?: Date;
  duration?: number; // Duration in seconds if resolved
  metadata: {
    errorRate?: number;
    requestCount?: number;
    responseTime?: number;
    threshold?: number;
    actualValue?: number;
    errorMessage?: string;
    [key: string]: any;
  };
  labels: Record<string, string>;
  annotations: Record<string, string>;
  fingerprint: string; // Unique identifier for grouping related alerts
  notificationsSent: {
    slack?: {
      sent: boolean;
      timestamp: Date;
      channel: string;
      messageId?: string;
    };
    email?: {
      sent: boolean;
      timestamp: Date;
      recipients: string[];
    };
    webhook?: {
      sent: boolean;
      timestamp: Date;
      endpoint: string;
      statusCode?: number;
    };
  };
  acknowledged: {
    isAcknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date;
    reason?: string;
  };
  tags: string[];
  environment: string;
}

const AlertSchema = new Schema<IAlert>({
  alertId: { type: String, required: true, unique: true },
  alertName: { type: String, required: true },
  alertType: { 
    type: String, 
    required: true,
    enum: ['service_down', 'service_recovery', 'high_error_rate', 'response_time', 'custom']
  },
  severity: { 
    type: String, 
    required: true,
    enum: ['info', 'warning', 'critical']
  },
  status: { 
    type: String, 
    required: true,
    enum: ['firing', 'resolved'],
    default: 'firing'
  },
  service: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  duration: { type: Number },
  metadata: {
    errorRate: { type: Number },
    requestCount: { type: Number },
    responseTime: { type: Number },
    threshold: { type: Number },
    actualValue: { type: Number },
    errorMessage: { type: String },
    // Allow additional dynamic fields
    type: Schema.Types.Mixed,
    default: {}
  },
  labels: { type: Map, of: String, default: {} },
  annotations: { type: Map, of: String, default: {} },
  fingerprint: { type: String, required: true },
  notificationsSent: {
    slack: {
      sent: { type: Boolean, default: false },
      timestamp: { type: Date },
      channel: { type: String },
      messageId: { type: String }
    },
    email: {
      sent: { type: Boolean, default: false },
      timestamp: { type: Date },
      recipients: [{ type: String }]
    },
    webhook: {
      sent: { type: Boolean, default: false },
      timestamp: { type: Date },
      endpoint: { type: String },
      statusCode: { type: Number }
    }
  },
  acknowledged: {
    isAcknowledged: { type: Boolean, default: false },
    acknowledgedBy: { type: String },
    acknowledgedAt: { type: Date },
    reason: { type: String }
  },
  tags: [{ type: String }],
  environment: { type: String, default: 'production' }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  collection: 'alerts'
});

// Indexes for performance
AlertSchema.index({ alertId: 1 });
AlertSchema.index({ fingerprint: 1 });
AlertSchema.index({ service: 1, timestamp: -1 });
AlertSchema.index({ alertType: 1, timestamp: -1 });
AlertSchema.index({ severity: 1, timestamp: -1 });
AlertSchema.index({ status: 1, timestamp: -1 });
AlertSchema.index({ timestamp: -1 });
AlertSchema.index({ 'acknowledged.isAcknowledged': 1, timestamp: -1 });
AlertSchema.index({ environment: 1, timestamp: -1 });

// Compound indexes for common queries
AlertSchema.index({ service: 1, status: 1, timestamp: -1 });
AlertSchema.index({ alertType: 1, severity: 1, timestamp: -1 });

// TTL index to automatically delete old alerts (optional - 90 days)
AlertSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema);