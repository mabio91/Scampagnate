import { createContext, useContext, useCallback, type ReactNode } from "react";

export type Language = "it";

type TranslationKeys = typeof translations.it;

const translations = {
  it: {
    // Navigation
    home: "Home",
    myEvents: "I Miei Eventi",
    organize: "Organizza",
    merch: "Shop",
    profile: "Profilo",

    // Header
    search: "Cerca",
    toggleTheme: "Cambia tema",
    signIn: "Accedi",

    // Index / Home
    searchEvents: "Cerca eventi...",
    date: "Data",
    allPrices: "Tutti i prezzi",
    free: "Gratuito",
    paid: "A pagamento",
    clearAll: "Cancella tutto",
    searchResults: "Risultati ricerca",
    upcomingEvents: "Prossimi Eventi",
    noEventsFound: "Nessun evento trovato",
    clearFilters: "Cancella filtri",
    featuredEvent: "Evento in Evidenza",
    discover: "Scopri",
    today: "Oggi!",
    tomorrow: "Domani",
    past: "Passato",
    inDays: "Tra {days} giorni",
    spotsLeft: "{count} posti rimasti",

    // Event Card
    draft: "Bozza",
    open: "Aperto",
    full: "Pieno",
    closed: "Chiuso",
    cancelled: "Cancellato",

    // Event Detail
    description: "Descrizione",
    gallery: "Galleria",
    equipment: "Attrezzatura",
    mandatoryEquipment: "Attrezzatura Obbligatoria",
    recommendedEquipment: "Attrezzatura Consigliata",
    safetyNotice: "Avviso di sicurezza:",
    safetyNoticeText: "I partecipanti che si presentano senza l'attrezzatura obbligatoria richiesta potrebbero non essere ammessi all'attività per motivi di sicurezza.",
    meetingPoints: "Punti di Ritrovo",
    participants: "Partecipanti",
    joined: "Iscritti",
    noParticipantsYet: "Ancora nessun partecipante",
    signInAndJoin: "Accedi e iscriviti per vedere chi partecipa.",
    joinToSee: "Iscriviti per vedere chi partecipa.",
    beFirstToJoin: "Sii il primo a iscriverti.",
    signInAndBe: "Accedi e sii il primo a iscriverti.",
    organizer: "Organizzatore",
    viewProfile: "Vedi Profilo",
    contactInfoNotAvailable: "Informazioni di contatto non disponibili",
    signInToContact: "Accedi per contattare l'organizzatore",
    directions: "Indicazioni",
    addToCalendar: "Aggiungi al Calendario",
    distance: "Distanza",
    elevation: "Dislivello",
    duration: "Durata",
    spots: "Posti",
    price: "Prezzo",
    from: "Da",
    yourPrice: "Il tuo prezzo",
    deposit: "Acconto",
    total: "totale",
    payOnLocation: "paga in loco",
    eventClosed: "Evento Chiuso",
    signInToJoin: "Accedi per Iscriverti",
    approvalPending: "In Attesa di Approvazione",
    onWaitlist: "In Lista d'Attesa",
    payNow: "Paga Ora",
    registered: "Iscritto ✔",
    joinWaitlist: "Iscriviti alla Lista d'Attesa",
    viewRequirements: "Vedi Requisiti",
    joinEvent: "Iscriviti",
    requestManualApproval: "Richiedi approvazione manuale",
    cancelRegistration: "Cancella Iscrizione",
    cancelling: "Cancellazione...",

    // Registration Dialog
    registerFor: "Registrati per {title}",
    completeRegistration: "Completa la registrazione selezionando le opzioni richieste.",
    meetingPoint: "Punto di Ritrovo",
    sportLevel: "Livello Sportivo",
    beginner: "Principiante",
    intermediate: "Intermedio",
    advanced: "Avanzato",
    orEnterCustomLevel: "Oppure inserisci il livello personalizzato (es. 3.5 per padel)",
    helpsOrganizers: "Aiuta gli organizzatori a bilanciare le squadre e pianificare le attività",
    choosePricingOption: "Scegli l'opzione di prezzo",
    discountCode: "Codice Sconto",
    optional: "opzionale",
    membershipRequired: "Tessera Associativa Richiesta",
    membershipRenewalRequired: "Rinnovo Tessera Richiesto",
    orderSummary: "Riepilogo Ordine",
    event: "Evento",
    discountApplied: "Sconto applicato",
    remainingPayLater: "Rimanente (paga dopo)",
    paymentOnLocation: "Pagamento in loco — nessun addebito durante la registrazione.",
    membershipFee: "Quota associativa",
    totalDueToday: "Totale dovuto oggi",
    membershipIncludedInCheckout: "La quota associativa è inclusa in questo checkout Stripe.",
    fullPaymentViaStripe: "L'intero importo verrà addebitato online tramite Stripe.",
    depositViaStripe: "L'acconto verrà addebitato online tramite Stripe.",
    confirmRegistration: "Conferma Iscrizione",
    renewMembershipAndRegister: "Rinnova Tessera e Iscriviti",
    payMembershipAndRegister: "Paga Tessera e Iscriviti",
    submitRequest: "Invia Richiesta",
    redirectingToPayment: "Reindirizzamento al pagamento...",
    registering: "Registrazione...",
    submitting: "Invio...",
    equipmentConfirmation: "Ho l'attrezzatura obbligatoria richiesta",

    // Membership Info
    membershipCardTitle: "Tessera Associativa Scampagnate",
    membershipExpiredText: "La tua tessera associativa è scaduta. Per continuare a partecipare alle attività è necessario rinnovare la tessera.",
    membershipKeepId: "Il tuo numero di tessera verrà mantenuto.",
    membershipNewText: "Per partecipare alle attività organizzate dal Gruppo Scampagnate, è richiesta la tessera associativa annuale.",
    membershipAfterPayment: "Dopo il pagamento riceverai il tuo numero di tessera personale. La tessera fisica verrà consegnata durante il tuo primo evento.",
    membershipFeePerYear: "La quota associativa è di €10/anno e copre l'intero anno solare {year}.",

    // Payment Info
    fullPaymentOnline: "Pagamento Completo Online",
    paymentOnLocationTitle: "Pagamento in Loco",
    splitPayment: "Pagamento Rateale",
    totalPrice: "Prezzo totale",
    depositOnlineStripe: "Acconto (online via Stripe)",
    remainingBalance: "Saldo rimanente",
    remainingBalanceText: "Il saldo rimanente può essere pagato prima dell'evento o in loco.",
    fullAmountStripe: "L'intero importo verrà addebitato online tramite Stripe durante la registrazione.",
    paymentCollectedOnLocation: "Il pagamento verrà effettuato in loco all'evento.",
    depositRefundPolicy: "Il rimborso dell'acconto è soggetto a questa policy.",
    cancellationPolicy: "Policy di Cancellazione",

    // Access Warning
    accessRequirements: "Requisiti di accesso",
    requirementsNotMet: "Requisiti non soddisfatti:",
    accessWarningDefault: "Questo evento ha dei requisiti di partecipazione.",
    accessWarningText: "Puoi comunque richiedere l'approvazione manuale dell'organizzatore oppure contattarlo direttamente per maggiori informazioni.",
    contactOrganizer: "Contatta l'organizzatore",
    requestManualApprovalBtn: "Richiedi approvazione manuale",
    close: "Chiudi",

    // Private/Hidden
    private: "Privato",
    hidden: "Nascosto",

    // My Events
    upcoming: "Prossimi",
    saved: "Salvati",
    noUpcomingEvents: "Nessun evento prossimo.",
    browseEvents: "Esplora Eventi",
    noSavedEvents: "Nessun evento salvato.",
    tapBookmark: "Tocca l'icona segnalibro su qualsiasi evento per salvarlo.",
    noPastEvents: "Nessun evento passato.",
    share: "Condividi",
    calendar: "Calendario",
    cancel: "Cancella",
    cancelRegistrationTitle: "Cancellare l'Iscrizione?",
    cancelRegistrationText: "Sei sicuro di voler cancellare la tua iscrizione per {title}?",
    keep: "Mantieni",

    // Profile
    signInToViewProfile: "Accedi per vedere il tuo profilo.",
    firstName: "Nome",
    lastName: "Cognome",
    phone: "Telefono",
    bio: "Bio",
    categoryPreferences: "Preferenze Categorie",
    preferences: "Preferenze",
    membership: "Tessera",
    status: "Stato",
    activeMember: "Membro Attivo",
    expiredMember: "Scaduto",
    inactiveMember: "Membro Inattivo",
    foundingMember: "Founding Member",
    memberId: "Numero Tessera",
    memberSince: "Membro Dal",
    validUntil: "Valido Fino Al",
    membershipExpiredRenew: "La tua tessera è scaduta. Rinnova per continuare a partecipare agli eventi.",
    joinFirstEvent: "Iscriviti al tuo primo evento per attivare la tessera annuale e ricevere il tuo numero personale!",
    badges: "Badge",
    officialMember: "Membro ufficiale della community",
    nextBadge: "Prossimo badge",
    joinEventsToEarnBadges: "Partecipa agli eventi per guadagnare badge!",
    pastEvents: "Eventi Passati",
    noPastEventsJoinFirst: "Nessun evento passato. Partecipa al tuo primo evento!",
    helpAndInfo: "Aiuto e Informazioni",
    trekkingDifficultyGuide: "Guida Difficoltà Trekking",
    signOut: "Esci",
    profileUpdated: "Profilo aggiornato!",
    profilePhotoUpdated: "Foto profilo aggiornata!",
    points: "punti",
    copied: "Copiato!",
    memberIdCopied: "Numero Tessera #{id} copiato.",

    // Auth
    welcomeBack: "Bentornato!",
    joinUs: "Unisciti a Noi",
    signInToAccount: "Accedi al tuo account",
    createAccount: "Crea il tuo account Scampagnate",
    continueWithGoogle: "Continua con Google",
    continueWithApple: "Continua con Apple",
    orContinueWithEmail: "Oppure continua con email",
    email: "Email",
    password: "Password",
    rememberMe: "Ricordami",
    forgotPassword: "Password dimenticata?",
    signingIn: "Accesso...",
    signingUp: "Registrazione...",
    signUp: "Registrati",
    dontHaveAccount: "Non hai un account?",
    alreadyHaveAccount: "Hai già un account?",
    acceptPrivacy: "Accetto la",
    privacyPolicy: "Privacy Policy",
    and: "e i",
    termsOfService: "Termini di Servizio",
    viewDifficultyGuide: "Vedi Guida Difficoltà Trekking",
    learnCriteria: "Scopri i nostri 5 livelli standardizzati per partecipare agli eventi in sicurezza.",
    resetPassword: "Reset Password",
    resetPasswordDesc: "Inserisci la tua email e ti invieremo un link di reset",
    sendResetLink: "Invia Link di Reset",
    sending: "Invio...",
    backToSignIn: "Torna al Login",
    passwordStrengthWeak: "Debole",
    passwordStrengthFair: "Discreto",
    passwordStrengthGood: "Buono",
    passwordStrengthStrong: "Forte",
    atLeast8Chars: "Almeno 8 caratteri",
    uppercaseLetter: "Lettera maiuscola",
    lowercaseLetter: "Lettera minuscola",
    number: "Numero",
    specialCharacter: "Carattere speciale",
    accountCreated: "Benvenuto! Il tuo account è stato creato.",
    registrationComplete: "Registrazione completata! Controlla la tua email per confermare il tuo account.",
    errorAcceptPrivacy: "Devi accettare la privacy policy",
    emailSent: "Email inviata!",
    checkEmailReset: "Controlla la tua email per resettare la password.",
    enterYourEmail: "Inserisci la tua email",
    pleaseEnterEmail: "Per favore inserisci il tuo indirizzo email.",

    // Shop
    merchandise: "Shop",
    merchDescription: "Prodotti ufficiali Scampagnate. Contattaci via WhatsApp per acquistare.",
    whatsapp: "WhatsApp",
    merchOrderInfo: "Tutti gli ordini sono gestiti manualmente via WhatsApp.",
    merchDeliveryInfo: "I dettagli di consegna e pagamento saranno concordati direttamente con il team.",
    noProducts: "Nessun prodotto disponibile al momento.",
    backToShop: "Torna allo Shop",
    buyOnWhatsApp: "Acquista su WhatsApp",
    productNotFound: "Prodotto non trovato",
    productNotFoundDesc: "Il prodotto che stai cercando non esiste o non è più disponibile.",

    // Notifications
    notifications: "Notifiche",
    markAll: "Segna tutte",
    noNotifications: "Nessuna notifica",
    notificationsWillAppear: "Le notifiche appariranno qui",
    pushOn: "Push ON",
    push: "Push",
    openNavigation: "Apri Navigazione",

    // Not Found
    pageNotFound: "Oops! Pagina non trovata",
    returnToHome: "Torna alla Home",

    // Proposal
    proposeActivity: "Proponi Attività",
    haveIdea: "Hai un'idea per una nuova attività?",
    proposeIt: "Proponila alla community!",
    thankYouProposal: "Grazie per la tua proposta!",
    proposalReview: "Il team di Scampagnate la valuterà e potrebbe contattarti per organizzare l'attività.",
    proposeActivityTitle: "Proponi un'Attività",
    proposeActivityDesc: "Suggerisci una nuova attività alla community. Il team valuterà la tua proposta.",
    yourName: "Il tuo nome",
    activityTitle: "Titolo attività",
    whatIsIt: "Di cosa si tratta?",
    location: "Luogo",
    locationPlaceholder: "Città, luogo specifico o link Google Maps",
    suggestedDate: "Data suggerita",
    time: "Orario",
    maxParticipants: "Numero massimo partecipanti",
    submitProposal: "Invia Proposta",

    // Report Issue
    reportIssue: "Segnala un Problema",
    title: "Titolo",
    briefSummary: "Breve riepilogo del problema",
    descriptionLabel: "Descrizione",
    describeIssue: "Descrivi il problema in dettaglio...",
    priority: "Priorità",
    low: "Bassa",
    medium: "Media",
    high: "Alta",
    submitReport: "Invia Segnalazione",
    thankYouReporting: "Grazie per la segnalazione!",
    reportReceived: "Abbiamo ricevuto la tua segnalazione e la esamineremo al più presto.",
    pleaseFillFields: "Per favore compila tutti i campi",
    inputTooLong: "Testo troppo lungo",
    titleMax200: "Titolo max 200 caratteri, descrizione max 2000 caratteri.",

    // Toasts & messages
    error: "Errore",
    requestSent: "Richiesta inviata",
    manualApprovalSent: "La tua richiesta di approvazione manuale è stata inviata all'organizzatore.",
    addedToWaitlist: "Aggiunto alla lista d'attesa",
    waitlistNotify: "Sarai avvisato quando si libererà un posto per {title}",
    registrationConfirmed: "Iscrizione confermata",
    registeredFor: "Ti sei iscritto a {title}",
    registrationCancelled: "Iscrizione cancellata",
    registrationCancelledDesc: "La tua iscrizione è stata cancellata.",
    removedFromSaved: "Rimosso dai salvati",
    savedToWishlist: "Salvato nella wishlist",
    removedFromSavedEvents: "Rimosso dagli eventi salvati",
    paymentCompleted: "Pagamento completato",
    discountCoveredAmount: "Lo sconto ha coperto l'intero importo!",
    uploadError: "Errore di caricamento",

    statusPaid: "Pagato",
    attended: "Partecipato",
    noShow: "Non presentato",

    // Payment/Membership Success
    verifyingPayment: "Verifica pagamento...",
    verifyingPaymentDesc: "Stiamo verificando il tuo pagamento.",
    paymentConfirmedTitle: "Pagamento Confermato!",
    paymentConfirmedDesc: "Il pagamento è stato registrato. Sei ufficialmente iscritto all'evento!",
    backToEvent: "Torna all'evento",
    goToHome: "Vai alla Home",
    verificationError: "Errore di Verifica",
    verificationErrorDesc: "Non siamo riusciti a verificare il pagamento. Se hai già pagato, contatta il supporto.",
    paymentConfirmedToast: "Pagamento confermato!",
    paymentConfirmedToastDesc: "Il tuo pagamento è stato registrato con successo.",
    membershipActivatedTitle: "Tessera Attivata!",
    membershipActivatedDesc: "La tua tessera associativa Scampagnate è ora attiva. Puoi partecipare a tutti gli eventi!",
    membershipActivatedToast: "Tessera attivata!",
    membershipActivatedToastDesc: "La tua tessera associativa è ora attiva.",
    verifyingMembership: "Verifica in corso...",
    verifyingMembershipDesc: "Stiamo verificando il tuo pagamento e attivando la tessera.",

    // Profile Setup
    completeYourProfile: "Completa il tuo Profilo",
    fewMoreDetails: "Solo pochi dettagli prima di poter partecipare agli eventi.",
    uploadProfilePhoto: "Carica una foto profilo (opzionale)",
    phoneNumber: "Numero di Telefono *",
    phoneDisclaimer: "Il tuo numero di telefono verrà utilizzato esclusivamente per scopi legati agli eventi, come coordinamento, aggiornamenti dell'ultimo minuto o comunicazioni di emergenza da parte degli organizzatori. Questa informazione non sarà visibile pubblicamente agli altri partecipanti.",
    experienceAndActivity: "Esperienza e Attività",
    experienceExplanation: "Per aiutarci a consigliare eventi adatti alla tua esperienza e garantire la sicurezza di tutti durante le attività all'aperto, ti chiediamo un paio di domande rapide sulla tua esperienza di trekking e le tue abitudini di attività fisica. Le tue risposte aiutano gli organizzatori a pianificare le attività in modo responsabile.",
    trekkingQuestion: "Quante esperienze di trekking o escursioni hai completato finora?",
    activityQuestion: "Con che frequenza pratichi attività fisica?",
    moreThan2Week: "Più di 2 volte a settimana",
    oneToTwoWeek: "1–2 volte a settimana",
    rarely: "Raramente",
    saving: "Salvataggio...",
    completeSetup: "Completa Setup",
    photoUpdated: "Foto aggiornata!",
    phoneRequired: "Numero di telefono richiesto",
    answerAllQuestions: "Per favore rispondi a tutte le domande",
    profileSetupComplete: "Setup profilo completato!",
    welcomeToScampagnate: "Benvenuto in Scampagnate.",

    // Reset Password
    newPassword: "Nuova Password",
    newPasswordLabel: "Nuova password",
    confirmPasswordLabel: "Conferma password",
    updatePassword: "Aggiorna Password",
    updating: "Aggiornamento...",
    passwordUpdated: "Password aggiornata!",
    passwordsNoMatch: "Le password non corrispondono.",
    invalidLink: "Link non valido.",
    backToLogin: "Torna al Login",

    // Share
    shareEvent: "Condividi Evento",
    copyLink: "Copia Link",
    linkCopied: "Link copiato negli appunti",
    linkCopiedInstagram: "Link copiato! Incollalo nella tua storia Instagram",

    // Capacity
    onlySpotsLeft: "Solo {count} {count, plural, one {posto} other {posti}} rimasti",
    almostFull: "Quasi pieno",

    // Discount
    codeApplied: "Codice applicato: {code}",
    percentDiscount: "{value}% di sconto",
    amountDiscount: "€{value} di sconto",
    discountPlaceholder: "Codice sconto",
    apply: "Applica",
    validationError: "Errore durante la validazione",

    all: "Tutti",
    // Misc
    everyoneJoining: "Tutti i partecipanti a questo evento",
    meetingPointAssignments: "Assegnazioni punti di ritrovo:",
    participantAlreadyJoined: "partecipanti già iscritti.",
    noParticipantsSignIn: "Nessun partecipante ancora.",
    promoExpired: "Promozione scaduta",
  },
} as const;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof TranslationKeys, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const language: Language = "it";
  const setLanguage = useCallback((_lang: Language) => {}, []);

  const t = useCallback(
    (key: keyof TranslationKeys, params?: Record<string, string | number>): string => {
      let text = (translations.it as any)[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, String(v));
        });
      }
      return text;
    },
    []
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
