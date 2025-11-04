import { useEffect, useCallback, useRef } from 'react';

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
}

export const usePerformance = (componentName: string) => {
  const startTime = useRef<number>(performance.now());
  const metricsRef = useRef<PerformanceMetrics>({ loadTime: 0, renderTime: 0 });
  const componentNameRef = useRef(componentName);

  const measureRender = useCallback(() => {
    const renderEnd = performance.now();
    metricsRef.current.renderTime = renderEnd - startTime.current;
    
    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development') {
      const perfMemory = (performance as PerformanceNavigationTiming & { memory?: { usedJSHeapSize: number } }).memory;
      console.log(`[Performance] ${componentNameRef.current}:`, {
        renderTime: `${metricsRef.current.renderTime.toFixed(2)}ms`,
        memoryUsage: perfMemory ? 
          `${(perfMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB` : 
          'N/A'
      });
    }
  }, []);

  useEffect(() => {
    measureRender();
  }, [measureRender]);

  const logCustomMetric = useCallback((metricName: string, value: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentNameRef.current} - ${metricName}:`, `${value.toFixed(2)}ms`);
    }
  }, []);

  return { logCustomMetric, metrics: metricsRef.current };
};

export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

export const preloadAudio = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.oncanplaythrough = () => resolve();
    audio.onerror = reject;
    audio.preload = 'metadata';
    audio.src = src;
  });
};