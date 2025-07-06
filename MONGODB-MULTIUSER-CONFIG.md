# MongoDB Multi-User Authentication Configuration

## User Accounts Overview

### 1. Root Admin User
- **Username**: `admin`
- **Password**: `admin123`
- **Role**: Root administrator
- **Purpose**: MongoDB server administration
- **Access**: Full database server access

### 2. Monitoring Application User
- **Username**: `monitoring_app`
- **Password**: `MonitoringApp2025!`
- **Role**: `monitoringAppRole` + `readWrite`
- **Purpose**: Main application database operations
- **Access**: Read/Write access to monitoring-alerts database
- **Connection String**: `mongodb://monitoring_app:MonitoringApp2025!@mongodb:27017/monitoring-alerts?authSource=admin`

### 3. Analytics User
- **Username**: `analytics_user`
- **Password**: `Analytics2025!`
- **Role**: `analyticsRole` + `read`
- **Purpose**: Dashboard and analytics queries
- **Access**: Read-only access to monitoring-alerts database
- **Connection String**: `mongodb://analytics_user:Analytics2025!@mongodb:27017/monitoring-alerts?authSource=admin`

### 4. Backup User
- **Username**: `backup_user`
- **Password**: `Backup2025!`
- **Role**: `backupRole` + `backup`
- **Purpose**: Database backup operations
- **Access**: Read access for backup operations
- **Connection String**: `mongodb://backup_user:Backup2025!@mongodb:27017/monitoring-alerts?authSource=admin`

### 5. Developer User
- **Username**: `dev_user`
- **Password**: `Developer2025!`
- **Role**: `read`
- **Purpose**: Development and testing (read-only)
- **Access**: Read-only access to monitoring-alerts database
- **Connection String**: `mongodb://dev_user:Developer2025!@mongodb:27017/monitoring-alerts?authSource=admin`

### 6. Database Administrator
- **Username**: `db_admin`
- **Password**: `DbAdmin2025!`
- **Role**: `dbAdmin` + `userAdmin` + `readWrite`
- **Purpose**: Database administration and user management
- **Access**: Full database administration for monitoring-alerts
- **Connection String**: `mongodb://db_admin:DbAdmin2025!@mongodb:27017/monitoring-alerts?authSource=admin`

### 7. API Service User
- **Username**: `api_service`
- **Password**: `ApiService2025!`
- **Role**: `readWrite`
- **Purpose**: External API service access
- **Access**: Read/Write access to monitoring-alerts database
- **Connection String**: `mongodb://api_service:ApiService2025!@mongodb:27017/monitoring-alerts?authSource=admin`

## Custom Roles

### monitoringAppRole
- **Privileges**: 
  - Full CRUD operations on monitoring-alerts database
  - Index management
  - Collection operations

### analyticsRole
- **Privileges**:
  - Read operations on all collections
  - List collections and indexes
  - Query optimization access

### backupRole
- **Privileges**:
  - Read access for backup operations
  - List databases capability
  - Collection metadata access

## Environment Variables for Different Services

### Main Application (monitoring-app)
```env
MONGODB_URL=mongodb://monitoring_app:MonitoringApp2025!@mongodb:27017/monitoring-alerts?authSource=admin
```

### Analytics Service
```env
MONGODB_URL=mongodb://analytics_user:Analytics2025!@mongodb:27017/monitoring-alerts?authSource=admin
```

### Backup Service
```env
MONGODB_URL=mongodb://backup_user:Backup2025!@mongodb:27017/monitoring-alerts?authSource=admin
```

### Development Environment
```env
MONGODB_URL=mongodb://dev_user:Developer2025!@mongodb:27017/monitoring-alerts?authSource=admin
```

## Security Best Practices

1. **Password Rotation**: Change passwords regularly
2. **Principle of Least Privilege**: Each user has only necessary permissions
3. **Authentication Source**: All users authenticate against admin database
4. **Network Security**: Use SSL/TLS in production
5. **Monitoring**: Log and monitor user access patterns
6. **Regular Audits**: Review user permissions periodically

## Production Considerations

1. **Strong Passwords**: Use complex passwords with special characters
2. **SSL/TLS**: Enable SSL/TLS for encrypted connections
3. **IP Whitelisting**: Restrict database access by IP address
4. **Connection Pooling**: Use connection pooling for better performance
5. **Monitoring**: Implement database monitoring and alerting
6. **Backup Strategy**: Regular automated backups with the backup user

## Usage Examples

### Connect with different users using MongoDB shell:

```bash
# Main application user
mongosh "mongodb://monitoring_app:MonitoringApp2025!@localhost:27017/monitoring-alerts?authSource=admin"

# Analytics user (read-only)
mongosh "mongodb://analytics_user:Analytics2025!@localhost:27017/monitoring-alerts?authSource=admin"

# Database admin
mongosh "mongodb://db_admin:DbAdmin2025!@localhost:27017/monitoring-alerts?authSource=admin"
```

### Application Code Examples:

```javascript
// Main application connection
const MongoClient = require('mongodb').MongoClient;
const url = 'mongodb://monitoring_app:MonitoringApp2025!@mongodb:27017/monitoring-alerts?authSource=admin';

// Analytics connection (read-only)
const analyticsUrl = 'mongodb://analytics_user:Analytics2025!@mongodb:27017/monitoring-alerts?authSource=admin';
```
