import { Link } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";

const DeleteAccount = () => {
  return (
    <div className="px-4 pt-4 pb-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Eliminazione account e dati Scampagnate
          </h1>
          <p className="text-sm text-muted-foreground">Account e privacy</p>
        </div>
      </div>

      <div className="prose prose-sm max-w-none font-body text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/85 prose-a:text-primary">
        <p>
          Questa pagina spiega come richiedere l'eliminazione del tuo account Scampagnate e dei dati
          associati alla piattaforma.
        </p>

        <h2>Come eliminare l'account dall'app</h2>
        <p>
          Se riesci ancora ad accedere al tuo account Scampagnate, puoi avviare la cancellazione
          direttamente dall'app:
        </p>
        <ol>
          <li>Apri l'app Scampagnate.</li>
          <li>Accedi al tuo account.</li>
          <li>Vai su Profilo.</li>
          <li>Apri Modifica profilo.</li>
          <li>Nella sezione Account, seleziona Cancella account.</li>
          <li>Conferma la richiesta seguendo le istruzioni mostrate.</li>
        </ol>
        <p>
          Dopo la conferma, l'accesso all'account viene rimosso e i dati personali associati vengono
          eliminati o anonimizzati secondo le modalita descritte sotto.
        </p>

        <h2>Richiesta via email</h2>
        <p>
          Se non riesci piu ad accedere all'app, hai disinstallato l'app o non puoi usare il percorso
          in-app, puoi richiedere l'eliminazione scrivendo a:
        </p>
        <p>
          <a
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-primary-foreground no-underline"
            href="mailto:g.scampagnate@gmail.com?subject=Richiesta%20eliminazione%20account%20Scampagnate"
          >
            <Mail className="h-4 w-4" />
            g.scampagnate@gmail.com
          </a>
        </p>
        <p>Nell'email indica:</p>
        <ul>
          <li>l'indirizzo email associato al tuo account Scampagnate;</li>
          <li>che vuoi eliminare il tuo account e i dati associati;</li>
          <li>eventuali informazioni utili per identificare correttamente il profilo.</li>
        </ul>
        <p>
          Potremmo chiederti una verifica aggiuntiva per assicurarci che la richiesta provenga dal
          titolare dell'account.
        </p>

        <h2>Quali dati vengono eliminati</h2>
        <p>
          Quando elimini il tuo account Scampagnate, eliminiamo o anonimizziamo i dati personali
          associati al profilo, tra cui:
        </p>
        <ul>
          <li>dati dell'account e credenziali di accesso;</li>
          <li>nome, cognome, email, telefono e dati del profilo;</li>
          <li>foto profilo e preferenze personali;</li>
          <li>notifiche, eventi salvati, consensi e dati collegati all'uso dell'app;</li>
          <li>dati collegati a badge, punti, missioni e ricompense;</li>
          <li>token o identificativi usati per notifiche push.</li>
        </ul>

        <h2>Dati che potremmo conservare</h2>
        <p>
          Alcuni dati potrebbero essere conservati solo quando necessario per obblighi legali, fiscali,
          amministrativi, di sicurezza, prevenzione frodi, gestione di pagamenti, rimborsi,
          controversie o tutela dei diritti di Scampagnate e degli utenti.
        </p>
        <p>
          Quando possibile, questi dati vengono minimizzati o anonimizzati e non sono piu usati per
          finalita ordinarie dell'app.
        </p>

        <h2>Tempi di gestione</h2>
        <p>
          Le richieste di eliminazione vengono gestite il prima possibile. In condizioni normali,
          completiamo la richiesta entro 30 giorni dalla ricezione o dalla verifica dell'identita,
          salvo obblighi legali o motivi tecnici che richiedano tempi diversi.
        </p>

        <h2>App e sviluppatore</h2>
        <p>
          Questa procedura riguarda l'app Scampagnate, pubblicata su Google Play, e la piattaforma web
          disponibile su <a href="https://scampagnate.com">scampagnate.com</a>.
        </p>

        <h2>Contatti</h2>
        <p>
          Per domande sulla privacy o sulla gestione dei dati personali puoi contattarci a{" "}
          <a href="mailto:g.scampagnate@gmail.com">g.scampagnate@gmail.com</a>.
        </p>
        <p>
          <em>Ultimo aggiornamento: 17 maggio 2026</em>
        </p>
      </div>

      <div className="mt-8">
        <Link className="text-sm font-medium text-primary underline" to="/">
          Torna alla Home
        </Link>
      </div>
    </div>
  );
};

export default DeleteAccount;
