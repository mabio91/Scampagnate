import AppLayout from "@/components/layout/AppLayout";
import { CalendarDays } from "lucide-react";

const MyEvents = () => {
  return (
    <AppLayout>
      <div className="px-4 py-8 text-center">
        <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">I Miei Eventi</h1>
        <p className="text-muted-foreground font-body text-sm">
          Accedi per vedere i tuoi eventi registrati.
        </p>
      </div>
    </AppLayout>
  );
};

export default MyEvents;
