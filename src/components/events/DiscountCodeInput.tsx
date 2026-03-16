import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Ticket, Check, X, Loader2 } from "lucide-react";

interface DiscountResult {
  valid: boolean;
  error?: string;
  discount_code_id?: string;
  discount_type?: string;
  discount_value?: number;
  original_price?: number;
  final_price?: number;
  description?: string;
}

interface DiscountCodeInputProps {
  eventId: string;
  userId: string;
  onDiscountApplied: (result: DiscountResult | null) => void;
}

const DiscountCodeInput = ({ eventId, userId, onDiscountApplied }: DiscountCodeInputProps) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiscountResult | null>(null);

  const validateCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("validate_discount_code", {
        p_code: code.trim(),
        p_event_id: eventId,
        p_user_id: userId,
      });
      if (error) throw error;
      const res = data as unknown as DiscountResult;
      setResult(res);
      onDiscountApplied(res.valid ? res : null);
    } catch {
      setResult({ valid: false, error: "Errore durante la validazione" });
      onDiscountApplied(null);
    } finally {
      setLoading(false);
    }
  };

  const clearDiscount = () => {
    setCode("");
    setResult(null);
    onDiscountApplied(null);
  };

  if (result?.valid) {
    return (
      <div className="p-3 rounded-xl bg-success/10 border border-success/20 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span className="text-xs font-body font-bold text-success">Codice applicato: {code.toUpperCase()}</span>
          </div>
          <button onClick={clearDiscount} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex justify-between text-xs font-body">
          <span className="text-muted-foreground">
            {result.discount_type === "percentage" ? `${result.discount_value}% di sconto` : `€${result.discount_value} di sconto`}
          </span>
          <div className="text-right">
            <span className="line-through text-muted-foreground mr-2">€{Number(result.original_price).toFixed(2)}</span>
            <span className="font-bold text-success">€{Number(result.final_price).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (result) setResult(null);
            }}
            placeholder="Codice sconto"
            className="pl-9 font-mono text-sm h-9"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), validateCode())}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={validateCode}
          disabled={!code.trim() || loading}
          className="h-9 px-3"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Applica"}
        </Button>
      </div>
      {result && !result.valid && (
        <p className="text-[11px] text-destructive font-body">{result.error}</p>
      )}
    </div>
  );
};

export default DiscountCodeInput;
