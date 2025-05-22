// src/components/ScrollToTop.jsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop Component
 * This component ensures that the window scrolls to the top (0,0)
 * whenever the route (pathname) changes.
 */
function ScrollToTop() {
  // Get the current location object, which contains the pathname
  const { pathname } = useLocation();

  // useEffect hook to perform a side effect (scrolling) after render,
  // specifically when the pathname changes.
  useEffect(() => {
    // Scroll the window to the top left corner.
    window.scrollTo(0, 0);
  }, [pathname]); // The effect re-runs only if the pathname changes.

  // This component does not render anything to the DOM itself.
  // Its purpose is purely to manage the scroll behavior.
  return null;
}

export default ScrollToTop;
