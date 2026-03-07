import { ReactNode } from "react";
import Header from "./Header";
import BottomNav from "./BottomNav";

const AppLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-lg mx-auto pb-20">{children}</main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
