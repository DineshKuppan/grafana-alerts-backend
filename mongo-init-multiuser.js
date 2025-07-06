// MongoDB Multi-User Authentication Setup
// This script creates multiple users with different roles and permissions

print('Starting MongoDB multi-user authentication setup...');

// Switch to admin database for creating roles and users
db = db.getSiblingDB('admin');

// ===== CUSTOM ROLES =====

// Create custom role for monitoring application
db.createRole({
  role: 'monitoringAppRole',
  privileges: [
    {
      resource: { db: 'monitoring-alerts', collection: '' },
      actions: ['find', 'insert', 'update', 'remove', 'createIndex', 'dropIndex']
    },
    {
      resource: { db: 'monitoring-alerts', collection: 'alerts' },
      actions: ['find', 'insert', 'update', 'remove', 'createIndex', 'dropIndex']
    },
    {
      resource: { db: 'monitoring-alerts', collection: 'alert_summaries' },
      actions: ['find', 'insert', 'update', 'remove', 'createIndex', 'dropIndex']
    }
  ],
  roles: []
});

// Create custom role for read-only analytics
db.createRole({
  role: 'analyticsRole',
  privileges: [
    {
      resource: { db: 'monitoring-alerts', collection: '' },
      actions: ['find', 'listCollections', 'listIndexes']
    }
  ],
  roles: []
});

// Create custom role for backup operations
db.createRole({
  role: 'backupRole',
  privileges: [
    {
      resource: { db: 'monitoring-alerts', collection: '' },
      actions: ['find', 'listCollections', 'listIndexes']
    },
    {
      resource: { db: '', collection: '' },
      actions: ['listDatabases']
    }
  ],
  roles: []
});

// ===== USER CREATION =====

// 1. Main monitoring application user
db.createUser({
  user: 'monitoring_app',
  pwd: 'MonitoringApp2025!',
  roles: [
    { role: 'monitoringAppRole', db: 'admin' },
    { role: 'readWrite', db: 'monitoring-alerts' }
  ]
});

// 2. Analytics/Dashboard user (read-only)
db.createUser({
  user: 'analytics_user',
  pwd: 'Analytics2025!',
  roles: [
    { role: 'analyticsRole', db: 'admin' },
    { role: 'read', db: 'monitoring-alerts' }
  ]
});

// 3. Backup user
db.createUser({
  user: 'backup_user',
  pwd: 'Backup2025!',
  roles: [
    { role: 'backupRole', db: 'admin' },
    { role: 'backup', db: 'monitoring-alerts' }
  ]
});

// 4. Developer user (limited access)
db.createUser({
  user: 'dev_user',
  pwd: 'Developer2025!',
  roles: [
    { role: 'read', db: 'monitoring-alerts' }
  ]
});

// 5. Admin user for database administration
db.createUser({
  user: 'db_admin',
  pwd: 'DbAdmin2025!',
  roles: [
    { role: 'dbAdmin', db: 'monitoring-alerts' },
    { role: 'userAdmin', db: 'monitoring-alerts' },
    { role: 'readWrite', db: 'monitoring-alerts' }
  ]
});

// 6. API service user (specific for external API access)
db.createUser({
  user: 'api_service',
  pwd: 'ApiService2025!',
  roles: [
    { role: 'readWrite', db: 'monitoring-alerts' }
  ]
});

print('Custom roles created successfully');
print('Multiple users created with different permissions');

// ===== SWITCH TO APPLICATION DATABASE =====
db = db.getSiblingDB('monitoring-alerts');

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

// Create metrics collection for application metrics
db.createCollection('metrics');

// Create user sessions collection for audit trail
db.createCollection('user_sessions');

// ===== INDEXES =====

// Alerts collection indexes
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

// Alert summaries indexes
db.alert_summaries.createIndex({ 
  date: 1, 
  service: 1, 
  alertType: 1, 
  severity: 1 
}, { unique: true });

// Metrics collection indexes
db.metrics.createIndex({ timestamp: -1 });
db.metrics.createIndex({ service: 1, timestamp: -1 });
db.metrics.createIndex({ metricType: 1, timestamp: -1 });

// User sessions indexes (for audit trail)
db.user_sessions.createIndex({ userId: 1, timestamp: -1 });
db.user_sessions.createIndex({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

print('MongoDB multi-user setup completed successfully!');
print('');
print('Created users:');
print('1. monitoring_app - Main application user (readWrite)');
print('2. analytics_user - Analytics/Dashboard user (read-only)');
print('3. backup_user - Backup operations user');
print('4. dev_user - Developer user (read-only)');
print('5. db_admin - Database administrator');
print('6. api_service - API service user');
print('');
print('Created collections: alerts, alert_summaries, metrics, user_sessions');
print('Created indexes for optimal performance');
print('Created custom roles with specific permissions');
