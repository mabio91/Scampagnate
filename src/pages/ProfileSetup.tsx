import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, Info } from "lucide-react";
import { motion } from "framer-motion";

const calculateExperienceGrade = (trekking: string, activity: string) => {
  if (trekking === "0-2") {
    if (activity === "rarely" || activity === "1-2/week") return 1;
    if (activity === ">2/week") return 2;
  }
  if (trekking === "3-5") {
    if (activity === "rarely") return 2;
    if (activity === "1-2/week") return 3;
    if (activity === ">2/week") return 4;
  }
  if (trekking === "5+") {
    if (activity === "rarely") return 3;
    if (activity === "1-2/week") return 4;
    if (activity === ">2/week") return 5;
  }
  return 1; // Default
};

const ProfileSetup = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [phone, setPhone] = useState(profile?.phone || "");
  const [trekkingExp, setTrekkingExp] = useState(profile?.trekking_experience || "");
  const [activityFreq, setActivityFreq] = useState(profile?.activity_frequency || "");

  useEffect(() => {
    if (profile?.phone && profile?.trekking_experience && profile?.activity_frequency) {
      navigate("/", { replace: true });
    }
  }, [profile, navigate]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file || !user) return;

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      if (updateError) throw updateError;

      await refreshProfile();
      toast({ title: "Photo updated!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!phone.trim()) {
      toast({ title: "Phone number required", variant: "destructive" });
      return;
    }
    if (!trekkingExp || !activityFreq) {
      toast({ title: "Please answer all experience questions", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const grade = calculateExperienceGrade(trekkingExp, activityFreq);

      const { error } = await supabase.from("profiles").update({
        phone: phone.trim(),
        trekking_experience: trekkingExp,
        activity_frequency: activityFreq,
        experience_grade: grade,
      }).eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast({ title: "Profile setup complete!", description: "Welcome to Scampagnate." });
      navigate("/", { replace: true });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-8 bg-card p-6 rounded-2xl shadow-sm border border-border">
        
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl font-bold text-foreground">Complete Your Profile</h1>
          <p className="text-sm font-body text-muted-foreground">Just a few more details before you can join events.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          <div className="flex flex-col items-center">
            <div className="relative mb-3">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold overflow-hidden border-2 border-background shadow-md">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile.first_name?.[0] || "?"
                )}
              </div>
              <button
                type="button"
                className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" className="hidden" />
            <p className="text-xs font-body text-muted-foreground">Upload a profile photo (optional)</p>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="phone" className="font-body text-sm font-semibold">Phone Number *</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+39 333 1234567" className="mt-1.5" />
              <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-secondary" />
                <p>Your phone number will only be used for event-related purposes such as coordination, last-minute updates, or emergency communication from the organizers. This information will not be publicly visible to other participants.</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <h3 className="font-display font-bold text-base mb-2">Experience & Activity</h3>
              <p className="text-xs font-body text-muted-foreground mb-4">
                To help us recommend events that match your experience and ensure everyone's safety during outdoor activities, we ask a couple of quick questions about your trekking experience and physical activity habits. Your answers help organizers plan activities responsibly and avoid situations where participants may accidentally join events that are too demanding.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-body text-sm font-semibold">How many trekking or hiking experiences have you completed so far?</Label>
                  <div className="grid grid-cols-1 gap-2 mt-1.5">
                    {["0-2", "3-5", "5+"].map(opt => (
                      <button
                        key={opt} type="button" onClick={() => setTrekkingExp(opt)}
                        className={`text-left px-3 py-2.5 rounded-xl border text-sm font-body transition-colors ${trekkingExp === opt ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border hover:border-primary/30"}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-body text-sm font-semibold">How often do you usually practice physical activity?</Label>
                  <div className="grid grid-cols-1 gap-2 mt-1.5">
                    {[
                      { val: ">2/week", label: "More than 2 times per week" },
                      { val: "1-2/week", label: "1–2 times per week" },
                      { val: "rarely", label: "Rarely" }
                    ].map(opt => (
                      <button
                        key={opt.val} type="button" onClick={() => setActivityFreq(opt.val)}
                        className={`text-left px-3 py-2.5 rounded-xl border text-sm font-body transition-colors ${activityFreq === opt.val ? "border-primary bg-primary/5 text-primary font-semibold" : "border-border hover:border-primary/30"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-full h-12 font-body font-semibold">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Complete Setup"}
          </Button>

        </form>
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
