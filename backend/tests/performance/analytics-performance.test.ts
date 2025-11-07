import request from 'supertest';
import app from '../../src/index';

describe('Analytics Performance Benchmarks', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get authentication token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@ogon.com',
        password: 'admin123'
      });

    authToken = loginResponse.body.token;
  });

  // Helper function to measure performance
  const measurePerformance = async (
    endpoint: string,
    queryParams: any,
    iterations: number = 50
  ) => {
    const responseTimes: number[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      try {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${authToken}`)
          .query(queryParams);

        const endTime = Date.now();
        const responseTime = endTime - startTime;
        responseTimes.push(responseTime);

        if (response.status === 200) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }
    }

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const medianResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length / 2)];
    const successRate = (successCount / iterations) * 100;

    return {
      avgResponseTime: Number(avgResponseTime.toFixed(2)),
      minResponseTime,
      maxResponseTime,
      medianResponseTime,
      successRate: Number(successRate.toFixed(2)),
      totalRequests: iterations,
      successCount,
      errorCount
    };
  };

  describe('Endpoint Performance Benchmarks', () => {
    it('should benchmark content-performance endpoint', async () => {
      const metrics = await measurePerformance(
        '/api/analytics/content-performance',
        { timeRange: '7d', limit: 10 },
        50
      );

      console.log('Content Performance Metrics:', metrics);

      expect(metrics.avgResponseTime).toBeLessThan(1000); // < 1 second avg
      expect(metrics.successRate).toBe(100); // 100% success rate
      expect(metrics.maxResponseTime).toBeLessThan(2000); // < 2 seconds max
    }, 60000);

    it('should benchmark user-engagement endpoint', async () => {
      const metrics = await measurePerformance(
        '/api/analytics/user-engagement',
        { timeRange: '7d' },
        50
      );

      console.log('User Engagement Metrics:', metrics);

      expect(metrics.avgResponseTime).toBeLessThan(1000);
      expect(metrics.successRate).toBe(100);
      expect(metrics.maxResponseTime).toBeLessThan(2000);
    }, 60000);

    it('should benchmark activity-trends endpoint', async () => {
      const metrics = await measurePerformance(
        '/api/analytics/activity-trends',
        { timeRange: '7d', groupBy: 'day' },
        50
      );

      console.log('Activity Trends Metrics:', metrics);

      expect(metrics.avgResponseTime).toBeLessThan(1000);
      expect(metrics.successRate).toBe(100);
      expect(metrics.maxResponseTime).toBeLessThan(2000);
    }, 60000);

    it('should benchmark peak-usage endpoint', async () => {
      const metrics = await measurePerformance(
        '/api/analytics/peak-usage',
        { timeRange: '7d' },
        50
      );

      console.log('Peak Usage Metrics:', metrics);

      expect(metrics.avgResponseTime).toBeLessThan(1000);
      expect(metrics.successRate).toBe(100);
      expect(metrics.maxResponseTime).toBeLessThan(2000);
    }, 60000);

    it('should benchmark comparative-stats endpoint', async () => {
      const metrics = await measurePerformance(
        '/api/analytics/comparative-stats',
        { timeRange: '7d' },
        50
      );

      console.log('Comparative Stats Metrics:', metrics);

      expect(metrics.avgResponseTime).toBeLessThan(1000);
      expect(metrics.successRate).toBe(100);
      expect(metrics.maxResponseTime).toBeLessThan(2000);
    }, 60000);

    it('should benchmark real-time endpoint', async () => {
      const metrics = await measurePerformance(
        '/api/analytics/real-time',
        {},
        50
      );

      console.log('Real-time Activity Metrics:', metrics);

      expect(metrics.avgResponseTime).toBeLessThan(500); // Real-time should be faster
      expect(metrics.successRate).toBe(100);
      expect(metrics.maxResponseTime).toBeLessThan(1000);
    }, 60000);
  });

  describe('Load Testing', () => {
    it('should handle 100 concurrent requests to content-performance', async () => {
      const concurrentRequests = 100;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .get('/api/analytics/content-performance')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ timeRange: '7d', limit: 10 })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const successCount = responses.filter(r => r.status === 200).length;
      const successRate = (successCount / concurrentRequests) * 100;
      const avgResponseTime = totalTime / concurrentRequests;
      const throughput = concurrentRequests / (totalTime / 1000); // requests per second

      console.log('Load Test Results:', {
        totalRequests: concurrentRequests,
        totalTime,
        successRate: successRate.toFixed(2) + '%',
        avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
        throughput: throughput.toFixed(2) + ' req/s'
      });

      expect(successRate).toBeGreaterThanOrEqual(95); // At least 95% success
      expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
      expect(throughput).toBeGreaterThan(5); // At least 5 requests per second
    }, 30000);
  });

  describe('Query Optimization Tests', () => {
    it('should efficiently handle different time ranges', async () => {
      const timeRanges = ['1h', '24h', '7d', '30d', '90d'];
      const results: any[] = [];

      for (const timeRange of timeRanges) {
        const startTime = Date.now();
        const response = await request(app)
          .get('/api/analytics/content-performance')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ timeRange, limit: 10 });
        const endTime = Date.now();

        results.push({
          timeRange,
          responseTime: endTime - startTime,
          status: response.status
        });
      }

      console.log('Time Range Query Performance:', results);

      // All queries should complete within 2 seconds
      results.forEach(result => {
        expect(result.responseTime).toBeLessThan(2000);
        expect(result.status).toBe(200);
      });

      // Longer time ranges shouldn't be dramatically slower
      const longestQuery = Math.max(...results.map(r => r.responseTime));
      const shortestQuery = Math.min(...results.map(r => r.responseTime));
      const performanceDegradation = longestQuery / shortestQuery;

      expect(performanceDegradation).toBeLessThan(3); // No more than 3x slower
    }, 30000);

    it('should handle large limit values efficiently', async () => {
      const limits = [10, 50, 100, 500];
      const results: any[] = [];

      for (const limit of limits) {
        const startTime = Date.now();
        const response = await request(app)
          .get('/api/analytics/content-performance')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ timeRange: '7d', limit });
        const endTime = Date.now();

        results.push({
          limit,
          responseTime: endTime - startTime,
          status: response.status,
          resultCount: Array.isArray(response.body) ? response.body.length : 0
        });
      }

      console.log('Limit Query Performance:', results);

      // All queries should complete within 3 seconds
      results.forEach(result => {
        expect(result.responseTime).toBeLessThan(3000);
        expect(result.status).toBe(200);
      });
    }, 30000);
  });

  describe('Database Connection Pool Efficiency', () => {
    it('should handle sequential requests without connection issues', async () => {
      const requestCount = 50;
      let errorCount = 0;
      let successCount = 0;
      const responseTimes: number[] = [];

      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();
        try {
          const response = await request(app)
            .get('/api/analytics/user-engagement')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ timeRange: '7d' });

          const endTime = Date.now();
          responseTimes.push(endTime - startTime);

          if (response.status === 200) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const successRate = (successCount / requestCount) * 100;

      console.log('Sequential Request Results:', {
        totalRequests: requestCount,
        successCount,
        errorCount,
        successRate: successRate.toFixed(2) + '%',
        avgResponseTime: avgResponseTime.toFixed(2) + 'ms'
      });

      expect(successRate).toBe(100); // No connection pool exhaustion
      expect(errorCount).toBe(0);
      expect(avgResponseTime).toBeLessThan(1000);
    }, 60000);
  });

  describe('Memory and Resource Efficiency', () => {
    it('should not degrade performance over multiple iterations', async () => {
      const iterations = 5;
      const requestsPerIteration = 20;
      const iterationMetrics: any[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const requests = Array(requestsPerIteration).fill(null).map(() =>
          request(app)
            .get('/api/analytics/content-performance')
            .set('Authorization', `Bearer ${authToken}`)
            .query({ timeRange: '7d', limit: 10 })
        );

        const responses = await Promise.all(requests);
        const endTime = Date.now();

        const successCount = responses.filter(r => r.status === 200).length;
        const avgResponseTime = (endTime - startTime) / requestsPerIteration;

        iterationMetrics.push({
          iteration: i + 1,
          avgResponseTime,
          successCount,
          successRate: (successCount / requestsPerIteration) * 100
        });
      }

      console.log('Performance Consistency Over Time:', iterationMetrics);

      // Performance should remain consistent (no memory leaks)
      const firstIterationTime = iterationMetrics[0].avgResponseTime;
      const lastIterationTime = iterationMetrics[iterations - 1].avgResponseTime;
      const performanceDrift = lastIterationTime / firstIterationTime;

      expect(performanceDrift).toBeLessThan(1.5); // No more than 50% degradation

      iterationMetrics.forEach(metric => {
        expect(metric.successRate).toBe(100);
      });
    }, 90000);
  });
});
