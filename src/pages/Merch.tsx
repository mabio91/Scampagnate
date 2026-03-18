import AppLayout from "@/components/layout/AppLayout";
import { MessageCircle, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import merchTshirt from "@/assets/merch-tshirt.jpg";
import merchHoodie from "@/assets/merch-hoodie.jpg";
import merchCap from "@/assets/merch-cap.jpg";
import merchBottle from "@/assets/merch-bottle.jpg";

const WHATSAPP_NUMBER = "923027858300";
const WHATSAPP_BASE = `https://wa.me/${WHATSAPP_NUMBER}`;

interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  image: string;
  badge?: string;
}

const products: Product[] = [
  {
    id: "tshirt",
    name: "T-Shirt Scampagnate",
    price: 25,
    description: "100% organic cotton, forest green with embroidered mountain logo. Unisex fit.",
    image: merchTshirt,
    badge: "Bestseller",
  },
  {
    id: "hoodie",
    name: "Hoodie Scampagnate",
    price: 55,
    description: "Heavyweight hoodie in cream with mountain & sun logo. Warm and cozy for outdoor adventures.",
    image: merchHoodie,
    badge: "New",
  },
  {
    id: "cap",
    name: "Cap Scampagnate",
    price: 18,
    description: "Adjustable baseball cap in dark green with embroidered logo. One size fits all.",
    image: merchCap,
  },
  {
    id: "bottle",
    name: "Borraccia Scampagnate",
    price: 22,
    description: "750ml stainless steel water bottle with carabiner clip. Keeps drinks cold for 24h.",
    image: merchBottle,
  },
];

const ProductCard = ({ product }: { product: Product }) => {
  const { t } = useLanguage();
  const whatsappUrl = `${WHATSAPP_BASE}?text=${encodeURIComponent(
    `Ciao! Vorrei acquistare: ${product.name} (€${product.price})`
  )}`;

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="relative aspect-square bg-muted">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {product.badge && (
          <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground text-[10px] font-body">
            {product.badge}
          </Badge>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-display text-sm font-bold text-foreground leading-tight">
            {product.name}
          </h3>
          <p className="text-lg font-display font-bold text-primary mt-1">
            €{product.price.toFixed(2)}
          </p>
        </div>
        <p className="text-xs font-body text-muted-foreground leading-relaxed">
          {product.description}
        </p>
        <Button
          className="w-full gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-body text-[11px] sm:text-sm px-2 sm:px-4 h-9 sm:h-10"
          onClick={() => window.open(whatsappUrl, "_blank")}
        >
          <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="truncate">{t("whatsapp")}</span>
        </Button>
      </CardContent>
    </Card>
  );
};

const Merch = () => {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold text-foreground">
              {t("merchandise")}
            </h1>
          </div>
          <p className="text-sm font-body text-muted-foreground">
            {t("merchDescription")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="rounded-xl bg-muted p-4 text-center space-y-1">
          <p className="text-xs font-body text-muted-foreground">
            {t("merchOrderInfo")}
          </p>
          <p className="text-xs font-body text-muted-foreground">
            {t("merchDeliveryInfo")}
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Merch;
