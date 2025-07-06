db = db.getSiblingDB('monitoring-alerts');

// Create application user
db.createUser({
  user: 'monitoring_app',
  pwd: 'monitoring_pass',
  roles: [
    {
      role: 'readWrite',
      db: 'monitoring-alerts'
    }
  ]
});

// Create alerts collection with validation
db.createCollection('alerts', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['alertId', 'alertName', 'alertType', 'severity', 'service', 'fingerprint'],
      properties: {
        alertId: { bsonType: 'string' },
        alertName: { bsonType: 'string' },
        alertType: { 
          bsonType: 'string',
          enum: ['service_down', 'service_recovery', 'high_error_rate', 'response_time', 'custom']
        },
        severity: { 
          bsonType: 'string',
          enum: ['info', 'warning', 'critical']
        },
        status: { 
          bsonType: 'string',
          enum: ['firing', 'resolved']
        },
        service: { bsonType: 'string' },
        fingerprint: { bsonType: 'string' }
      }
    }
  }
});

// Create alert summaries collection
db.createCollection('alert_summaries');

// Create indexes for performance
db.alerts.createIndex({ alertId: 1 }, { unique: true });
db.alerts.createIndex({ fingerprint: 1 });
db.alerts.createIndex({ service: 1, timestamp: -1 });
db.alerts.createIndex({ alertType: 1, timestamp: -1 });
db.alerts.createIndex({ severity: 1, timestamp: -1 });
db.alerts.createIndex({ status: 1, timestamp: -1 });
db.alerts.createIndex({ timestamp: -1 });
db.alerts.createIndex({ 'acknowledged.isAcknowledged': 1, timestamp: -1 });
db.alerts.createIndex({ environment: 1, timestamp: -1 });

// Compound indexes for common queries
db.alerts.createIndex({ service: 1, status: 1, timestamp: -1 });
db.alerts.createIndex({ alertType: 1, severity: 1, timestamp: -1 });

// TTL index to automatically delete old alerts after 90 days
db.alerts.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

// Index for alert summaries
db.alert_summaries.createIndex({ 
  date: 1, 
  service: 1, 
  alertType: 1, 
  severity: 1 
}, { unique: true });

print('MongoDB initialized successfully for monitoring alerts');
print('Created collections: alerts, alert_summaries');
print('Created user: monitoring_app');
print('Created indexes for optimal performance');