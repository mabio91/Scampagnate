import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { isMembershipActive, isMembershipExpired, getMembershipExpiryDate } from "@/lib/membership";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { User, LogOut, Edit3, Star, CreditCard, Copy, Crown, CheckCircle2, ChevronRight, Mountain, Lightbulb, HelpCircle, Users, Gift, Info, X } from "lucide-react";
import ProfileBadges from "@/components/profile/ProfileBadges";
import ProfileCompleteness from "@/components/profile/ProfileCompleteness";
import ProfileGamification from "@/components/profile/ProfileGamification";
import ProfileMissions from "@/components/profile/ProfileMissions";

import LevelAvatar from "@/components/LevelAvatar";
import ReportIssueDialog from "@/components/ReportIssueDialog";
import { DifficultyGuideDialog } from "@/components/events/DifficultyGuideDialog";
import ActivityProposalForm from "@/components/ActivityProposalForm";
import { ActivityHistory } from "@/components/profile/ActivityHistory";
import ProfileEditSheet from "@/components/profile/ProfileEditSheet";
import ConsentPrivacySection from "@/components/profile/ConsentPrivacySection";

const Profile = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDifficultyGuide, setShowDifficultyGuide] = useState(false);
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [showPointsInfo, setShowPointsInfo] = useState(false);

  if (!user) {
    return (
      <>
        <div className="px-4 py-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Profilo</h1>
          <p className="text-muted-foreground font-body text-sm mb-4">Accedi per visualizzare il tuo profilo</p>
          <Button onClick={() => navigate("/auth")} className="bg-primary text-primary-foreground font-body">Accedi</Button>
        </div>
      </>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <>
      <div className="px-4 py-4 scroll-smooth">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-6 animate-fade-in">
          <LevelAvatar
            avatarUrl={profile?.avatar_url}
            firstName={profile?.first_name}
            lastName={profile?.last_name}
            points={profile?.total_points || 0}
            size="lg"
            showBadge
          />
          <div className="flex-1">
            <h1 className="font-display text-xl font-bold text-foreground">
              {profile?.first_name} {profile?.last_name}
            </h1>
            <p className="text-sm font-body text-muted-foreground">{user.email}</p>
            <button
              onClick={() => setShowPointsInfo(prev => !prev)}
              className="text-xs font-body text-secondary mt-0.5 flex items-center gap-1 hover:opacity-80 transition-opacity active:scale-[0.97]"
            >
              <Star className="h-3 w-3" />{profile?.total_points || 0} punti
              <Info className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
          <button onClick={() => setShowEditSheet(true)} className="p-2 rounded-full hover:bg-muted transition-all duration-200 active:scale-90">
            <Edit3 className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Points Info Popover */}
        {showPointsInfo && (
          <div className="mb-4 animate-fade-in">
            <div className="relative p-4 rounded-2xl bg-card border border-border shadow-lg">
              <button
                onClick={() => setShowPointsInfo(false)}
                className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
              <h3 className="font-display text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                <Star className="h-4 w-4 text-secondary" /> Come funzionano i punti
              </h3>
              <div className="space-y-1.5 text-xs font-body text-muted-foreground leading-relaxed">
                <p>I punti ti aiutano a salire di livello nella community e a sbloccare badge, missioni e ricompense.</p>
                <p>Puoi guadagnare punti partecipando agli eventi, completando missioni e mantenendo il profilo aggiornato.</p>
                <p className="font-semibold text-foreground">Più punti accumuli, più avanzi nella community.</p>
              </div>
            </div>
          </div>
        )}

        {/* Profile Completeness */}
        <ProfileCompleteness
          onCompleteProfile={() => setShowEditSheet(true)}
        />

        {/* Membership Status Card */}
        <div className="mb-6">
          <h2 className="font-display text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-secondary" /> Tessera
          </h2>
          <div className={`p-4 rounded-2xl border ${
            isMembershipActive(profile) 
              ? 'bg-primary/5 border-primary/20' 
              : isMembershipExpired(profile)
                ? 'bg-warning/5 border-warning/20'
                : 'bg-muted/50 border-border/50'
          }`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-body text-muted-foreground uppercase tracking-wider font-bold">Stato tessera</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${
                    isMembershipActive(profile) ? 'bg-success animate-pulse' : isMembershipExpired(profile) ? 'bg-warning' : 'bg-muted-foreground'
                  }`} />
                  <span className={`text-sm font-display font-bold ${
                    isMembershipActive(profile) ? 'text-success' : isMembershipExpired(profile) ? 'text-warning' : 'text-muted-foreground'
                  }`}>
                    {isMembershipActive(profile) ? 'Attiva' : isMembershipExpired(profile) ? 'Scaduta' : 'Non attiva'}
                  </span>
                  {(profile as any)?.is_founding_member && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-bold uppercase tracking-wider">
                      <Crown className="h-3 w-3" /> Fondatore
                    </span>
                  )}
                </div>
              </div>
              {profile?.membership_id && (
                <div className="text-right">
                  <p className="text-xs font-body text-muted-foreground uppercase tracking-wider font-bold">Tessera N°</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(String(profile.membership_id));
                      toast({ title: "Copiato!", description: `ID tessera #${profile.membership_id} copiato` });
                    }}
                    className="flex items-center gap-1.5 mt-0.5 group cursor-pointer"
                  >
                    <p className="text-lg font-display font-bold text-foreground">#{profile.membership_id}</p>
                    <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                </div>
              )}
            </div>

            {isMembershipActive(profile) ? (
              <>
                <div className="mt-3 p-3 rounded-xl bg-success/10 border border-success/20">
                  <p className="text-sm font-body font-bold text-success">
                    Tessera attiva fino al {(() => {
                      const expiry = getMembershipExpiryDate(profile);
                      return expiry ? expiry.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '31/12/' + new Date().getFullYear();
                    })()}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-primary/10">
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase font-bold">Membro dal</p>
                    <p className="text-sm font-body font-semibold text-foreground">
                      {(() => {
                        const dateStr = profile.membership_registration_date || (profile as any).created_at;
                        return dateStr ? new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/D';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-body text-muted-foreground uppercase font-bold">Scadenza</p>
                    <p className="text-sm font-body font-semibold text-foreground">
                      {(() => {
                        const expiry = getMembershipExpiryDate(profile);
                        return expiry ? expiry.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/D';
                      })()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-primary/10">
                  <p className="text-[10px] font-body text-muted-foreground uppercase font-bold mb-1.5">Benefici inclusi</p>
                  <ul className="space-y-1.5">
                    <li className="text-xs font-body text-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" /> Copertura assicurativa base durante le attività
                    </li>
                    <li className="text-xs font-body text-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" /> Accesso a tutti gli eventi della community
                    </li>
                    <li className="text-xs font-body text-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success flex-shrink-0" /> Prezzi riservati ai soci
                    </li>
                  </ul>
                </div>
              </>
            ) : isMembershipExpired(profile) ? (
              <div className="mt-3 space-y-3">
                <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <p className="text-sm font-body font-bold text-warning">
                    La tua tessera è scaduta il 31/12/{(profile as any)?.membership_year || new Date().getFullYear() - 1}
                  </p>
                  <p className="text-xs font-body text-muted-foreground mt-1">
                    Rinnova per continuare a partecipare agli eventi
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/")}
                  className="w-full bg-primary text-primary-foreground font-body font-semibold"
                >
                  Rinnova la tessera
                </Button>
              </div>
            ) : (
              <div className="mt-3 p-4 rounded-xl border border-dashed border-border bg-muted/30 text-center">
                <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm font-display font-bold text-foreground mb-1">Non hai ancora una tessera attiva</p>
                <p className="text-xs font-body text-muted-foreground mb-3">
                  Attivala per partecipare agli eventi e ottenere la copertura assicurativa
                </p>
                <Button
                  onClick={() => navigate("/")}
                  className="w-full bg-primary text-primary-foreground font-body font-semibold"
                >
                  Scopri eventi
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Gamification: Points & Level */}
        <ProfileGamification />

        {/* Missions */}
        <ProfileMissions />

        {/* Rewards link */}
        <Link to="/rewards" className="flex items-center gap-3 py-3 px-1 mb-4 rounded-lg hover:bg-muted/50 transition-colors group animate-fade-in">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Gift className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-body font-semibold text-foreground">Le tue ricompense</p>
            <p className="text-xs font-body text-muted-foreground">Coupon, badge e premi sbloccati</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </Link>

        {/* Badges */}
        <ProfileBadges />


        {/* Activity History Dashboard */}
        <ActivityHistory />

        {/* Consensi & Privacy */}
        <ConsentPrivacySection />

        {/* Help & Information */}
        <div className="mb-8 animate-fade-in">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Aiuto e informazioni</h2>

          {/* Contenuti */}
          <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-2 mt-0">Contenuti</p>
          <div className="space-y-1 mb-5">
            <Link to="/page/chi-siamo" className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group">
              <Users className="h-4.5 w-4.5 text-secondary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-semibold text-foreground">Chi siamo</p>
                <p className="text-xs font-body text-muted-foreground">Scopri la community</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
            <button onClick={() => setShowDifficultyGuide(true)} className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group w-full text-left">
              <Mountain className="h-4.5 w-4.5 text-secondary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-semibold text-foreground">Guida difficoltà trekking</p>
                <p className="text-xs font-body text-muted-foreground">Come scegliere il livello giusto</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>

          {/* Community */}
          <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-2">Community</p>
          <div className="space-y-1 mb-5">
            <button onClick={() => setShowProposalForm(true)} className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group w-full text-left">
              <Lightbulb className="h-4.5 w-4.5 text-secondary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-semibold text-foreground">Proponi un'attività</p>
                <p className="text-xs font-body text-muted-foreground">Condividi la tua idea con il gruppo</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>

          {/* Supporto */}
          <p className="text-[10px] font-body font-bold text-muted-foreground uppercase tracking-widest mb-2">Supporto</p>
          <div className="space-y-1 mb-5">
            <Link to="/page/faq" className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group">
              <HelpCircle className="h-4.5 w-4.5 text-secondary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-semibold text-foreground">FAQ</p>
                <p className="text-xs font-body text-muted-foreground">Risposte rapide alle domande più comuni</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
            <a href="https://wa.me/393485315344" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-muted/50 transition-colors group">
              <svg className="h-[18px] w-[18px] text-secondary shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-semibold text-foreground">Chatta con noi</p>
                <p className="text-xs font-body text-muted-foreground">Scrivici su WhatsApp per assistenza</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </a>
            <ReportIssueDialog />
          </div>

          {/* Logout */}
          <div className="space-y-1 mt-1">
            <button onClick={handleSignOut} className="flex items-center gap-3 py-3 px-1 rounded-lg hover:bg-destructive/5 transition-colors group w-full text-left">
              <LogOut className="h-[18px] w-[18px] text-destructive/70 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-semibold text-destructive">Esci</p>
                <p className="text-xs font-body text-muted-foreground">Termina la sessione</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <ProfileEditSheet open={showEditSheet} onOpenChange={setShowEditSheet} />
      <DifficultyGuideDialog 
        open={showDifficultyGuide} 
        onOpenChange={setShowDifficultyGuide} 
      />
      <ActivityProposalForm
        open={showProposalForm}
        onOpenChange={setShowProposalForm}
      />
    </>
  );
};

export default Profile;
