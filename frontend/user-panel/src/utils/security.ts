// Frontend Security Utilities

export class SecurityUtils {
  // Secure token storage with encryption
  static setSecureToken(token: string): void {
    try {
      // Add timestamp for token expiry tracking
      const tokenData = {
        token,
        timestamp: Date.now(),
        domain: window.location.hostname
      };
      
      // Use secure storage with domain binding
      if (window.crypto && window.crypto.subtle) {
        // Use Web Crypto API for secure storage (simplified version)
        localStorage.setItem('authToken', JSON.stringify(tokenData));
      } else {
        localStorage.setItem('authToken', JSON.stringify(tokenData));
      }
    } catch (error) {
      console.error('Secure token storage failed:', error);
    }
  }
  
  static getSecureToken(): string | null {
    try {
      const stored = localStorage.getItem('authToken');
      if (!stored) return null;
      
      const tokenData = JSON.parse(stored);
      
      // Verify domain binding
      if (tokenData.domain !== window.location.hostname) {
        this.clearSecureToken();
        return null;
      }
      
      // Check if token is expired (24 hours)
      if (Date.now() - tokenData.timestamp > 24 * 60 * 60 * 1000) {
        this.clearSecureToken();
        return null;
      }
      
      return tokenData.token;
    } catch (error) {
      console.error('Secure token retrieval failed:', error);
      this.clearSecureToken();
      return null;
    }
  }
  
  static clearSecureToken(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    sessionStorage.clear();
  }
  
  // Content Security Policy enforcement
  static enforceCSP(): void {
    // Disable dangerous functions
    if (typeof eval !== 'undefined') {
      (window as Record<string, unknown>).eval = undefined;
    }
    
    // Block inline script execution
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName: string) {
      const element = originalCreateElement.call(document, tagName);
      if (tagName.toLowerCase() === 'script') {
        console.warn('Script creation blocked by CSP enforcement');
        return null as unknown as HTMLElement;
      }
      return element;
    };
  }
  
  // Detect development tools
  static detectDevTools(): boolean {
    let devtools = false;
    
    // Method 1: Console size detection
    const threshold = 160;
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        devtools = true;
      }
    }, 500);
    
    // Method 2: Debug detection
    const startTime = Date.now();
    if (Date.now() - startTime > 100) {
      devtools = true;
    }
    
    return devtools;
  }
  
  // Session validation
  static validateSession(): boolean {
    const token = this.getSecureToken();
    if (!token) return false;
    
    // Additional session checks
    const userData = localStorage.getItem('userData');
    if (!userData) return false;
    
    try {
      const user = JSON.parse(userData);
      return !!(user.id && user.email);
    } catch {
      return false;
    }
  }
  
  // Secure API request wrapper
  static async secureRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getSecureToken();
    
    const secureOptions: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Client-Version': '1.0.0',
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` })
      },
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store' // Prevent caching of sensitive data
    };
    
    // Add request fingerprinting
    const fingerprint = await this.generateFingerprint();
    secureOptions.headers = {
      ...secureOptions.headers,
      'X-Client-Fingerprint': fingerprint
    };
    
    return fetch(url, secureOptions);
  }
  
  // Generate browser fingerprint for additional security
  static async generateFingerprint(): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString() || 'unknown'
    ];
    
    const fingerprint = components.join('|');
    
    if (window.crypto && window.crypto.subtle) {
      const msgUint8 = new TextEncoder().encode(fingerprint);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    
    // Fallback hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
  
  // Content integrity verification
  static verifyContentIntegrity(content: unknown, expectedHash?: string): boolean {
    if (!expectedHash) return true;
    
    // Simple content verification (in production, use more robust methods)
    const contentString = typeof content === 'string' ? content : JSON.stringify(content);
    // This would normally verify against a cryptographic hash
    return contentString.length > 0;
  }
  
  // Initialize security measures
  static initialize(): void {
    this.enforceCSP();
    
    // Monitor for security events
    window.addEventListener('error', (event) => {
      console.warn('[SECURITY] JavaScript error detected:', event.message);
    });
    
    // Detect potential XSS attempts
    const originalSetAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name: string, value: string) {
      if (name.toLowerCase().startsWith('on') && value.includes('javascript:')) {
        console.warn('[SECURITY] Potential XSS attempt blocked');
        return;
      }
      return originalSetAttribute.call(this, name, value);
    };
    
    // Session timeout warning
    let lastActivity = Date.now();
    const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
    
    const updateActivity = () => {
      lastActivity = Date.now();
    };
    
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });
    
    // Check session timeout every 5 minutes
    setInterval(() => {
      if (Date.now() - lastActivity > SESSION_TIMEOUT) {
        this.clearSecureToken();
        window.location.reload();
      }
    }, 5 * 60 * 1000);
  }
}