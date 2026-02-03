// CORS Configuration
// For mobile apps, we allow all origins since requests come from the app bundle
// For web deployments, set ALLOWED_ORIGIN env var to your domain
// Supports multiple origins separated by commas
const ALLOWED_ORIGINS_STRING = Deno.env.get('ALLOWED_ORIGINS') || 
  'https://soltrivia.app,https://soltriviaui.onrender.com,http://localhost:3000,http://localhost:19006';

// Parse allowed origins from environment variable or use defaults
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING.split(',').map(origin => origin.trim());

// For mobile apps (React Native), Origin header may be absent or vary
// Use '*' for mobile app development, restrict for production web
const isMobileMode = Deno.env.get('CORS_MODE') === 'mobile';

// Default CORS headers (will be overridden by getCorsHeaders for dynamic origin checking)
export const corsHeaders = {
  'Access-Control-Allow-Origin': isMobileMode ? '*' : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper to get CORS headers with dynamic origin (for checking request origin)
export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  // For mobile apps, always allow
  if (isMobileMode) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
  }

  // For web, check against allowed origins
  // If request origin matches an allowed origin, use it; otherwise use the first allowed origin
  const originToUse = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) 
    ? requestOrigin 
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': originToUse,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Helper to get CORS headers from a Request object
export function getCorsHeadersFromRequest(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get('origin') || undefined;
  return getCorsHeaders(requestOrigin);
}
