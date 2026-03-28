import { Home, CalendarDays, ShoppingBag, User, ClipboardList } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const BottomNav = () => {
  const location = useLocation();
  const { isOrganizer } = useAuth();
  const { t } = useLanguage();

  const navItems = [
    { icon: Home, label: t("home"), path: "/" },
    { icon: CalendarDays, label: t("myEvents"), path: "/my-events" },
    ...(isOrganizer ? [{ icon: ClipboardList, label: t("organize"), path: "/organizer" }] : []),
    { icon: ShoppingBag, label: t("merch"), path: "/shop" },
    { icon: User, label: t("profile"), path: "/profile" },
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe">
      <div className="flex items-center justify-around max-w-lg mx-auto px-2 py-1.5">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center gap-0.5 px-2 sm:px-3 py-2 rounded-xl transition-all duration-200 touch-target justify-center press-scale ${
                active
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <item.icon className={`h-5 w-5 transition-all duration-200 ${active ? "stroke-[2.5]" : ""}`} />
              <span className={`text-[10px] font-body leading-tight transition-all duration-200 ${active ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
