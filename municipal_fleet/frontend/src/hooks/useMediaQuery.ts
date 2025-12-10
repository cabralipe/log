import { useState, useEffect } from "react";

export interface UseMediaQueryReturn {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function useMediaQuery(): UseMediaQueryReturn {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkBreakpoints = () => {
      setIsMobile(window.matchMedia("(max-width: 767px)").matches);
      setIsTablet(window.matchMedia("(min-width: 768px) and (max-width: 1023px)").matches);
      setIsDesktop(window.matchMedia("(min-width: 1024px)").matches);
    };

    checkBreakpoints();
    window.addEventListener("resize", checkBreakpoints);
    return () => window.removeEventListener("resize", checkBreakpoints);
  }, []);

  return { isMobile, isTablet, isDesktop };
}