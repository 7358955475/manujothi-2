import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { performanceMonitor } from './services/performance';

// Initialize performance monitoring
performanceMonitor.init();

// Record app start time
const appStartTime = performance.now();

const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Record initial render time
setTimeout(() => {
  performanceMonitor.recordMetric('App Initial Render', performance.now() - appStartTime, 'render');
}, 0);
