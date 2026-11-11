# Readymade — Software Sovereignty & Resilience Pitch Brief (EN / DE)

- [English Version](#english-version)
- [Deutsche Version](#deutsche-version)

---

<a id="english-version"></a>

# English Version: Software Sovereignty for Citizens & Communities

## 1. The Core Problem: Digital Dependency in Everyday Life

When a sports club needs a court-booking system, a neighborhood group wants to coordinate shared tools, a family wants to track health data, or a small craft business wants to organize customer requests, they face a false choice:

1. **Rent from Big Tech / SaaS:** Adopt a centralized platform that locks in their data, dictates the rules, charges per-seat subscriptions, or monetizes their attention and privacy.
2. **Wait or Hire:** Wait for a commercial vendor to build the exact feature they need, or pay for custom software development that they can neither understand nor maintain themselves.

Even today's "AI app builders" mostly deepen this trap: they generate thousands of lines of opaque code that non-coders cannot audit, secure, or repair when something breaks.

---

## 2. The Readymade Thesis: Composable, Observable, Ownable Tools

Readymade treats software not as a black-box product you rent, but as **composable craft made from inspected, standard building blocks ("services")**.

Instead of writing sprawling codebases, people (and AI assistants) assemble small, self-contained **boards** where:

- **The app is a document, not a platform lock-in:** An entire application—its user interface (Facade), its workflow, and its rules—is a single, human-readable JSON file (`board.json`) under the **GNU AGPLv3** license.
- **Data stays in durable, open standards:** Persistent apps store their data in standard **SQLite** files (exportable in one click) and communicate over open, battle-tested protocols (**IMAP/SMTP email, RSS, HTTP, WebRTC**)—technologies that existed 20 years ago and will still work 20 years from now.

---

## 3. Four Pillars for Sovereignty & Resilience

### Pillar 1: Understanding Without Being a Coder (Observability as Empowerment)

- **Why it matters:** Citizens and communities are only truly sovereign over a tool if they can understand what it actually does.
- **How Readymade solves it:** Readymade has no hidden control flow and no "spaghetti wires." Services run in a clear, top-to-bottom list. Anyone can turn on **Capture Mode** or open the **Overview** and watch data flow through the app in real time—seeing what entered each step, what left it, and why a rule stopped an action. You don't have to read source code to understand the behavior; you can *experience, inspect, and verify* it live, then adapt and extend it.

### Pillar 2: Safe AI Collaboration (Expert-Reviewed Blocks, Minimal Review Surface)

- **Why it matters:** AI can help non-coders build their own solutions, but unreviewed AI-generated code is a security and maintenance hazard.
- **How Readymade solves it:** In Readymade, AI does not invent the infrastructure. It composes **human-reviewed building blocks** (authentication, database engines, email clients, encryption, UI widgets) that already ship with tests and strict security boundaries.
- **The Review Advantage:** Before a user applies an AI proposal, Readymade explicitly separates *what is built from trusted blocks* from *the few lines written specifically for this board*. And with local model support (`llama.cpp`, `Ollama`, `Whisper`, `Kokoro`), even the AI itself can run on the user's own hardware.

### Pillar 3: Privacy & Data Minimization by Architecture, Not by Policy

- **Why it matters:** Most software asks users to trust a vendor's privacy policy.
- **How Readymade solves it:** In Readymade, privacy is a **structural property of where you place a block**:
  - A health log or voice transcription placed in the **Browser** or **Embedded App Runtime** never leaves the person's phone or laptop—by construction, no bytes cross the network.
  - Intermediate data between steps stays inside its runtime and is never saved or transmitted unless the owner actively turns on live debugging.
  - Passwords and API keys live outside the board (`{{secret.…}}`), bound to their destination, so sharing an app with another club or friend never leaks credentials.

### Pillar 4: True Resilience (From One Person's Phone to a Club's Shared Server)

- **Why it matters:** Communities need tools that survive offline use, server restarts, and changing infrastructure without vendor lock-in.
- **How Readymade solves it:**
  - **Local-first to shared in one step:** The exact same board runs offline in a browser/app for one person, or deployed on a small server (a €4 VPS or a Raspberry Pi behind a home router) shared with club members on their phones.
  - **Self-healing distributed design:** Runtime servers dial *out* to their coordinator using narrow, revocable tickets. They work behind home routers/NAT, automatically reconnect after power cuts, and enforce verified member identities down to the database level.

---

## 4. Core Pitch Messaging (EN)

- **Headline:** *Don't rent a platform for a problem your community can solve itself.*
- **Subline:** *Readymade lets citizens, clubs, and small teams build and share their own everyday apps from human-reviewed building blocks—observable in real time, assisted by AI, and running on hardware they control.*

---
---

<a id="deutsche-version"></a>

# Deutsche Version: Digitale Souveränität und Resilienz für Bürgerinnen, Bürger und Gemeinschaften

## 1. Das Kernproblem: Digitale Abhängigkeit im Alltag

Wenn ein Sportverein eine Platzbuchung braucht, eine Nachbarschaftsinitiative Werkzeuge teilen möchte, eine Familie Gesundheitsdaten dokumentiert oder ein kleiner Handwerksbetrieb Kundenanfragen strukturiert, stehen sie heute vor einer falschen Wahl:

1. **Mieten bei Big Tech / SaaS:** Eine zentralisierte, proprietäre Plattform nutzen, die Daten einschließt, Regeln vorgibt, monatliche Gebühren pro Nutzer verlangt oder Aufmerksamkeit und Privatsphäre monetarisiert.
2. **Warten oder Einkaufen:** Darauf warten, dass ein Anbieter genau das benötigte Feature baut – oder teure Individualsoftware beauftragen, die man weder selbst verstehen noch langfristig warten kann.

Selbst heutige „KI-App-Builder“ verschärfen diese Abhängigkeit meist nur: Sie generieren tausende Zeilen undurchsichtigen Programmcode, den Nicht-Programmierer weder auf Sicherheit prüfen noch im Fehlerfall reparieren können.

---

## 2. Der Readymade-Ansatz: Kombinierbare, beobachtbare und eigene Werkzeuge

Readymade begreift Software nicht als verschlossenes Mietprodukt, sondern als **kombinierbares Handwerk aus geprüften, genormten Basiskomponenten („Services“)**.

Statt unübersichtliche Codebasen zu schreiben, setzen Menschen (und KI-Assistenten) kleine, in sich geschlossene **Boards** zusammen:

- **Die App ist ein Dokument, kein Plattform-Lock-in:** Eine komplette Anwendung – inklusive Bedienoberfläche (Facade), Datenfluss und Regeln – ist eine einzige, menschenlesbare JSON-Datei (`board.json`) unter der freien **GNU AGPLv3**-Lizenz.
- **Daten bleiben in langlebigen, offenen Standards:** Persistente Anwendungen speichern ihre Daten in regulären **SQLite**-Dateien (mit einem Klick exportierbar) und kommunizieren über bewährte, dezentrale Standardprotokolle (**IMAP/SMTP-E-Mail, RSS, HTTP, WebRTC**) – Technologien, die vor 20 Jahren funktioniert haben und auch in 20 Jahren noch ohne Readymade lesbar sein werden.

---

## 3. Vier Säulen für Souveränität und Resilienz

### Säule 1: Begreifen ohne Programmierkenntnisse (Observability als Befähigung)

- **Warum das entscheidend ist:** Menschen und Gemeinschaften sind nur dann wirklich souverän über ein Werkzeug, wenn sie nachvollziehen können, was es tut.
- **Wie Readymade das löst:** Readymade verzichtet auf versteckte Abläufe und unübersichtliche „Spaghetti-Verkabelung“. Services laufen in einer klaren, geordneten Liste von oben nach unten. Über den **Overview** und den **Capture Mode** kann jeder in Echtzeit beobachten, wie sich die Lösung verhält: Welche Daten in einen Baustein hineinfließen, was herauskommt und warum eine Regel greift. Auch wer die Lösung anfangs nicht zu 100 % theoretisch durchdringt, kann sie durch Beobachten *erfahren, begreifen und anschließend selbst erweitern*.

### Säule 2: Sichere KI-Unterstützung (Geprüfte Basiskomponenten, minimale Prüffläche)

- **Warum das entscheidend ist:** KI hilft Nicht-Codern enorm beim Erstellen eigener Lösungen – aber ungeprüfter, KI-generierter Code ist ein Sicherheits- und Wartungsrisiko.
- **Wie Readymade das löst:** In Readymade erfindet die KI keine Basisinfrastruktur neu. Sie kombiniert **von menschlichen Experten geprüfte Basiskomponenten** (Authentifizierung, Datenbank-Engine, E-Mail, Verschlüsselung, UI-Elemente), die bereits mit Tests und harten Sicherheitsgrenzen ausgeliefert werden.
- **Der Review-Vorteil:** Vor dem Anwenden eines KI-Vorschlags zeigt Readymade transparent, *welche bewährten Bausteine wiederverwendet werden* und *welche wenigen Zeilen (z. B. konkrete Vereinsregeln) neu geschrieben wurden*. Dank Unterstützung für lokale Modelle (`llama.cpp`, `Ollama`, `Whisper`, `Kokoro`) kann selbst die KI komplett auf eigener Hardware laufen.

### Säule 3: Datensparsamkeit durch Architektur statt durch Datenschutzerklärungen

- **Warum das entscheidend ist:** Proprietäre Software verlangt Vertrauen in das Versprechen eines Betreibers.
- **Wie Readymade das löst:** Datenschutz ist in Readymade eine **strukturelle Eigenschaft des Ausführungsortes (Runtime)**:
  - Ein Gesundheitstagebuch oder eine Sprachtranskription in der **Browser-** oder **eingebetteten App-Runtime** verlässt das eigene Smartphone oder den Laptop physisch nicht – es werden konstruktionsbedingt keine Daten über das Netz geschickt.
  - Zwischenergebnisse innerhalb einer Pipeline verlassen die Runtime im Normalbetrieb niemals und werden nicht gespeichert.
  - Zugangsdaten und API-Schlüssel bleiben außerhalb des Boards (`{{secret.…}}`) und sind fest an ihre Zieldomain gebunden. Ein Board kann bedenkenlos mit anderen Vereinen oder Freunden geteilt werden, ohne Geheimnisse preiszugeben.

### Säule 4: Echte Resilienz (Vom einzelnen Smartphone bis zum eigenen Vereinsserver)

- **Warum das entscheidend ist:** Gemeinschaften brauchen Werkzeuge, die ohne Internetverbindung, nach Stromausfällen und über Serverwechsel hinweg zuverlässig funktionieren.
- **Wie Readymade das löst:**
  - **Nahtlos von lokal zu geteilt:** Dasselbe Board läuft lokal im Browser für eine einzelne Person oder bereitgestellt auf einem kleinen Server (einem günstigen VPS oder einem Raspberry Pi im Vereinsheim) gemeinsam für alle Mitglieder am Smartphone.
  - **Selbstheilende, dezentrale Architektur:** Runtime-Server verbinden sich *ausgehend* über schmale, widerrufbare Tickets mit dem Coordinator. Sie funktionieren hinter normalen Heim-Routern/NAT, verbinden sich nach einem Neustart selbstständig wieder und setzen verifizierte Mitglieder-Identitäten bis in die Datenbankebene durch.

---

## 4. Kernbotschaft für das Pitch-Deck (DE)

- **Headline:** *Miete keine Plattform für ein Problem, das deine Gemeinschaft selbst lösen kann.*
- **Subline:** *Mit Readymade bauen Familien, Vereine und kleine Teams ihre eigenen Alltagswerkzeuge aus geprüften Basiskomponenten – in Echtzeit beobachtbar, durch KI unterstützt und auf Infrastruktur unter eigener Kontrolle.*
