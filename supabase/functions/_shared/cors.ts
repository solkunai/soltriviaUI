// CORS Configuration
// For mobile apps, we allow all origins since requests come from the app bundle
// For web deployments, set ALLOWED_ORIGIN env var to your domain
const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://soltrivia.app';

// For mobile apps (React Native), Origin header may be absent or vary
// Use '*' for mobile app development, restrict for production web
const origin = Deno.env.get('CORS_MODE') === 'mobile' ? '*' : ALLOWED_ORIGIN;

export const corsHeaders = {
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper to get CORS headers with dynamic origin (for checking request origin)
export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  // For mobile apps, always allow
  if (Deno.env.get('CORS_MODE') === 'mobile') {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
  }

  // For web, check against allowed origins
  const allowedOrigins = [ALLOWED_ORIGIN, 'http://localhost:3000', 'http://localhost:19006'];
  const originToUse = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGIN;

  return {
    'Access-Control-Allow-Origin': originToUse,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
