import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download, Loader2, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getSelfCheckInErrorMessage, invokeEventSelfCheckIn } from "@/lib/eventSelfCheckIn";

type EventCheckInQrDialogProps = {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EventCheckInQrDialog({ eventId, eventTitle, open, onOpenChange }: EventCheckInQrDialogProps) {
  const [checkInUrl, setCheckInUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateQr = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invokeEventSelfCheckIn({
        action: "generate",
        eventId,
        origin: window.location.origin,
      });
      if (!result.checkInUrl) throw new Error("SELF_CHECKIN_LINK_MISSING");
      const qr = await QRCode.toDataURL(result.checkInUrl, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: "M",
        color: {
          dark: "#24452d",
          light: "#ffffff",
        },
      });
      setCheckInUrl(result.checkInUrl);
      setQrDataUrl(qr);
      setExpiresAt(result.expiresAt || null);
    } catch (error) {
      const message = error instanceof Error ? error.message : null;
      toast({
        title: "QR non generato",
        description: getSelfCheckInErrorMessage(message),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (open && !checkInUrl && !loading) void generateQr();
  }, [checkInUrl, generateQr, loading, open]);

  const copyLink = async () => {
    if (!checkInUrl) return;
    await navigator.clipboard.writeText(checkInUrl);
    toast({ title: "Link copiato" });
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${eventTitle.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "evento"}-checkin-qr.png`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            QR check-in
          </DialogTitle>
          <DialogDescription>
            Mostralo all'ingresso: il partecipante conferma dal proprio account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex aspect-square items-center justify-center rounded-lg border bg-white p-3">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : qrDataUrl ? (
              <img src={qrDataUrl} alt="QR check-in evento" className="h-full w-full object-contain" />
            ) : (
              <QrCode className="h-12 w-12 text-muted-foreground" />
            )}
          </div>

          {expiresAt && (
            <p className="text-center text-xs text-muted-foreground">
              Valido fino al {new Date(expiresAt).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          )}

          {checkInUrl && (
            <p className="truncate rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {checkInUrl}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyLink} disabled={!checkInUrl}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadQr} disabled={!qrDataUrl}>
              <Download className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={generateQr} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
