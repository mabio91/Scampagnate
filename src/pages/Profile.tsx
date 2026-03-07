import AppLayout from "@/components/layout/AppLayout";
import { User } from "lucide-react";

const Profile = () => {
  return (
    <AppLayout>
      <div className="px-4 py-8 text-center">
        <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Profilo</h1>
        <p className="text-muted-foreground font-body text-sm">
          Accedi per visualizzare il tuo profilo e i tuoi badge.
        </p>
      </div>
    </AppLayout>
  );
};

export default Profile;
