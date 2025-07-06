# MongoDB Multi-User Authentication Setup

This project now includes a comprehensive multi-user authentication system for MongoDB with different users having specific roles and permissions.

## 🚀 Quick Start

1. **Start the services:**
   ```bash
   docker-compose up -d
   ```

2. **Test the authentication:**
   ```bash
   chmod +x test-mongodb-users.sh
   ./test-mongodb-users.sh
   ```

3. **Manage users:**
   ```bash
   chmod +x manage-mongodb-users.sh
   ./manage-mongodb-users.sh help
   ```

## 👥 User Accounts

### 1. 🔧 Main Application User
- **Username**: `monitoring_app`
- **Password**: `MonitoringApp2025!`
- **Purpose**: Primary application database operations
- **Permissions**: Read/Write access to monitoring-alerts database

### 2. 📊 Analytics User
- **Username**: `analytics_user`
- **Password**: `Analytics2025!`
- **Purpose**: Dashboard and analytics queries
- **Permissions**: Read-only access to monitoring-alerts database

### 3. 💾 Backup User
- **Username**: `backup_user`
- **Password**: `Backup2025!`
- **Purpose**: Database backup operations
- **Permissions**: Read access for backup operations

### 4. 🧑‍💻 Developer User
- **Username**: `dev_user`
- **Password**: `Developer2025!`
- **Purpose**: Development and testing
- **Permissions**: Read-only access to monitoring-alerts database

### 5. 🔐 Database Administrator
- **Username**: `db_admin`
- **Password**: `DbAdmin2025!`
- **Purpose**: Database administration and user management
- **Permissions**: Full database administration

### 6. 🌐 API Service User
- **Username**: `api_service`
- **Password**: `ApiService2025!`
- **Purpose**: External API service access
- **Permissions**: Read/Write access to monitoring-alerts database

## 🛠️ Custom Roles

### monitoringAppRole
- Full CRUD operations on monitoring-alerts database
- Index management capabilities
- Collection operations

### analyticsRole
- Read operations on all collections
- List collections and indexes
- Query optimization access

### backupRole
- Read access for backup operations
- List databases capability
- Collection metadata access

## 📝 Connection Strings

### Application Code
```javascript
// Main application
const MONGODB_URL = 'mongodb://monitoring_app:MonitoringApp2025!@mongodb:27017/monitoring-alerts?authSource=admin';

// Analytics service
const ANALYTICS_URL = 'mongodb://analytics_user:Analytics2025!@mongodb:27017/monitoring-alerts?authSource=admin';

// Backup service
const BACKUP_URL = 'mongodb://backup_user:Backup2025!@mongodb:27017/monitoring-alerts?authSource=admin';
```

### MongoDB Shell
```bash
# Main application user
mongosh "mongodb://monitoring_app:MonitoringApp2025!@localhost:27017/monitoring-alerts?authSource=admin"

# Analytics user
mongosh "mongodb://analytics_user:Analytics2025!@localhost:27017/monitoring-alerts?authSource=admin"

# Database admin
mongosh "mongodb://db_admin:DbAdmin2025!@localhost:27017/monitoring-alerts?authSource=admin"
```

## 🔧 Management Scripts

### Test All Users
```bash
./test-mongodb-users.sh
```

### List All Users
```bash
./manage-mongodb-users.sh list-users
```

### Test Specific User Connection
```bash
./manage-mongodb-users.sh test-connection monitoring_app
```

### Change User Password
```bash
./manage-mongodb-users.sh change-password monitoring_app
```

### Create New User
```bash
./manage-mongodb-users.sh create-user
```

### List Custom Roles
```bash
./manage-mongodb-users.sh list-roles
```

## 🗂️ Database Collections

The setup creates the following collections:
- `alerts` - Main alerts data with validation schema
- `alert_summaries` - Aggregated alert summaries
- `metrics` - Application metrics
- `user_sessions` - User session audit trail

## 🔍 Indexes

Optimized indexes for:
- Alert queries by service, type, severity
- Time-based queries with TTL
- Compound indexes for common query patterns
- Unique constraints on alert IDs and fingerprints

## 🚀 Environment-Specific Usage

### Development Environment
```bash
# Use dev user for read-only access
export MONGODB_URL="mongodb://dev_user:Developer2025!@localhost:27017/monitoring-alerts?authSource=admin"
```

### Production Environment
```bash
# Use main app user
export MONGODB_URL="mongodb://monitoring_app:MonitoringApp2025!@mongodb:27017/monitoring-alerts?authSource=admin"
```

### Analytics Environment
```bash
# Use analytics user for dashboards
export MONGODB_URL="mongodb://analytics_user:Analytics2025!@mongodb:27017/monitoring-alerts?authSource=admin"
```

## 🔐 Security Best Practices

### ✅ Implemented
- [x] Role-based access control (RBAC)
- [x] Principle of least privilege
- [x] Strong password policies
- [x] Authentication database isolation
- [x] Custom roles with specific permissions
- [x] Audit trail with user sessions

### 🔮 Production Recommendations
- [ ] Enable SSL/TLS encryption
- [ ] Implement IP whitelisting
- [ ] Set up password rotation policy
- [ ] Configure database monitoring
- [ ] Enable audit logging
- [ ] Use certificate-based authentication

## 📊 Monitoring & Troubleshooting

### Check User Permissions
```bash
# Connect as admin and check user info
mongosh "mongodb://admin:admin123@localhost:27017/admin"
> db.runCommand({usersInfo: "monitoring_app"})
```

### View User Sessions
```bash
# Check active sessions
mongosh "mongodb://monitoring_app:MonitoringApp2025!@localhost:27017/monitoring-alerts?authSource=admin"
> db.user_sessions.find().sort({timestamp: -1}).limit(5)
```

### Monitor Database Performance
```bash
# Check database stats
mongosh "mongodb://db_admin:DbAdmin2025!@localhost:27017/monitoring-alerts?authSource=admin"
> db.stats()
> db.alerts.getIndexes()
```

## 🔄 Backup & Recovery

### Create Backup
```bash
# Using backup user
mongodump --uri="mongodb://backup_user:Backup2025!@localhost:27017/monitoring-alerts?authSource=admin" --out=./backup/$(date +%Y%m%d)
```

### Restore Database
```bash
# Using admin user
mongorestore --uri="mongodb://admin:admin123@localhost:27017/monitoring-alerts?authSource=admin" ./backup/20240101/monitoring-alerts/
```

## 📚 Additional Resources

- [MongoDB Security Documentation](https://docs.mongodb.com/manual/security/)
- [Role-Based Access Control](https://docs.mongodb.com/manual/core/authorization/)
- [Authentication Mechanisms](https://docs.mongodb.com/manual/core/authentication/)

## 🆘 Support

For issues or questions:
1. Check the logs: `docker-compose logs mongodb`
2. Test user connections: `./test-mongodb-users.sh`
3. Verify user permissions: `./manage-mongodb-users.sh list-users`
4. Review the configuration: `MONGODB-MULTIUSER-CONFIG.md`
