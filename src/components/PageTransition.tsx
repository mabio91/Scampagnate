import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { ReactNode, useRef, useEffect, useState } from "react";

interface PageTransitionProps {
  children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    // Simple heuristic: navigating to a deeper path = forward (1), back = backward (-1)
    const prevDepth = prevPath.current.split("/").filter(Boolean).length;
    const currDepth = location.pathname.split("/").filter(Boolean).length;
    
    if (currDepth > prevDepth) {
      setDirection(1);
    } else if (currDepth < prevDepth) {
      setDirection(-1);
    } else {
      // Same depth — check if going to "/" (home) means going back
      setDirection(location.pathname === "/" ? -1 : 1);
    }
    prevPath.current = location.pathname;
  }, [location.pathname]);

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, x: direction * 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -60 }}
      transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
