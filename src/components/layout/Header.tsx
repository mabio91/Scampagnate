import { useState, useRef, useEffect } from "react";
import logo from "@/assets/logo.png";
import flagIt from "@/assets/flag-it.png";
import flagEn from "@/assets/flag-en.png";
import { Bell, Search, User, LogIn, Sun, Moon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import NotificationPanel from "@/components/notifications/NotificationPanel";

const Header = () => {
  const { user, profile } = useAuth();
  const { toggleSearch } = useSearch();
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadCount();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showNotifications]);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const toggleLanguage = () => {
    setLanguage(language === "it" ? "en" : "it");
  };

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 pt-safe">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 max-w-lg mx-auto overflow-hidden">
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          <img src={logo} alt="Scampagnate" className="h-8 sm:h-9 w-8 sm:w-9 rounded-full shrink-0" />
          <span className="font-display text-sm sm:text-base font-bold text-foreground truncate">Scampagnate</span>
        </Link>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {/* Language Switcher */}
          <button
            className="p-1.5 sm:p-2 rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
            onClick={toggleLanguage}
            aria-label={language === "it" ? "Switch to English" : "Passa all'italiano"}
          >
            <img
              src={language === "it" ? flagEn : flagIt}
              alt={language === "it" ? "English" : "Italiano"}
              className="h-4 sm:h-5 w-4 sm:w-5 rounded-sm object-cover"
            />
          </button>

          {mounted && (
            <button
              className="p-1.5 sm:p-2 rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
              onClick={toggleTheme}
              aria-label={t("toggleTheme")}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground" />
              ) : (
                <Moon className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground" />
              )}
            </button>
          )}
          <button
            className="p-1.5 sm:p-2 rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
            onClick={() => { navigate("/"); toggleSearch(); }}
            aria-label={t("search")}
          >
            <Search className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground" />
          </button>
          {user ? (
            <>
              <div className="relative" ref={notifRef}>
                <button
                  className="p-1.5 sm:p-2 rounded-xl hover:bg-muted transition-colors relative flex items-center justify-center"
                  aria-label={t("notifications")}
                  onClick={() => setShowNotifications((v) => !v)}
                >
                  <Bell className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground" />
                  {(unreadCount ?? 0) > 0 && (
                    <span className="absolute top-0 right-0 min-w-[14px] h-3.5 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {unreadCount! > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 z-50">
                    <NotificationPanel onClose={() => setShowNotifications(false)} />
                  </div>
                )}
              </div>
              <Link
                to="/profile"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs sm:text-sm font-body font-semibold overflow-hidden ml-0.5 sm:ml-1"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" loading="eager" />
                ) : (
                  profile?.first_name?.[0] || <User className="h-4 sm:h-4.5 w-4 sm:w-4.5" />
                )}
              </Link>
            </>
          ) : (
            <Link
              to="/auth"
              className="p-1.5 sm:p-2 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"
              aria-label={t("signIn")}
            >
              <LogIn className="h-4 sm:h-5 w-4 sm:w-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
