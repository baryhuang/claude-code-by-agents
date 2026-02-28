# Streaming Deployment Configuration

This document provides configuration guidance for deploying Claude Ops-Deck with streaming support in cloud environments.

## Common Issue: Proxy Buffering

When deployed to cloud platforms, streaming often breaks due to proxy buffering. The backend sends streaming responses, but proxies/load balancers/CDNs buffer the entire response before forwarding it to the client.

## Backend Optimizations (Already Implemented)

The backend includes these headers to prevent buffering:

```javascript
{
  "X-Accel-Buffering": "no",        // Disable Nginx proxy buffering
  "X-Proxy-Buffering": "no",        // Disable other proxy buffering
  "Cache-Control": "no-cache, no-store, must-revalidate",
  "Pragma": "no-cache",             // HTTP/1.0 compatibility
  "Expires": "0",                   // Prevent caching
  "Transfer-Encoding": "chunked",   // Enable chunked responses
}
```

## Deployment-Specific Configurations

### 1. Nginx Proxy/Ingress

If using Nginx as a reverse proxy, add these directives:

```nginx
location /api/chat {
    proxy_pass http://backend;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 2. Kubernetes Nginx Ingress

Add these annotations to your Ingress resource:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
    nginx.ingress.kubernetes.io/proxy-request-buffering: "off"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/upstream-hash-by: "$request_uri"
spec:
  # your ingress spec
```

### 3. AWS Application Load Balancer (ALB)

ALB supports streaming by default, but ensure:

```yaml
# In your service annotations
service.beta.kubernetes.io/aws-load-balancer-backend-protocol: "http"
service.beta.kubernetes.io/aws-load-balancer-connection-idle-timeout: "300"
```

### 4. Google Cloud Load Balancer

For Google Cloud, disable buffering in the backend service:

```yaml
apiVersion: compute/v1
kind: BackendService
spec:
  backends:
    - group: your-backend-group
  connectionDraining:
    drainingTimeoutSec: 300
  # Disable buffering
  customRequestHeaders:
    - "X-Accel-Buffering: no"
```

### 5. Cloudflare

Cloudflare buffers responses by default. For streaming:

1. Set up a Page Rule or use Workers
2. Or use the "Stream" setting in Transform Rules
3. Consider using Cloudflare for SaaS for custom domains

```javascript
// Cloudflare Worker example
export default {
  async fetch(request) {
    // Bypass Cloudflare for streaming endpoints
    if (request.url.includes('/api/chat')) {
      const response = await fetch(request);
      return new Response(response.body, {
        headers: {
          ...response.headers,
          'cf-cache-status': 'BYPASS'
        }
      });
    }
    return fetch(request);
  }
}
```

### 6. Vercel/Netlify

These platforms may not support true streaming for long-running requests:

- **Vercel**: Has 10s timeout for Hobby plan, 60s for Pro
- **Netlify**: Functions timeout after 10s (background functions available)

For these platforms, consider:
- Using shorter polling instead of streaming
- Implementing WebSocket fallback
- Using external API hosting (like Railway, Render, or dedicated servers)

## Testing Streaming

### Backend Testing
Test your deployment with curl:

```bash
# Should show responses as they come in, not all at once
curl -N -X POST https://your-domain.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "requestId": "test-123"}'
```

### Frontend Debug Mode
Enable streaming debug mode in development:

```bash
# Add to frontend/.env.local
VITE_STREAMING_DEBUG=true
```

This will show detailed streaming performance metrics in the browser console:
- Connection timing
- Chunk sizes and frequencies  
- Latency measurements
- Proxy buffering warnings

### Expected Streaming Behavior
- **Working**: Responses appear word-by-word or in small chunks
- **Buffered**: Long pause, then entire response appears at once
- **Debug logs**: Show chunk sizes < 1KB and frequent updates

## Troubleshooting

### Symptoms of Buffering Issues:
- Frontend shows "Thinking..." for entire duration
- All messages appear at once when complete
- Long delay before any response

### Debug Steps:
1. Test with curl directly to your backend
2. Check proxy/load balancer logs
3. Verify headers are being sent correctly
4. Test with different deployment configurations

### Alternative Approaches:
If streaming cannot be enabled:
1. Implement polling-based updates
2. Use WebSocket connections
3. Switch to a streaming-friendly hosting platform

## Platform-Specific Notes

### Railway
- Supports streaming natively
- No special configuration needed

### Render
- Supports streaming with proper headers
- Make sure to use Web Service, not Static Site

### DigitalOcean App Platform
- May require specific configuration
- Check droplet vs app platform requirements

### Heroku
- Supports streaming
- Ensure dyno doesn't sleep during streaming

### AWS ECS/Fargate
- Works well with ALB
- Configure health checks appropriately

## Monitoring

Monitor for streaming health:
- Response time distribution
- Connection duration
- Buffer-related errors in logs
- Client-side timeout patterns