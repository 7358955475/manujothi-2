interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: 'load' | 'render' | 'interaction' | 'api';
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observer: PerformanceObserver | null = null;

  init() {
    if (!('performance' in window)) return;

    // Observe performance entries
    this.observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric(entry.name, entry.duration, 'load');
      }
    });

    this.observer.observe({ entryTypes: ['navigation', 'resource', 'measure'] });

    // Monitor Core Web Vitals
    this.measureCoreWebVitals();
  }

  private measureCoreWebVitals() {
    // First Contentful Paint
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            this.recordMetric('FCP', entry.startTime, 'load');
          }
        }
      });
      observer.observe({ entryTypes: ['paint'] });
    }

    // Largest Contentful Paint
    if ('LargestContentfulPaint' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('LCP', lastEntry.startTime, 'load');
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    }

    // Cumulative Layout Shift
    if ('LayoutShift' in window) {
      let clsValue = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!layoutEntry.hadRecentInput && layoutEntry.value) {
            clsValue += layoutEntry.value;
          }
        }
        this.recordMetric('CLS', clsValue, 'interaction');
      });
      observer.observe({ entryTypes: ['layout-shift'] });
    }
  }

  recordMetric(name: string, value: number, category: PerformanceMetric['category']) {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      category
    });

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}: ${value.toFixed(2)}ms`);
    }
  }

  getMetrics(category?: PerformanceMetric['category']): PerformanceMetric[] {
    return category 
      ? this.metrics.filter(m => m.category === category)
      : this.metrics;
  }

  getAverageMetric(name: string): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    
    const sum = filtered.reduce((acc, m) => acc + m.value, 0);
    return sum / filtered.length;
  }

  clearMetrics() {
    this.metrics = [];
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Auto-initialize in browser
if (typeof window !== 'undefined') {
  performanceMonitor.init();
}