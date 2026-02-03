import { useEffect, useRef } from 'react';

/**
 * Hook to keep the Render free tier service alive
 * Pings the server every 2 minutes to prevent spindown
 */
export const useKeepAlive = (enabled = true) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const ping = async () => {
      try {
        // Ping the current domain (works on any environment)
        const response = await fetch(window.location.origin, {
          method: 'HEAD', // HEAD request is lighter than GET
          cache: 'no-cache',
        });
        
        if (response.ok) {
          console.debug('[KeepAlive] Service ping successful');
        }
      } catch (error) {
        // Fail silently - don't disrupt user experience
        console.debug('[KeepAlive] Ping failed, service may be spinning down');
      }
    };

    // Initial ping after 1 minute (don't ping immediately on load)
    const initialTimeout = setTimeout(() => {
      ping();
      
      // Then ping every 2 minutes
      intervalRef.current = setInterval(ping, 2 * 60 * 1000); // 2 minutes
    }, 60 * 1000); // 1 minute initial delay

    // Cleanup
    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled]);
};
