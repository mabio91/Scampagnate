import AppLayout from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Shield, Mail, Lock, Eye, Clock, UserCheck, Server, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const sections = {
  it: [
    {
      icon: Shield,
      title: "Titolare del Trattamento",
      content: `Scampagnate ("noi", "nostro") è il titolare del trattamento dei dati personali raccolti tramite questa applicazione. Per qualsiasi domanda relativa alla privacy, contattaci all'indirizzo: privacy@scampagnate.com`,
    },
    {
      icon: Eye,
      title: "Dati che Raccogliamo",
      content: `Raccogliamo i seguenti dati personali:

• **Dati di registrazione**: nome, cognome, email, numero di telefono
• **Dati del profilo**: foto profilo, bio, esperienza di trekking, frequenza attività
• **Dati di utilizzo**: eventi a cui ti iscrivi, preferenze, badge ottenuti
• **Dati tecnici**: indirizzo IP, tipo di browser, dispositivo utilizzato
• **Dati di pagamento**: elaborati in modo sicuro tramite Stripe (non conserviamo i dati della carta)`,
    },
    {
      icon: Lock,
      title: "Come Utilizziamo i Tuoi Dati",
      content: `I tuoi dati personali vengono utilizzati per:

• Gestire il tuo account e le iscrizioni agli eventi
• Inviarti notifiche relative agli eventi a cui sei iscritto
• Migliorare l'esperienza utente e personalizzare i contenuti
• Garantire la sicurezza durante le attività outdoor
• Comunicazioni di servizio e aggiornamenti importanti
• Adempiere ad obblighi di legge`,
    },
    {
      icon: UserCheck,
      title: "Visibilità del Profilo",
      content: `Adottiamo un modello di privacy a livelli:

• **Pubblico**: solo il tuo nome e la foto profilo sono visibili agli altri utenti
• **Partecipanti**: i partecipanti iscritti allo stesso evento possono vedere nome e avatar
• **Organizzatori e Admin**: hanno accesso a email e telefono per motivi organizzativi
• **Il tuo cognome** viene mostrato solo con l'iniziale (es. "Mario R.") per proteggere la tua identità`,
    },
    {
      icon: Server,
      title: "Conservazione e Sicurezza",
      content: `I tuoi dati sono conservati su server sicuri forniti da Supabase (infrastruttura AWS) con crittografia a riposo e in transito. Conserviamo i dati per il periodo necessario alla fornitura del servizio o per obblighi di legge. Puoi richiedere la cancellazione del tuo account e dei dati associati in qualsiasi momento.`,
    },
    {
      icon: Globe,
      title: "Cookie e Tecnologie di Tracciamento",
      content: `Utilizziamo:

• **Cookie tecnici**: necessari per il funzionamento dell'app (autenticazione, preferenze lingua/tema)
• **Analytics**: Vercel Analytics per statistiche anonime di utilizzo
• **Nessun cookie di profilazione** pubblicitaria di terze parti`,
    },
    {
      icon: Clock,
      title: "I Tuoi Diritti",
      content: `Ai sensi del GDPR (Regolamento UE 2016/679), hai diritto di:

• **Accesso**: richiedere una copia dei tuoi dati personali
• **Rettifica**: correggere dati inesatti o incompleti
• **Cancellazione**: richiedere la cancellazione dei tuoi dati
• **Portabilità**: ricevere i tuoi dati in formato strutturato
• **Opposizione**: opporti al trattamento dei tuoi dati
• **Revoca del consenso**: in qualsiasi momento

Per esercitare i tuoi diritti, contattaci a: privacy@scampagnate.com`,
    },
    {
      icon: Mail,
      title: "Contatti",
      content: `Per qualsiasi domanda o richiesta relativa alla privacy:

📧 Email: privacy@scampagnate.com
🌐 Sito: scampagnate.com

Ultimo aggiornamento: Marzo 2026`,
    },
  ],
  en: [
    {
      icon: Shield,
      title: "Data Controller",
      content: `Scampagnate ("we", "our") is the data controller for personal data collected through this application. For any privacy-related questions, contact us at: privacy@scampagnate.com`,
    },
    {
      icon: Eye,
      title: "Data We Collect",
      content: `We collect the following personal data:

• **Registration data**: first name, last name, email, phone number
• **Profile data**: profile photo, bio, trekking experience, activity frequency
• **Usage data**: events you register for, preferences, badges earned
• **Technical data**: IP address, browser type, device used
• **Payment data**: processed securely through Stripe (we do not store card details)`,
    },
    {
      icon: Lock,
      title: "How We Use Your Data",
      content: `Your personal data is used to:

• Manage your account and event registrations
• Send you notifications about events you're registered for
• Improve user experience and personalize content
• Ensure safety during outdoor activities
• Service communications and important updates
• Comply with legal obligations`,
    },
    {
      icon: UserCheck,
      title: "Profile Visibility",
      content: `We follow a tiered privacy model:

• **Public**: only your first name and profile photo are visible to other users
• **Participants**: registered participants of the same event can see names and avatars
• **Organizers & Admins**: have access to email and phone for organizational purposes
• **Your last name** is shown only as an initial (e.g., "Mario R.") to protect your identity`,
    },
    {
      icon: Server,
      title: "Storage & Security",
      content: `Your data is stored on secure servers provided by Supabase (AWS infrastructure) with encryption at rest and in transit. We retain data for as long as necessary to provide the service or to comply with legal obligations. You can request deletion of your account and associated data at any time.`,
    },
    {
      icon: Globe,
      title: "Cookies & Tracking Technologies",
      content: `We use:

• **Technical cookies**: necessary for app functionality (authentication, language/theme preferences)
• **Analytics**: Vercel Analytics for anonymous usage statistics
• **No third-party** advertising profiling cookies`,
    },
    {
      icon: Clock,
      title: "Your Rights",
      content: `Under the GDPR (EU Regulation 2016/679), you have the right to:

• **Access**: request a copy of your personal data
• **Rectification**: correct inaccurate or incomplete data
• **Erasure**: request deletion of your data
• **Portability**: receive your data in a structured format
• **Objection**: object to the processing of your data
• **Withdraw consent**: at any time

To exercise your rights, contact us at: privacy@scampagnate.com`,
    },
    {
      icon: Mail,
      title: "Contact",
      content: `For any privacy-related questions or requests:

📧 Email: privacy@scampagnate.com
🌐 Website: scampagnate.com

Last updated: March 2026`,
    },
  ],
};

const Privacy = () => {
  const { language, t } = useLanguage();
  const currentSections = sections[language];

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {language === "it" ? "Privacy Policy" : "Privacy Policy"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {language === "it"
                  ? "Come proteggiamo i tuoi dati personali"
                  : "How we protect your personal data"}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Intro */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-sm text-foreground leading-relaxed">
              {language === "it"
                ? "La tua privacy è importante per noi. Questa informativa descrive quali dati raccogliamo, come li utilizziamo e quali sono i tuoi diritti. Operiamo in conformità con il Regolamento Generale sulla Protezione dei Dati (GDPR)."
                : "Your privacy is important to us. This policy describes what data we collect, how we use it, and what your rights are. We operate in compliance with the General Data Protection Regulation (GDPR)."}
            </p>
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-4">
          {currentSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="flex items-center gap-2.5 text-base font-semibold">
                    <div className="p-1.5 rounded-lg bg-muted">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line prose-sm">
                    {section.content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                      if (part.startsWith("**") && part.endsWith("**")) {
                        return (
                          <strong key={i} className="text-foreground font-medium">
                            {part.slice(2, -2)}
                          </strong>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Scampagnate —{" "}
            {language === "it" ? "Tutti i diritti riservati" : "All rights reserved"}
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Privacy;
