# Readymade

- [English Version](#english-version)
- [Deutsche Version](#deutsche-version)

---

<a id="english-version"></a>

# Readymade: towards digital self-determination

*Digital sovereignty and resilience for people, families and clubs*

## 1. The Core Problem: Digital Dependency in Everyday Life

When a sports club needs a court-booking system, a neighborhood group wants to coordinate shared tools, a family wants to track health data, or a small craft business wants to organize customer requests, they face a limited choice:

1. **Rent SaaS offering:** Adopt a centralized platform that locks in their data, dictates the rules, charges per-seat subscriptions, or monetizes their attention and privacy. Often these solution are rigid and rarely fit how the group works.
2. **Wait or Hire:** Wait for a commercial vendor to build the exact feature they need, or pay for custom software development that they can neither understand nor maintain themselves.

Even today's "AI app builders" mostly deepen this trap: they generate thousands of lines of opaque code that non-coders cannot audit, secure, or repair when something breaks.

---

## 2. The Readymade Thesis: Composable, Observable, Ownable Tools

Readymade builds software from **small, standard building blocks ("services") that anyone can open and inspect**, and lets people combine them into something bigger, like crafting.

Instead of writing sprawling codebases, people (and AI assistants) assemble small, self-contained **boards** where:

- **The app is a document, and it is yours:** An entire application—its user interface (Facade), its workflow, and its rules—is a single, inspectable JSON file (`board.json`). The board belongs to whoever built it; the platform that runs it is free software under the **GNU AGPLv3**.
- **Data stays in durable, open standards:** Persistent apps store their data in standard **SQLite** files (exportable in one click) and communicate over open, battle-tested protocols (**IMAP/SMTP email, RSS, HTTP, WebRTC**)—technologies that existed 20 years ago and will still work 20 years from now.

---

## 3. What Self-Determination Takes: Understand It, Own It, Run It Where You Choose

Self-determination over a tool comes down to three kinds of control: understanding it, owning it, and running it where you choose. This is digital sovereignty at the scale of a person, a family, or a club.

### 1. Understand it (without being a coder)

- **Why it matters:** People and communities only decide for themselves about a tool if they can see what it actually does.
- **How Readymade does it:** Readymade has no hidden control flow and no "spaghetti wires." Services run in a clear, observable order. Anyone can turn on **Capture Mode** or open the **Overview** and watch data flow through the app in real time. Observing what entered each step, what a service consumed and produced, and why a rule stopped an action. You don't have to read source code to understand the behavior; you can *experience, inspect, and verify* it live, then adapt and extend it. If you want the details, you can dive deeper and dive deeper under the hood of the user interface tweak the behavior to your individual needs.

### 2. Own it (and keep it, whatever happens to Readymade)

- **Why it matters:** A tool is only yours if you can keep using it, change it, and take it elsewhere without asking anyone.
- **How Readymade does it:**
  - **Your board, your data:** The board is a file you hold and can copy, share, or edit. Its data sits in standard SQLite files that any database tool opens, with or without Readymade.
  - **No dependency on us:** Everything that runs a board—the app, the runtimes, the server that keeps a shared board running—is free software under the AGPLv3. You can host all of it yourself, and if the project ever stopped, the code stays available for anyone to run, fix, and carry on.

### 3. Run it where you choose

- **Why it matters:** Whoever operates the machine a tool runs on has the last word over it.
- **How Readymade does it:**
  - **From one phone to a club's server:** The exact same board runs in local setup for one person, or deployed into the cloud or a self-hosted server (a €4 VPS or a Raspberry Pi behind a home router) to share it other club members on their phones. Move the building block within seconds into a hosted infrastructure.
  - **Your choice of AI:** The assistant and the AI blocks work with models on your own hardware (`llama.cpp`, `Ollama`, `Whisper`, `Kokoro`) or with a European provider (Mistral). Which model sees your data is a setting you make.

---

## 4. What Follows From That Control

### Privacy by architecture

Most software asks users to trust a vendor's privacy policy. When you decide where each block runs, privacy becomes a **structural property of where you place it**:

- A health log or voice transcription placed in the **Browser** or **Embedded App Runtime** never leaves the person's phone or laptop—by construction, no bytes cross the network.
- Intermediate data between steps stays inside its runtime and is never saved or transmitted unless the owner actively turns on live debugging.
- Passwords and API keys live outside the board (`{{secret.…}}`), bound to their destination, so sharing an app with another club or friend never leaks credentials.

### AI help you can check

AI can help non-coders build their own solutions, but unreviewed AI-generated code is a security and maintenance hazard. Because a board is assembled from blocks you can inspect, that risk shrinks to something a person can review:

- AI does not invent the infrastructure. It composes **human-reviewed building blocks** (authentication, database engines, email clients, encryption, UI widgets) that already ship with tests and strict security boundaries.
- Before a user applies an AI proposal, Readymade explicitly separates *what is built from trusted blocks* from *the few lines written specifically for this board*.

### Resilience

Tools on hardware you control keep working when someone else's infrastructure changes:

- A board on a phone or laptop works offline.
- Local runtime servers can connect to a board running in the cloud. Even if it's behind home routers/NAT. We automatically reconnect after power cuts, and enforce verified member identities down to the database level.

---

## 5. Core Pitch Messaging (EN)

- **Headline:** *Don't rent a platform for a problem your community can solve itself.*
- **Subline:** *Readymade lets citizens, clubs, and small teams build and share their own everyday apps from human-reviewed building blocks—observable in real time, assisted by AI, and running on hardware they control.*

---

## Addendum: How the Three Terms Relate

Digital sovereignty is what makes self-determination possible; resilience is what you get from it.

---
---

<a id="deutsche-version"></a>

# Readymade: ein Weg in die digitale Selbstbestimmung

*Digitale Souveränität und Resilienz für Menschen, Familien und Vereine*

## 1. Das Kernproblem: Digitale Abhängigkeit im Alltag

Wenn ein Sportverein eine Platzbuchung braucht, eine Nachbarschaftsinitiative Werkzeuge teilen möchte, eine Familie Gesundheitsdaten dokumentiert oder ein kleiner Handwerksbetrieb Kundenanfragen strukturiert, stehen sie heute vor einer falschen Wahl:

1. **Mieten bei Big Tech / SaaS:** Eine zentralisierte, proprietäre Plattform nutzen, die Daten einschließt, Regeln vorgibt, monatliche Gebühren pro Nutzer verlangt oder Aufmerksamkeit und Privatsphäre monetarisiert.
2. **Warten oder Einkaufen:** Darauf warten, dass ein Anbieter genau das benötigte Feature baut – oder teure Individualsoftware beauftragen, die man weder selbst verstehen noch langfristig warten kann.

Selbst heutige „KI-App-Builder“ verschärfen diese Abhängigkeit meist nur: Sie generieren tausende Zeilen undurchsichtigen Programmcode, den Nicht-Programmierer weder auf Sicherheit prüfen noch im Fehlerfall reparieren können.

---

## 2. Der Readymade-Ansatz: Kombinierbare, beobachtbare und eigene Werkzeuge

Readymade begreift Software nicht als verschlossenes Mietprodukt, sondern als **kombinierbares Handwerk aus geprüften, genormten Basiskomponenten („Services“)**.

Statt unübersichtliche Codebasen zu schreiben, setzen Menschen (und KI-Assistenten) kleine, in sich geschlossene **Boards** zusammen:

- **Die App ist ein Dokument, und es gehört dir:** Eine komplette Anwendung – inklusive Bedienoberfläche (Facade), Datenfluss und Regeln – ist eine einzige, menschenlesbare JSON-Datei (`board.json`). Das Board gehört dem, der es gebaut hat; die Plattform, auf der es läuft, ist freie Software unter der **GNU AGPLv3**.
- **Daten bleiben in langlebigen, offenen Standards:** Persistente Anwendungen speichern ihre Daten in regulären **SQLite**-Dateien (mit einem Klick exportierbar) und kommunizieren über bewährte, dezentrale Standardprotokolle (**IMAP/SMTP-E-Mail, RSS, HTTP, WebRTC**) – Technologien, die vor 20 Jahren funktioniert haben und auch in 20 Jahren noch ohne Readymade lesbar sein werden.

---

## 3. Was Selbstbestimmung braucht: verstehen, besitzen, selbst betreiben

Selbstbestimmung über ein Werkzeug heißt, drei Dinge in der Hand zu haben: es zu verstehen, es zu besitzen und es selbst zu betreiben. Das ist digitale Souveränität im Maßstab einer Person, einer Familie oder eines Vereins.

### 1. Verstehen (ohne Programmierkenntnisse)

- **Warum das entscheidend ist:** Menschen und Gemeinschaften entscheiden nur dann selbst über ein Werkzeug, wenn sie nachvollziehen können, was es tut.
- **Wie Readymade das macht:** Readymade verzichtet auf versteckte Abläufe und unübersichtliche „Spaghetti-Verkabelung“. Services laufen in einer klaren, geordneten Liste von oben nach unten. Über den **Overview** und den **Capture Mode** kann jeder in Echtzeit beobachten, wie sich die Lösung verhält: Welche Daten in einen Baustein hineinfließen, was herauskommt und warum eine Regel greift. Auch wer die Lösung anfangs nicht zu 100 % theoretisch durchdringt, kann sie durch Beobachten *erfahren, begreifen und anschließend selbst erweitern*.

### 2. Besitzen (und behalten, was auch immer aus Readymade wird)

- **Warum das entscheidend ist:** Ein Werkzeug gehört einem erst, wenn man es weiter nutzen, verändern und mitnehmen kann, ohne jemanden zu fragen.
- **Wie Readymade das macht:**
  - **Dein Board, deine Daten:** Das Board ist eine Datei in der eigenen Hand, die sich kopieren, weitergeben und bearbeiten lässt. Die Daten liegen in regulären SQLite-Dateien, die jedes Datenbankwerkzeug öffnet – mit oder ohne Readymade.
  - **Keine Abhängigkeit von uns:** Alles, was ein Board ausführt – die App, die Runtimes, der Server, der ein geteiltes Board am Laufen hält – ist freie Software unter der AGPLv3. Alles lässt sich selbst betreiben, und sollte das Projekt je enden, bleibt der Code verfügbar: zum Weiterbetreiben, Reparieren und Weiterentwickeln.

### 3. Selbst betreiben, wo man will

- **Warum das entscheidend ist:** Wer die Maschine betreibt, auf der ein Werkzeug läuft, hat das letzte Wort darüber.
- **Wie Readymade das macht:**
  - **Vom einzelnen Smartphone bis zum Vereinsserver:** Dasselbe Board läuft lokal im Browser oder in der App für eine einzelne Person oder bereitgestellt auf einem kleinen Server (einem günstigen VPS oder einem Raspberry Pi im Vereinsheim) gemeinsam für alle Mitglieder am Smartphone.
  - **Die KI der eigenen Wahl:** Der Assistent und die KI-Bausteine arbeiten mit Modellen auf eigener Hardware (`llama.cpp`, `Ollama`, `Whisper`, `Kokoro`) oder mit einem europäischen Anbieter (Mistral). Welches Modell die eigenen Daten sieht, ist eine Einstellung, die man selbst trifft.

---

## 4. Was daraus folgt

### Datenschutz durch Architektur

Proprietäre Software verlangt Vertrauen in das Versprechen eines Betreibers. Wer selbst bestimmt, wo ein Baustein läuft, bekommt Datenschutz als **strukturelle Eigenschaft des Ausführungsortes (Runtime)**:

- Ein Gesundheitstagebuch oder eine Sprachtranskription in der **Browser-** oder **eingebetteten App-Runtime** verlässt das eigene Smartphone oder den Laptop physisch nicht – es werden konstruktionsbedingt keine Daten über das Netz geschickt.
- Zwischenergebnisse innerhalb einer Pipeline verlassen die Runtime im Normalbetrieb niemals und werden nicht gespeichert.
- Zugangsdaten und API-Schlüssel bleiben außerhalb des Boards (`{{secret.…}}`) und sind fest an ihre Zieldomain gebunden. Ein Board kann bedenkenlos mit anderen Vereinen oder Freunden geteilt werden, ohne Geheimnisse preiszugeben.

### KI-Unterstützung, die sich prüfen lässt

KI hilft Nicht-Codern enorm beim Erstellen eigener Lösungen – aber ungeprüfter, KI-generierter Code ist ein Sicherheits- und Wartungsrisiko. Weil ein Board aus einsehbaren Bausteinen besteht, schrumpft dieses Risiko auf etwas, das ein Mensch prüfen kann:

- Die KI erfindet keine Basisinfrastruktur neu. Sie kombiniert **von menschlichen Experten geprüfte Basiskomponenten** (Authentifizierung, Datenbank-Engine, E-Mail, Verschlüsselung, UI-Elemente), die bereits mit Tests und harten Sicherheitsgrenzen ausgeliefert werden.
- Vor dem Anwenden eines KI-Vorschlags zeigt Readymade transparent, *welche bewährten Bausteine wiederverwendet werden* und *welche wenigen Zeilen (z. B. konkrete Vereinsregeln) neu geschrieben wurden*.

### Resilienz

Werkzeuge auf eigener Hardware funktionieren weiter, wenn sich fremde Infrastruktur ändert:

- Ein Board auf dem Smartphone oder Laptop funktioniert ohne Internetverbindung.
- Runtime-Server verbinden sich *ausgehend* über schmale, widerrufbare Tickets mit dem Coordinator. Sie funktionieren hinter normalen Heim-Routern/NAT, verbinden sich nach einem Neustart selbstständig wieder und setzen verifizierte Mitglieder-Identitäten bis in die Datenbankebene durch.

---

## 5. Kernbotschaft für das Pitch-Deck (DE)

- **Headline:** *Miete keine Plattform für ein Problem, das deine Gemeinschaft selbst lösen kann.*
- **Subline:** *Mit Readymade bauen Familien, Vereine und kleine Teams ihre eigenen Alltagswerkzeuge aus geprüften Basiskomponenten – in Echtzeit beobachtbar, durch KI unterstützt und auf Infrastruktur unter eigener Kontrolle.*

---

## Nachtrag: Wie die drei Begriffe zusammenhängen

Digitale Souveränität macht Selbstbestimmung möglich; Resilienz ist, was daraus folgt.
