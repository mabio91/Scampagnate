import AppLayout from "@/components/layout/AppLayout";
import { ShoppingBag } from "lucide-react";

const Merch = () => {
  return (
    <AppLayout>
      <div className="px-4 py-8 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Merchandise</h1>
        <p className="text-muted-foreground font-body text-sm">
          Presto disponibile! Il merchandise ufficiale di Scampagnate.
        </p>
      </div>
    </AppLayout>
  );
};

export default Merch;
