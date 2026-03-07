import logo from "@/assets/logo.png";
import { Bell, Search, User, LogIn } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSearch } from "@/contexts/SearchContext";

const Header = () => {
  const { user, profile } = useAuth();
  const { openSearch } = useSearch();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Scampagnate" className="h-10 w-10 rounded-full" />
          <span className="font-display text-lg font-bold text-foreground">Scampagnate</span>
        </Link>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full hover:bg-muted transition-colors">
            <Search className="h-5 w-5 text-muted-foreground" />
          </button>
          {user ? (
            <>
              <button className="p-2 rounded-full hover:bg-muted transition-colors relative">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </button>
              <Link to="/profile" className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-body font-semibold overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  profile?.first_name?.[0] || <User className="h-4 w-4" />
                )}
              </Link>
            </>
          ) : (
            <Link to="/auth" className="p-2 rounded-full bg-primary text-primary-foreground">
              <LogIn className="h-5 w-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
