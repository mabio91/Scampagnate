import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

export const RestrictionBanner = () => {
  const { restrictionMessage } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (restrictionMessage) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [restrictionMessage]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-destructive text-destructive-foreground py-2 px-4 shadow-md sticky top-0 z-[100] border-b border-destructive-foreground/10"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="text-xs sm:text-sm font-body font-semibold">
                {restrictionMessage}
              </p>
            </div>
            <button 
              onClick={() => setIsVisible(false)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
