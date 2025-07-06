import mongoose from 'mongoose';
import { Alert, IAlert } from '../models/alert';
import { AlertSummary, IAlertSummary } from '../models/alert-summary';
import { ServiceStatus } from '../types';
import { ErrorSummary } from './request-metrics';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface AlertQuery {
  service?: string;
  alertType?: string;
  severity?: string;
  status?: string;
  environment?: string;
  startDate?: Date;
  endDate?: Date;
  acknowledged?: boolean;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AlertStats {
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  infoAlerts: number;
  resolvedAlerts: number;
  unresolvedAlerts: number;
  avgResolutionTime: number;
  alertsByService: Record<string, number>;
  alertsByType: Record<string, number>;
  alertTrends: Array<{
    date: string;
    count: number;
    severity: string;
  }>;
}

export class MongoDBAlertStore {
  private isConnected: boolean = false;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    try {
      await mongoose.connect(this.connectionString, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      this.isConnected = true;
      logger.info('Connected to MongoDB for alert storage');
    } catch (error) {
      logger.error(`Failed to connect to MongoDB: ${error}`);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    }
  }

  // Generate fingerprint for alert grouping
  private generateFingerprint(service: string, alertType: string, metadata: any): string {
    const fingerprintData = {
      service,
      alertType,
      // Include relevant metadata for grouping
      threshold: metadata.threshold,
      route: metadata.route
    };
    return crypto.createHash('md5').update(JSON.stringify(fingerprintData)).digest('hex');
  }

  // Store service down/recovery alert
  async storeServiceAlert(status: ServiceStatus, alertType: 'service_down' | 'service_recovery'): Promise<IAlert> {
    const alertId = `${alertType}_${status.name}_${Date.now()}`;
    const fingerprint = this.generateFingerprint(status.name, alertType, {});
    
    const alertData: Partial<IAlert> = {
      alertId,
      alertName: alertType === 'service_down' ? `${status.name} Service Down` : `${status.name} Service Recovered`,
      alertType,
      severity: alertType === 'service_down' ? 'critical' : 'info',
      status: 'firing',
      service: status.name,
      timestamp: status.lastCheck,
      metadata: {
        responseTime: status.responseTime,
        errorMessage: status.error,
        actualValue: status.responseTime,
        threshold: alertType === 'service_down' ? 0 : undefined
      },
      labels: {
        service: status.name,
        alertname: alertType,
        severity: alertType === 'service_down' ? 'critical' : 'info'
      },
      annotations: {
        summary: alertType === 'service_down' 
          ? `${status.name} service is down`
          : `${status.name} service has recovered`,
        description: alertType === 'service_down'
          ? `${status.name} service is not responding. Error: ${status.error}`
          : `${status.name} service is now responding normally`
      },
      fingerprint,
      tags: [status.name, alertType],
      environment: process.env.NODE_ENV || 'production'
    };

    // If this is a recovery, try to resolve the previous down alert
    if (alertType === 'service_recovery') {
      await this.resolveAlertsByFingerprint(
        this.generateFingerprint(status.name, 'service_down', {}),
        status.lastCheck
      );
    }

    const alert = new Alert(alertData);
    await alert.save();
    
    logger.info(`Stored ${alertType} alert for ${status.name}: ${alertId}`);
    return alert;
  }

  // Store error rate alert
  async storeErrorAlert(errorSummary: ErrorSummary, severity: 'warning' | 'critical'): Promise<IAlert> {
    const alertId = `high_error_rate_${Date.now()}`;
    const fingerprint = this.generateFingerprint('system', 'high_error_rate', {
      threshold: errorSummary.errorRate
    });

    const alertData: Partial<IAlert> = {
      alertId,
      alertName: 'High Error Rate Detected',
      alertType: 'high_error_rate',
      severity,
      status: 'firing',
      service: 'system',
      timestamp: new Date(),
      metadata: {
        errorRate: errorSummary.errorRate,
        requestCount: errorSummary.totalRequests,
        actualValue: errorSummary.errorRate,
        threshold: 5.0, // 5% threshold
        timeWindow: errorSummary.timeWindow,
        services: errorSummary.services
      },
      labels: {
        alertname: 'high_error_rate',
        severity,
        error_rate: errorSummary.errorRate.toString(),
        total_requests: errorSummary.totalRequests.toString()
      },
      annotations: {
        summary: `High error rate: ${errorSummary.errorRate.toFixed(2)}%`,
        description: `Error rate of ${errorSummary.errorRate.toFixed(2)}% detected over ${errorSummary.totalRequests.toLocaleString()} requests`,
        runbook_url: 'https://your-runbook.com/high-error-rate'
      },
      fingerprint,
      tags: ['error_rate', 'high_traffic'],
      environment: process.env.NODE_ENV || 'production'
    };

    const alert = new Alert(alertData);
    await alert.save();
    
    logger.info(`Stored error rate alert: ${alertId} (${errorSummary.errorRate.toFixed(2)}%)`);
    return alert;
  }

  // Update notification status
  async updateNotificationStatus(
    alertId: string, 
    type: 'slack' | 'email' | 'webhook',
    data: any
  ): Promise<void> {
    const updateData: any = {};
    updateData[`notificationsSent.${type}`] = {
      sent: true,
      timestamp: new Date(),
      ...data
    };

    await Alert.updateOne({ alertId }, { $set: updateData });
    logger.debug(`Updated ${type} notification status for alert ${alertId}`);
  }

  // Resolve alerts by fingerprint
  async resolveAlertsByFingerprint(fingerprint: string, resolvedAt: Date = new Date()): Promise<number> {
    const result = await Alert.updateMany(
      { fingerprint, status: 'firing' },
      { 
        $set: { 
          status: 'resolved', 
          resolvedAt,
          duration: { $divide: [{ $subtract: [resolvedAt, '$timestamp'] }, 1000] }
        } 
      }
    );

    if (result.modifiedCount > 0) {
      logger.info(`Resolved ${result.modifiedCount} alerts with fingerprint ${fingerprint}`);
    }

    return result.modifiedCount;
  }

  // Acknowledge alert
  async acknowledgeAlert(alertId: string, acknowledgedBy: string, reason?: string): Promise<boolean> {
    const result = await Alert.updateOne(
      { alertId },
      {
        $set: {
          'acknowledged.isAcknowledged': true,
          'acknowledged.acknowledgedBy': acknowledgedBy,
          'acknowledged.acknowledgedAt': new Date(),
          'acknowledged.reason': reason
        }
      }
    );

    return result.modifiedCount > 0;
  }

  // Query alerts with filtering and pagination
  async queryAlerts(query: AlertQuery): Promise<{alerts: IAlert[], total: number}> {
    const filter: any = {};

    if (query.service) filter.service = query.service;
    if (query.alertType) filter.alertType = query.alertType;
    if (query.severity) filter.severity = query.severity;
    if (query.status) filter.status = query.status;
    if (query.environment) filter.environment = query.environment;
    if (query.acknowledged !== undefined) {
      filter['acknowledged.isAcknowledged'] = query.acknowledged;
    }
    if (query.tags && query.tags.length > 0) {
      filter.tags = { $in: query.tags };
    }
    if (query.startDate || query.endDate) {
      filter.timestamp = {};
      if (query.startDate) filter.timestamp.$gte = query.startDate;
      if (query.endDate) filter.timestamp.$lte = query.endDate;
    }

    const sortField = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(offset)
        .limit(limit)
        .lean(),
      Alert.countDocuments(filter)
    ]);

    return { alerts: alerts as IAlert[], total };
  }

  // Get alert statistics
  async getAlertStats(startDate?: Date, endDate?: Date): Promise<AlertStats> {
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = startDate;
      if (endDate) dateFilter.timestamp.$lte = endDate;
    }

    const [
      totalStats,
      serviceStats,
      typeStats,
      trendStats
    ] = await Promise.all([
      // Total stats
      Alert.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalAlerts: { $sum: 1 },
            criticalAlerts: {
              $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
            },
            warningAlerts: {
              $sum: { $cond: [{ $eq: ['$severity', 'warning'] }, 1, 0] }
            },
            infoAlerts: {
              $sum: { $cond: [{ $eq: ['$severity', 'info'] }, 1, 0] }
            },
            resolvedAlerts: {
              $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
            },
            unresolvedAlerts: {
              $sum: { $cond: [{ $eq: ['$status', 'firing'] }, 1, 0] }
            },
            avgResolutionTime: {
              $avg: { $cond: [{ $ne: ['$duration', null] }, '$duration', null] }
            }
          }
        }
      ]),

      // Service breakdown
      Alert.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$service',
            count: { $sum: 1 }
          }
        }
      ]),

      // Type breakdown
      Alert.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$alertType',
            count: { $sum: 1 }
          }
        }
      ]),

      // Daily trends
      Alert.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              severity: '$severity'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.date': 1 } }
      ])
    ]);

    const stats = totalStats[0] || {};
    const alertsByService = serviceStats.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const alertsByType = typeStats.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const alertTrends = trendStats.map((item: any) => ({
      date: item._id.date,
      count: item.count,
      severity: item._id.severity
    }));

    return {
      totalAlerts: stats.totalAlerts || 0,
      criticalAlerts: stats.criticalAlerts || 0,
      warningAlerts: stats.warningAlerts || 0,
      infoAlerts: stats.infoAlerts || 0,
      resolvedAlerts: stats.resolvedAlerts || 0,
      unresolvedAlerts: stats.unresolvedAlerts || 0,
      avgResolutionTime: stats.avgResolutionTime || 0,
      alertsByService,
      alertsByType,
      alertTrends
    };
  }

  // Get recent alerts for a service
  async getRecentAlertsForService(service: string, limit: number = 10): Promise<IAlert[]> {
    return Alert.find({ service })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean() as Promise<IAlert[]>;
  }

  // Get active (unresolved) alerts
  async getActiveAlerts(): Promise<IAlert[]> {
    return Alert.find({ status: 'firing' })
      .sort({ timestamp: -1 })
      .lean() as Promise<IAlert[]>;
  }

  // Generate daily summaries (can be run as a cron job)
  async generateDailySummaries(date: Date): Promise<void> {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const summaries = await Alert.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            service: '$service',
            alertType: '$alertType',
            severity: '$severity'
          },
          totalAlerts: { $sum: 1 },
          resolvedAlerts: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          unresolvedAlerts: {
            $sum: { $cond: [{ $eq: ['$status', 'firing'] }, 1, 0] }
          },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } },
          maxDuration: { $max: { $ifNull: ['$duration', 0] } },
          minDuration: { $min: { $ifNull: ['$duration', 999999] } },
          avgDuration: { $avg: { $ifNull: ['$duration', 0] } }
        }
      }
    ]);

    // Upsert summaries
    for (const summary of summaries) {
      await AlertSummary.findOneAndUpdate(
        {
          date: startDate,
          service: summary._id.service,
          alertType: summary._id.alertType,
          severity: summary._id.severity
        },
        {
          totalAlerts: summary.totalAlerts,
          resolvedAlerts: summary.resolvedAlerts,
          unresolvedAlerts: summary.unresolvedAlerts,
          totalDuration: summary.totalDuration,
          maxDuration: summary.maxDuration,
          minDuration: summary.minDuration === 999999 ? 0 : summary.minDuration,
          avgDuration: summary.avgDuration
        },
        { upsert: true, new: true }
      );
    }

    logger.info(`Generated daily summaries for ${date.toISOString().split('T')[0]}`);
  }

  // Health check for MongoDB connection
  async healthCheck(): Promise<boolean> {
    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      logger.error(`MongoDB health check failed: ${error}`);
      return false;
    }
  }
}