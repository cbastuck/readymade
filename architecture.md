# Readymade — Multi-Target & Runtime Architecture Pitch Brief (EN / DE)

- [English Version](#english-version)
- [Deutsche Version](#deutsche-version)

---

<a id="english-version"></a>

# English Version: One Engine, Six Targets, Zero Electron Bloat

## 1. The Cross-Platform Dilemma

Building an interactive, performance-critical application (with live audio DSP, local AI inference, canvas rendering, and complex visual editors) across **Web, macOS, Windows, Linux, iOS, and Android** normally forces teams into one of two painful compromises:

1. **The Native Duplication Trap:** Build a shared C++/Rust core and write separate native UIs in Swift, Kotlin, and a desktop toolkit. Every new service panel, visual debugger, or editor feature must be implemented, styled, and maintained three or four times.
2. **The Electron / Heavy Framework Trap:** Ship an entire Chromium browser and Node.js runtime inside every desktop executable—ballooning binary sizes past 150–300 MB, burning hundreds of megabytes of idle RAM, and still leaving mobile and pure web targets as second-class citizens.

---

## 2. The Readymade Approach: Inverted Host Architecture

Readymade turns this model inside out: **Readymade is a single web application (`hkp-frontend`) that runs unaltered inside thin, native platform shells (`meander`, `meander-ios`, `meander-android`) alongside an embedded C++ runtime (`hkp-rt`).**

```text
                  ┌────────────────────────────────────────┐
                  │   Board Engine + UI (React, 1 Codebase)│
                  │   hkp-frontend  ·  meander/frontend    │
                  └───────────────────┬────────────────────┘
                                      │  PlatformCapabilities + fetch("hkp://…")
      ┌───────────────┬───────────────┴───────────────┬───────────────┐
      │               │                               │               │
 Browser Tab    saucer Webview                  WKWebView      Android WebView
   (Web)        + C++ Backend (hkp-rt)          + Swift/C++    + Kotlin/JNI/C++
                macOS · Windows · Linux             iOS            Android
```

Even the public website (`hkp-website`) embeds the exact same `hkp-frontend/src` source tree via module aliasing—meaning the web playground and the native apps can never drift apart.

---

## 3. Six Architectural Advantages

### 1. Instant UI Iteration Without Recompiling Native Code
For C++ and native engineers, the most striking workflow benefit is the **complete decoupling of UI iteration from native compilation**:
- Building the C++ runtime (`hkp-rt`, Boost, OpenSSL, audio/ML libraries) happens once.
- By toggling a single flag (`MEANDER_USE_EMBEDDED_FRONTEND=OFF` on desktop, or `DEV_WEBAPP_URL` on the iOS simulator), the compiled native binary loads its UI live from the Vite dev server (`localhost:8555`) with sub-second Hot Module Replacement (HMR).
- You can redesign a service panel, change board linking logic, or tweak the visual overview while talking to the real, in-process C++ runtime and native OS bridges—**without running CMake, Xcode, or a C++ linker a single time**.
- When ready to ship, setting `MEANDER_USE_EMBEDDED_FRONTEND=ON` bakes the static assets directly into the binary for a self-contained release.

### 2. Tiny Executables via System Webviews (No Electron)
Instead of bundling Chromium and Node.js, Readymade's desktop shell (`meander`) uses **[saucer](https://github.com/saucer/saucer)**—a modern C++23 library that wraps the operating system's native webview:
- **macOS:** `WKWebView`
- **Windows:** `WebView2`
- **Linux:** `WebKitGTK 6.0`
- **iOS & Android:** Native `WKWebView` and `android.webkit.WebView`

One thin C++ codebase covers all three desktop operating systems. The resulting executable contains only the compiled C++ runtime and the compressed frontend assets—starting instantly and using a fraction of Electron's memory and disk footprint.

### 3. A Protocol Seam (`hkp://`) Instead of Fragile FFI Glue
Most hybrid frameworks require dozens of platform-specific FFI bindings for every feature. Readymade routes almost all host interaction through a **custom URL scheme (`fetch("hkp://…")`)**:
- Saving boards (`hkp://boards/`), managing secrets (`hkp://secrets/`), pinning to the Home Screen (`hkp://home-screen/`), and discovering LAN runtimes all look like ordinary HTTP `fetch()` calls to the React app.
- Each host answers `hkp://` in its native tongue: a C++ `SchemeHandler` on desktop, `WKURLSchemeHandler` in Swift on iOS, and a lightweight `fetch` interceptor backed by Kotlin on Android.
- **Graceful capability degradation:** `PlatformCapabilities` makes every native feature optional. In a plain browser tab, `hkp://` is never called and the app runs cleanly out of `localStorage`; inside a native shell, disk storage, OS keychains, and share extensions light up automatically.

### 4. Location-Transparent C++ Performance (`hkp-rt` In-Process or Remote)
Native targets don't just wrap a UI—they embed **`hkp-rt`**, Readymade's high-performance C++ runtime (real-time audio ring buffers, FFT, WAV I/O, local Whisper ASR, llama.cpp, and sherpa-onnx TTS):
- To a board, the embedded C++ runtime is addressed as `"remote": "embedded"` (`hkp://remotes/embedded`), speaking the exact same REST + WebSocket + YAS binary protocol as a remote server across the internet.
- On the desktop, requests to `hkp://remotes/embedded` are handed **straight to the in-process C++ server in memory without even opening a TCP socket**.
- The exact same C++ runtime also compiles into a standalone Linux/Docker server binary (`hkp-rt/exe`).

### 5. Write a Service Once, Run Everywhere
Because the board engine, service registry, and UI panels live in `hkp-frontend`, adding a browser service or a UI panel for a backend service immediately makes it available on **six targets** (Web, macOS, Windows, Linux, iOS, Android). And because core state logic (`core/presets`, `core/blockActions`, `assist/*`) is shared between the desktop layout and the touch-first mobile layout (`MobileApp`), product features land across desktop and mobile without duplicating business logic.

### 6. Fast, Deterministic E2E Testing Without Emulators
Because the boundary between the app and the native OS is a clean protocol (`hkp://` + `saucer.exposed`), Playwright can test the **Web, Desktop, and Mobile** shells in a single suite (`e2e/`):
- A lightweight page-init script (`fakeNativeHost.ts`) mocks the `hkp://` routes and native capabilities in browser memory.
- Over 95% of desktop and mobile user journeys (including iPhone touch gestures in WebKit) are verified in seconds in CI without booting heavy Android emulators or macOS/Windows VMs.

---

## 4. Core Pitch Messaging (EN)

- **Headline:** *Web-speed iteration. Native C++ power. Six platforms from one core.*
- **Subline:** *Readymade combines a single React board engine with system webviews and an in-process C++ runtime—delivering tiny native apps on macOS, Windows, Linux, iOS, and Android without Electron bloat or duplicated UI code.*

---
---

<a id="deutsche-version"></a>

# Deutsche Version: Eine Engine, sechs Plattformen, null Electron-Ballast

## 1. Das Cross-Platform-Dilemma

Wer eine interaktive, performante Anwendung (mit Echtzeit-Audio-DSP, lokaler KI-Inferenz, Canvas-Grafik und komplexem visuellem Editor) gleichzeitig für **Web, macOS, Windows, Linux, iOS und Android** entwickelt, steht normalerweise vor zwei unattraktiven Kompromissen:

1. **Die Native-Duplizierungs-Falle:** Man baut zwar einen gemeinsamen C++/Rust-Kern, muss aber jede Bedienoberfläche, jedes Service-Panel und jeden visuellen Debugger dreifach (Swift, Kotlin, Desktop-UI) programmieren und pflegen.
2. **Die Electron-Falle:** Man verpackt für jede Desktop-App einen kompletten Chromium-Browser samt Node.js-Laufzeitumgebung – mit Installationsgrößen von 150–300 MB, hohem RAM-Verbrauch im Leerlauf und ohne saubere Lösung für iOS, Android oder den reinen Browserbetrieb.

---

## 2. Der Readymade-Ansatz: Invertierte Host-Architektur

Readymade dreht dieses Modell um: **Readymade ist eine einzige Web-Applikation (`hkp-frontend`), die unverändert in schlanken, nativen Plattform-Hüllen (`meander`, `meander-ios`, `meander-android`) läuft – direkt gekoppelt mit einer eingebetteten C++-Runtime (`hkp-rt`).**

```text
                  ┌────────────────────────────────────────┐
                  │   Board Engine + UI (React, 1 Codebase)│
                  │   hkp-frontend  ·  meander/frontend    │
                  └───────────────────┬────────────────────┘
                                      │  PlatformCapabilities + fetch("hkp://…")
      ┌───────────────┬───────────────┴───────────────┬───────────────┐
      │               │                               │               │
 Browser-Tab    saucer Webview                  WKWebView      Android WebView
   (Web)        + C++ Backend (hkp-rt)          + Swift/C++    + Kotlin/JNI/C++
                macOS · Windows · Linux             iOS            Android
```

Selbst die öffentliche Webseite (`hkp-website`) bindet exakt denselben `hkp-frontend/src`-Quellcode per Alias ein – Web-Playground und native Apps können so niemals auseinanderdriften.

---

## 3. Sechs architektonische Vorteile

### 1. Sofortige UI-Iteration ohne Neukompilieren der nativen Apps
Für Entwicklerinnen und Entwickler aus der nativen oder C++-Welt ist der größte Produktivitätsgewinn die **vollständige Entkopplung von UI-Entwicklung und C++-Kompilierung**:
- Die C++-Runtime (`hkp-rt`, Boost, OpenSSL, Audio-/ML-Bibliotheken) und die native Shell werden ein einziges Mal kompiliert.
- Über einen einfachen Schalter (`MEANDER_USE_EMBEDDED_FRONTEND=OFF` am Desktop bzw. `DEV_WEBAPP_URL` im iOS-Simulator) lädt die fertig kompilierte, native App ihre Oberfläche live vom lokalen Vite-Dev-Server (`localhost:8555`) inklusive Hot Module Replacement (HMR) im Millisekundenbereich.
- Man kann Änderungen am Core-Frontend machen und sie sofort **in der echten nativen App inklusive C++-Runtime und Betriebssystem-Brücken** testen – ohne CMake, Xcode oder den C++-Compiler neu anwerfen zu müssen.
- Für das Release wird das Frontend per Schalter (`ON`) wieder direkt in die ausführbare Datei eingebettet.

### 2. Winzige Binärdateien dank System-Webviews (Kein Electron)
Statt Chromium mitzuliefern, nutzt die Desktop-App (`meander`) **[saucer](https://github.com/saucer/saucer)** – eine moderne C++23-Bibliothek, die das bereits im Betriebssystem vorhandene Webview-Steuerelement einbindet:
- **macOS:** `WKWebView`
- **Windows:** `WebView2`
- **Linux:** `WebKitGTK 6.0`
- **iOS & Android:** Natives `WKWebView` bzw. `android.webkit.WebView`

Ein einziges schlankes C++-Backend deckt damit macOS, Windows und Linux gleichzeitig ab. Die ausführbare Datei enthält nur den kompilierten C++-Code und das komprimierte Frontend-Bundle – sie startet verzögerungsfrei und benötigt nur einen Bruchteil des Speichers einer Electron-App.

### 3. Ein Protokoll (`hkp://`) statt fragilem FFI-Klebecode
Statt für jede Funktion plattformspezifische Funktionsbindungen zu pflegen, kommuniziert das Frontend mit seinem Host über ein **eigenes URL-Schema (`fetch("hkp://…")`)**:
- Boards speichern (`hkp://boards/`), Tresor-Geheimnisse verwalten (`hkp://secrets/`), Home-Screen-Pins anlegen (`hkp://home-screen/`) oder lokale Runtimes im Netzwerk finden – für die React-App sieht alles aus wie ein normaler `fetch()`-Aufruf.
- Jede Plattform beantwortet `hkp://` nativ: in C++ auf dem Desktop, per `WKURLSchemeHandler` (Swift) unter iOS und über eine leichtgewichtige Kotlin-Bridge unter Android.
- **Saubere Abstufung (`PlatformCapabilities`):** Jede native Fähigkeit ist optional. Im normalen Browser-Tab läuft dieselbe App ohne Fehlermeldungen mit `localStorage`; in der nativen App stehen Dateisystem, System-Keychain, iCloud-Sync und Share-Extensions nahtlos bereit.

### 4. Ortstransparente C++-Performance (`hkp-rt` In-Process oder Remote)
Die nativen Apps sind keine bloßen Browser-Hüllen: Sie betten **`hkp-rt`** direkt in denselben Prozess ein – die C++-Runtime für Echtzeit-Audio (FloatRingBuffer, FFT, WAV), lokale Spracherkennung (Whisper), Sprachsynthese (sherpa-onnx) und lokale LLMs (llama.cpp):
- Ein Board adressiert diese eingebettete Runtime über `"remote": "embedded"` (`hkp://remotes/embedded`) mit exakt demselben Protokoll wie einen entfernten Cloud-Server.
- Auf dem Desktop übergibt die Shell Anfragen an `hkp://remotes/embedded` **direkt im Arbeitsspeicher an die C++-Runtime, ohne überhaupt einen Netzwerk-Socket zu öffnen**.
- Gleichzeitig lässt sich exakt derselbe C++-Code auch als eigenständiger Headless-Server oder Docker-Container (`hkp-rt/exe`) kompilieren.

### 5. Einmal entwickeln, auf sechs Systemen ausliefern
Da Board-Engine, Service-Registry und UI-Panels in `hkp-frontend` liegen, steht jeder neue Baustein und jede Verbesserung sofort auf **allen sechs Plattformen** (Web, macOS, Windows, Linux, iOS, Android) zur Verfügung. Selbst zwischen der Desktop-Oberfläche und der Touch-optimierten Smartphone-Oberfläche (`MobileApp`) wird die gesamte Kernlogik (`core/presets`, `core/blockActions`, `assist/*`) zu 100 % geteilt.

### 6. Schnelle, deterministische Ende-zu-Ende-Tests ohne Emulator-Zwang
Weil die Grenze zwischen App und Betriebssystem ein klares Protokoll (`hkp://` + `saucer.exposed`) ist, kann eine einzige Playwright-Testsuite (`e2e/`) **Web, Desktop und Mobile** gemeinsam prüfen:
- Ein schlankes Initialisierungsskript (`fakeNativeHost.ts`) simuliert die `hkp://`-Routen im Browser-Speicher.
- Über 95 % aller Abläufe (inklusive echter Touch-Gesten in WebKit für iOS) lassen sich so in wenigen Sekunden automatisiert testen, ohne langsame Android-Emulatoren oder virtuelle Maschinen für jede Code-Änderung starten zu müssen.

---

## 4. Kernbotschaft für das Pitch-Deck (DE)

- **Headline:** *Iterationsgeschwindigkeit wie im Web. Native C++-Leistung. Sechs Plattformen aus einem Kern.*
- **Subline:** *Readymade verbindet eine zentrale React-Board-Engine mit nativen System-Webviews und einer eingebetteten C++-Runtime – für kompakte, schnelle Apps auf macOS, Windows, Linux, iOS, Android und im Web, ganz ohne Electron-Ballast oder doppelte UI-Entwicklung.*
