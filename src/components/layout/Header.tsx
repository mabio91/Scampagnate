import { useState, useRef, useEffect } from "react";
import logo from "@/assets/logo.png";
import { Bell, CalendarDays, Search, User, LogIn, Sun, Moon } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useTheme } from "next-themes";
import { useLanguage } from "@/contexts/LanguageContext";
import NotificationPanel from "@/components/notifications/NotificationPanel";

const Header = () => {
  const { user, profile } = useAuth();
  const { searchOpen, toggleSearch, openSearch } = useSearch();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadCount();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { t } = useLanguage();

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

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 header-safe-top">
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-2.5 max-w-lg mx-auto">
        <Link to="/" className="flex items-center gap-2 min-w-0 shrink">
          <img src={logo} alt="Scampagnate" className="h-9 sm:h-10 w-9 sm:w-10 rounded-full shrink-0" />
          <span className="font-display text-base sm:text-lg font-bold text-foreground truncate">Scampagnate</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {mounted && (
            <button
              type="button"
              className="p-2 rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
              onClick={toggleTheme}
              aria-label={t("toggleTheme")}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-[18px] sm:h-5 w-[18px] sm:w-5 text-muted-foreground" />
              ) : (
                <Moon className="h-[18px] sm:h-5 w-[18px] sm:w-5 text-muted-foreground" />
              )}
            </button>
          )}
          <button
            type="button"
            className="p-2 rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
            onClick={() => navigate("/calendar")}
            aria-label="Apri calendario eventi"
            aria-current={location.pathname === "/calendar" ? "page" : undefined}
          >
            <CalendarDays className="h-[18px] sm:h-5 w-[18px] sm:w-5 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="p-2 rounded-xl hover:bg-muted transition-colors flex items-center justify-center"
            onClick={() => {
              if (location.pathname === "/") {
                toggleSearch();
                return;
              }
              navigate("/");
              openSearch();
            }}
            aria-label={t("search")}
            aria-pressed={location.pathname === "/" ? searchOpen : false}
          >
            <Search className="h-[18px] sm:h-5 w-[18px] sm:w-5 text-muted-foreground" />
          </button>
          {user ? (
            <>
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  className="p-2 rounded-xl hover:bg-muted transition-colors relative flex items-center justify-center"
                  aria-label={t("notifications")}
                  onClick={() => setShowNotifications((v) => !v)}
                >
                  <Bell className="h-[18px] sm:h-5 w-[18px] sm:w-5 text-muted-foreground" />
                  {(unreadCount ?? 0) > 0 && (
                    <span className="absolute top-0 right-0 min-w-[14px] h-3.5 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                      {unreadCount! > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)_+_4.25rem)] z-[60] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-auto">
                    <NotificationPanel onClose={() => setShowNotifications(false)} />
                  </div>
                )}
              </div>
              <Link
                to="/profile"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm sm:text-base font-body font-semibold overflow-hidden ml-0.5 sm:ml-1"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" loading="eager" />
                ) : (
                  profile?.first_name?.[0] || <User className="h-[18px] sm:h-5 w-[18px] sm:w-5" />
                )}
              </Link>
            </>
          ) : (
            <Link
              to="/auth"
              className="p-2 rounded-xl bg-primary text-primary-foreground flex items-center justify-center"
              aria-label={t("signIn")}
            >
              <LogIn className="h-[18px] sm:h-5 w-[18px] sm:w-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
