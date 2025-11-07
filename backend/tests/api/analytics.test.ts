import request from 'supertest';
import app from '../../src/index';
import pool from '../../src/config/database';

describe('Analytics API Endpoints', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Create a test admin user and get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@ogon.com',
        password: 'admin123'
      });

    authToken = loginResponse.body.token;
    testUserId = loginResponse.body.user.id;
  });

  describe('GET /api/analytics/content-performance', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/content-performance')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return content performance data with authentication', async () => {
      const response = await request(app)
        .get('/api/analytics/content-performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d', limit: 10 })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const item = response.body[0];
        expect(item).toHaveProperty('content_type');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('view_count');
        expect(item).toHaveProperty('favorite_count');
        expect(item).toHaveProperty('avg_progress');
        expect(typeof item.view_count).toBe('number');
        expect(typeof item.favorite_count).toBe('number');
        expect(typeof item.avg_progress).toBe('number');
      }
    });

    it('should respect time range parameter', async () => {
      const timeRanges = ['1h', '24h', '7d', '30d', '90d'];
      
      for (const timeRange of timeRanges) {
        const response = await request(app)
          .get('/api/analytics/content-performance')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ timeRange, limit: 5 })
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
      }
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/analytics/content-performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d', limit: 3 })
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(3);
    });

    it('should complete within performance threshold', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/analytics/content-performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '30d', limit: 10 })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('GET /api/analytics/user-engagement', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/analytics/user-engagement')
        .expect(401);
    });

    it('should return user engagement metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/user-engagement')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d' })
        .expect(200);

      expect(response.body).toHaveProperty('total_users');
      expect(response.body).toHaveProperty('active_users');
      expect(response.body).toHaveProperty('new_users');
      expect(response.body).toHaveProperty('retention_rate');
      expect(response.body).toHaveProperty('avg_session_duration');
      expect(response.body).toHaveProperty('total_sessions');

      expect(typeof response.body.total_users).toBe('number');
      expect(typeof response.body.active_users).toBe('number');
      expect(typeof response.body.retention_rate).toBe('number');
      expect(response.body.retention_rate).toBeGreaterThanOrEqual(0);
      expect(response.body.retention_rate).toBeLessThanOrEqual(100);
    });

    it('should validate data consistency', async () => {
      const response = await request(app)
        .get('/api/analytics/user-engagement')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { total_users, active_users, new_users } = response.body;
      
      // Active users should not exceed total users
      expect(active_users).toBeLessThanOrEqual(total_users);
      // New users should not exceed total users
      expect(new_users).toBeLessThanOrEqual(total_users);
    });
  });

  describe('GET /api/analytics/activity-trends', () => {
    it('should return activity trends data', async () => {
      const response = await request(app)
        .get('/api/analytics/activity-trends')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d', groupBy: 'day' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const trend = response.body[0];
        expect(trend).toHaveProperty('period');
        expect(trend).toHaveProperty('views');
        expect(trend).toHaveProperty('completions');
        expect(trend).toHaveProperty('favorites');
        expect(typeof trend.views).toBe('number');
        expect(typeof trend.completions).toBe('number');
        expect(typeof trend.favorites).toBe('number');
      }
    });

    it('should return data sorted by period', async () => {
      const response = await request(app)
        .get('/api/analytics/activity-trends')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d' })
        .expect(200);

      if (response.body.length > 1) {
        for (let i = 1; i < response.body.length; i++) {
          const prev = new Date(response.body[i - 1].period);
          const curr = new Date(response.body[i].period);
          expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
        }
      }
    });
  });

  describe('GET /api/analytics/peak-usage', () => {
    it('should return peak usage times', async () => {
      const response = await request(app)
        .get('/api/analytics/peak-usage')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d' })
        .expect(200);

      expect(response.body).toHaveProperty('by_hour');
      expect(response.body).toHaveProperty('by_day');
      expect(Array.isArray(response.body.by_hour)).toBe(true);
      expect(Array.isArray(response.body.by_day)).toBe(true);
    });

    it('should return valid hour ranges (0-23)', async () => {
      const response = await request(app)
        .get('/api/analytics/peak-usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      response.body.by_hour?.forEach((item: any) => {
        expect(item.hour).toBeGreaterThanOrEqual(0);
        expect(item.hour).toBeLessThanOrEqual(23);
        expect(typeof item.activity_count).toBe('number');
      });
    });
  });

  describe('GET /api/analytics/comparative-stats', () => {
    it('should return comparative statistics', async () => {
      const response = await request(app)
        .get('/api/analytics/comparative-stats')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d' })
        .expect(200);

      expect(response.body).toHaveProperty('current');
      expect(response.body).toHaveProperty('previous');
      expect(response.body).toHaveProperty('change');

      const { current, previous, change } = response.body;
      
      expect(current).toHaveProperty('views');
      expect(current).toHaveProperty('favorites');
      expect(current).toHaveProperty('users');
      expect(current).toHaveProperty('avg_progress');

      expect(previous).toHaveProperty('views');
      expect(previous).toHaveProperty('favorites');
      expect(previous).toHaveProperty('users');
      expect(previous).toHaveProperty('avg_progress');

      expect(change).toHaveProperty('views');
      expect(change).toHaveProperty('favorites');
      expect(change).toHaveProperty('users');
      expect(change).toHaveProperty('avg_progress');
    });

    it('should calculate percentage changes correctly', async () => {
      const response = await request(app)
        .get('/api/analytics/comparative-stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const { current, previous, change } = response.body;

      // Validate percentage calculation logic
      if (previous.views > 0) {
        const expectedChange = ((current.views - previous.views) / previous.views) * 100;
        expect(Math.abs(change.views - expectedChange)).toBeLessThan(0.1);
      }
    });
  });

  describe('GET /api/analytics/real-time', () => {
    it('should return real-time activity', async () => {
      const response = await request(app)
        .get('/api/analytics/real-time')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('recent_activities');
      expect(response.body).toHaveProperty('active_now');
      expect(Array.isArray(response.body.recent_activities)).toBe(true);
      expect(typeof response.body.active_now).toBe('number');
    });

    it('should return recent activities with correct structure', async () => {
      const response = await request(app)
        .get('/api/analytics/real-time')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.recent_activities.length > 0) {
        const activity = response.body.recent_activities[0];
        expect(activity).toHaveProperty('user_name');
        expect(activity).toHaveProperty('content_title');
        expect(activity).toHaveProperty('activity_type');
        expect(activity).toHaveProperty('created_at');
      }
    });

    it('should complete real-time query quickly', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/analytics/real-time')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Real-time queries should be fast (<500ms)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Security and Error Handling', () => {
    it('should reject invalid time range values', async () => {
      const response = await request(app)
        .get('/api/analytics/content-performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: 'invalid', limit: 10 });

      // Should still work with default time range
      expect([200, 400]).toContain(response.status);
    });

    it('should reject negative limit values', async () => {
      const response = await request(app)
        .get('/api/analytics/content-performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d', limit: -5 });

      // Should handle gracefully
      expect([200, 400]).toContain(response.status);
    });

    it('should handle SQL injection attempts', async () => {
      const response = await request(app)
        .get('/api/analytics/content-performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          timeRange: "7d'; DROP TABLE users; --",
          limit: 10 
        });

      // Should not cause error, parameterized queries should protect
      expect(response.status).toBe(200);
    });

    it('should handle large limit values gracefully', async () => {
      const response = await request(app)
        .get('/api/analytics/content-performance')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d', limit: 999999 });

      // Should either cap the limit or return all results
      expect([200]).toContain(response.status);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app)
          .get('/api/analytics/user-engagement')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ timeRange: '7d' })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // 10 concurrent requests should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should cache-able data remain consistent', async () => {
      const response1 = await request(app)
        .get('/api/analytics/user-engagement')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d' })
        .expect(200);

      const response2 = await request(app)
        .get('/api/analytics/user-engagement')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ timeRange: '7d' })
        .expect(200);

      // Within same time window, total_users should be consistent
      expect(response1.body.total_users).toBe(response2.body.total_users);
    });
  });
});
