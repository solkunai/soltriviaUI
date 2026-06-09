import { useEffect, useState } from 'react';

/**
 * Returns true when the viewport is narrower than `breakpoint` (default 768px).
 * Resize-aware. Used to collapse multi-column V2 layouts to single column on
 * phones / PWA so the web UI matches the native dApp's clean mobile feel.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}
