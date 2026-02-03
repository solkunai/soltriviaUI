// CORS Configuration
// For mobile apps, we allow all origins since requests come from the app bundle
// For web deployments, set ALLOWED_ORIGINS env var to your domain(s)
// Supports multiple origins separated by commas

// @ts-ignore - Deno is available at runtime in Supabase Edge Functions
const ALLOWED_ORIGINS_STRING = Deno.env.get('ALLOWED_ORIGINS') || 
  'https://soltrivia.app,https://soltrivia.fun,https://soltriviaui.onrender.com,http://localhost:3000,http://localhost:19006';

// Parse allowed origins from environment variable or use defaults
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING.split(',').map((origin: string) => origin.trim()).filter(Boolean);

// For mobile apps (React Native), Origin header may be absent or vary
// Use '*' for mobile app development, restrict for production web
// @ts-ignore - Deno is available at runtime in Supabase Edge Functions
const isMobileMode = Deno.env.get('CORS_MODE') === 'mobile';

// Helper to get CORS headers with dynamic origin (for checking request origin)
export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  // For mobile apps, always allow
  if (isMobileMode) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Max-Age': '86400', // 24 hours
    };
  }

  // For web, check against allowed origins
  // If request origin matches an allowed origin, use it
  // If no origin provided or not in list, use first allowed origin (fallback)
  // This allows requests from allowed domains and provides a safe fallback
  let originToUse: string;
  
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    originToUse = requestOrigin;
  } else if (ALLOWED_ORIGINS.length > 0) {
    // Fallback to first allowed origin if origin not provided or not in list
    originToUse = ALLOWED_ORIGINS[0];
  } else {
    // If no allowed origins configured, deny (shouldn't happen)
    originToUse = 'null';
  }

  return {
    'Access-Control-Allow-Origin': originToUse,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Helper to get CORS headers from a Request object
export function getCorsHeadersFromRequest(req: { headers: { get: (key: string) => string | null } }): Record<string, string> {
  const requestOrigin = req.headers.get('origin') || undefined;
  return getCorsHeaders(requestOrigin);
}

// Legacy export for backwards compatibility
export const corsHeaders = {
  'Access-Control-Allow-Origin': isMobileMode ? '*' : (ALLOWED_ORIGINS[0] || '*'),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
