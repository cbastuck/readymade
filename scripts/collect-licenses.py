#!/usr/bin/env python3
"""Collect third-party license information for everything Readymade distributes.

Walks the four places a dependency can enter a build:

  vcpkg     3rdparty/vcpkg/installed/<triplet>/share/<pkg>/copyright
  cmake     <build-tree>/_deps/<name>-src  (CPM + FetchContent, incl. transitive)
  vendored  source copied into 3rdparty/ (crow, yas, mdns, inflect)
  npm       the production closure of each frontend and of the website

and writes two committed artifacts:

  licenses/index.json      the record: every component, and every licence text once,
                           deduplicated by content hash. This is what the licence pages
                           in the website and the apps read, so it is a build input.
  THIRD-PARTY-NOTICES.md   the same thing for a human, as tables.

--emit-tree additionally writes licenses/<scope>/<component>/ folders of licence files,
laid out by what needs each component rather than by where it came from:

  licenses/service/<serviceId>/   what enabling that one hkp-rt service obliges you to
                                  ship — self-contained, so a component two services
                                  need is written into both folders
  licenses/runtime-core/          the runtime itself: HTTP, serialization, discovery, auth
  licenses/app-shell/             the desktop application around the runtime
  licenses/frontend/              the web app embedded in every app bundle
  licenses/website/               readymadeit.com's bundle, served to browsers only
  licenses/build-only/            runs during the build, never linked into an artifact
  licenses/not-shipped/           present in a dependency store, linked by nothing

That tree is generated on demand and deliberately not committed. It is fully derivable
from index.json, so committing it would store the same bytes a second time with nothing
verifying that the two agree. It is also lossy where the index is not: folders are keyed
by package name, so a package present at two versions keeps only one of its texts.
Emit it for an audit or a release tarball; read the index for anything that must be exact.

The REGISTRY below carries the facts that cannot be read off disk: which build targets
ship a component, how it is linked, what pulled it in, and its scope. Two disagreements
fail the run, so neither a new dependency nor a dependency moving between services can
slip into a release unnoticed:

  * a component found on disk with no REGISTRY entry
  * a curated scope the hkp-rt sources contradict (see SCOPE_MARKERS)

Run with --allow-unknown to generate anyway.

    scripts/collect-licenses.py [--build-dir DIR ...] [--check] [--allow-unknown]

--check regenerates into a temporary directory and diffs against the committed output,
which is what CI should run.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Every build target a dependency can ship in. "desktop" expands to the three of them.
TARGETS = ["macos", "windows", "linux", "ios", "android"]
DESKTOP = ["macos", "windows", "linux"]
MOBILE = ["ios", "android"]
ALL = TARGETS

# Scope buckets for code that belongs to no single hkp-rt service. Everything else is
# scoped to one or more service ids, so a folder under licenses/service/<id>/ holds
# exactly what enabling that service drags in.
CORE = ["runtime-core"]        # the runtime itself: HTTP, serialization, discovery, auth
SHELL = ["app-shell"]          # the desktop application shell around the runtime
TOOLING = ["build-only"]       # runs during the build, never linked into an artifact
UNUSED = ["not-shipped"]       # present in a dependency store but linked by nothing
FRONTEND = ["frontend"]        # the web app embedded in every app bundle
WEBSITE = ["website"]          # readymadeit.com's own bundle, served to browsers only
BUCKETS = set(CORE + SHELL + TOOLING + UNUSED + FRONTEND + WEBSITE)

# The two speech services share one static library each, so a component reached through
# sherpa-onnx or the inflect backend is scoped to both.
SPEECH = ["speech-to-text", "text-to-speech"]


@dataclass
class Component:
    """Curated metadata for one third-party component."""

    spdx: str
    url: str
    targets: list[str]
    linkage: str
    # Where the component is needed: hkp-rt service ids, or one of the BUCKETS below
    # for code that belongs to no single service.
    scope: list[str] = field(default_factory=list)
    via: str = ""
    notes: str = ""
    # Extra license files to pick up beyond the top-level LICENSE/COPYING.
    extra_licenses: list[str] = field(default_factory=list)


def C(spdx, url, targets, linkage, scope=None, via="", notes="", extra_licenses=None):
    return Component(spdx, url, targets, linkage, scope or [], via, notes, extra_licenses or [])


# =============================================================================
# REGISTRY — the hand-maintained half. Keys are the on-disk discovery names.
# =============================================================================

REGISTRY: dict[str, Component] = {
    # ── vcpkg ────────────────────────────────────────────────────────────────
    "boost": C(
        "BSL-1.0", "https://www.boost.org/", ALL, "static",
        scope=CORE,
        via="3rdparty/vcpkg.json — asio, beast, json, url, thread, filesystem, …",
        notes="All boost-* vcpkg ports are collapsed into this entry; they share one licence.",
    ),
    "openssl": C(
        "Apache-2.0", "https://www.openssl.org/", ALL, "static",
        scope=CORE,
        via="3rdparty/vcpkg.json — TLS for the HTTP layer, RS256 for JWT verification",
    ),
    "zlib": C(
        "Zlib", "https://zlib.net/", ALL, "static",
        scope=CORE,
        via="transitive: boost-iostreams",
    ),
    "bzip2": C(
        "bzip2-1.0.6", "https://sourceware.org/bzip2/", ALL, "static",
        scope=CORE,
        via="transitive: boost-iostreams",
    ),
    "liblzma": C(
        "0BSD", "https://tukaani.org/xz/", ALL, "static",
        scope=CORE,
        via="transitive: boost-iostreams",
    ),
    "zstd": C(
        "BSD-3-Clause OR GPL-2.0-only", "https://facebook.github.io/zstd/", ALL, "static",
        scope=CORE,
        via="transitive: boost-iostreams",
        notes="Dual-licensed; taken under BSD-3-Clause.",
    ),
    "fdk-aac": C(
        "LicenseRef-Fraunhofer-FDK-AAC", "https://github.com/mstorsjo/fdk-aac", DESKTOP, "static",
        scope=["mp4-to-wav"],
        via="hkp-rt/lib/CMakeLists.txt — the mp4-to-wav service (HKP_MP4_TO_WAV_ENABLED)",
        notes=(
            "REVIEW: the Fraunhofer FDK AAC licence is not an OSI/FSF-free licence and the FSF "
            "considers it GPL-incompatible, so linking it into an AGPL-3.0 binary is a conflict "
            "that needs a decision. vcpkg ships the Fedora-approved fork with the patent-encumbered "
            "HE/HEv2 profiles stripped. iOS is excluded by an explicit `if(NOT IOS)` guard and "
            "Android by the absence of fdk-aac from the *-android vcpkg trees, so this affects "
            "desktop only."
        ),
    ),
    "ffmpeg": C(
        "LGPL-2.1-or-later", "https://ffmpeg.org/", [], "not linked",
        scope=UNUSED,
        via="present in the vcpkg store only",
        notes=(
            "NOT SHIPPED. The ffmpeg services are gated on AVCPP_FOUND (hkp-rt/lib/CMakeLists.txt:32) "
            "and 3rdparty/avcpp no longer exists, so nothing defines it and no FFmpeg code is linked. "
            "Listed so the store's presence is not mistaken for a shipped dependency. Re-check this "
            "entry if avcpp comes back."
        ),
    ),

    # ── CPM / FetchContent: every target ──────────────────────────────────────
    "nlohmann_json": C(
        "MIT", "https://github.com/nlohmann/json", ALL, "header-only",
        scope=CORE,
        via="3rdparty/CMakeLists.txt (or sherpa-onnx's copy when speech is enabled)",
    ),
    "json": C(  # sherpa-onnx's own nlohmann/json checkout, same project
        "MIT", "https://github.com/nlohmann/json", DESKTOP, "header-only",
        scope=SPEECH,
        via="transitive: sherpa-onnx",
        notes="sherpa-onnx's own nlohmann/json checkout; the same project as nlohmann_json.",
    ),
    "inja": C(
        "MIT", "https://github.com/pantor/inja", ALL, "header-only",
        scope=["cache", "cache-subservices", "http-client", "map"],
        via="3rdparty/CMakeLists.txt — template rendering in the http-server service",
    ),
    "minimp4": C(
        "CC0-1.0", "https://github.com/lieff/minimp4", ALL, "header-only",
        scope=["mp4-to-wav"],
        via="3rdparty/CMakeLists.txt — MP4 demuxing for the mp4-to-wav service",
    ),
    "jwt-cpp": C(
        "MIT", "https://github.com/Thalhammer/jwt-cpp", ALL, "header-only",
        scope=CORE,
        via="3rdparty/CMakeLists.txt — JWT verification in the runtime auth layer",
    ),

    # ── CPM: saucer (desktop GUI shell; BUILD_HKP_SAUCER is OFF on iOS/Android) ─
    "saucer": C(
        "MIT", "https://github.com/saucer/saucer", DESKTOP, "static",
        scope=SHELL,
        via="CMakeLists.txt — the webview shell the desktop app is built on",
    ),
    "saucer-loop": C("MIT", "https://github.com/saucer/loop", DESKTOP, "static", scope=SHELL, via="CMakeLists.txt"),
    "saucer-desktop": C("MIT", "https://github.com/saucer/desktop", DESKTOP, "static", scope=SHELL, via="CMakeLists.txt"),
    "saucer-embed": C("MIT", "https://github.com/saucer/embed", DESKTOP, "static", scope=SHELL, via="transitive: saucer"),
    "saucer-fill": C("MIT", "https://github.com/saucer/fill", DESKTOP, "static", scope=SHELL, via="transitive: saucer"),
    "coco": C("MIT", "https://github.com/Curve/coco", DESKTOP, "header-only", scope=SHELL, via="transitive: saucer"),
    "ereignis": C("MIT", "https://github.com/Curve/ereignis", DESKTOP, "header-only", scope=SHELL, via="transitive: saucer"),
    "flagpp": C("MIT", "https://github.com/Curve/flagpp", DESKTOP, "header-only", scope=SHELL, via="transitive: saucer"),
    "lockpp": C("MIT", "https://github.com/Curve/lockpp", DESKTOP, "header-only", scope=SHELL, via="transitive: saucer"),
    "polo": C("MIT", "https://github.com/Curve/polo", DESKTOP, "header-only", scope=SHELL, via="transitive: saucer"),
    "rebind": C("MIT", "https://github.com/Curve/rebind", DESKTOP, "header-only", scope=SHELL, via="transitive: saucer"),
    "glaze": C("MIT", "https://github.com/stephenberry/glaze", DESKTOP, "header-only", scope=SHELL, via="transitive: saucer"),
    "jthread": C(
        "CC-BY-4.0", "https://github.com/josuttis/jthread", DESKTOP, "header-only",
        scope=SHELL,
        via="transitive: saucer (std::jthread backfill)",
        notes="Creative Commons Attribution on source code; attribution in the notices satisfies it.",
    ),
    "functional": C(
        "BSD-2-Clause", "https://github.com/zhihaoy/nontype_functional", DESKTOP, "header-only",
        scope=SHELL,
        via="transitive: saucer (std::function_ref backfill)",
    ),
    "range-v3": C("BSL-1.0", "https://github.com/ericniebler/range-v3", DESKTOP, "header-only", scope=SHELL, via="transitive: saucer"),

    # ── CPM: llama.cpp (HKP_LLAMA_ENABLED — desktop default ON, mobile OFF) ────
    "llama_cpp": C(
        "MIT", "https://github.com/ggml-org/llama.cpp", DESKTOP, "static",
        scope=["text-generation"],
        via="3rdparty/CMakeLists.txt — text-generation local backend",
        notes="Bundles vendored third-party licences of its own under licenses/; copied here.",
        extra_licenses=["licenses"],
    ),

    # ── CPM: sherpa-onnx (HKP_SPEECH_ENABLED — desktop default ON, mobile OFF) ─
    "sherpa_onnx": C(
        "Apache-2.0", "https://github.com/k2-fsa/sherpa-onnx", DESKTOP, "static",
        scope=SPEECH,
        via="3rdparty/CMakeLists.txt — speech-to-text (Whisper) and text-to-speech (Kokoro) local backends",
    ),
    "onnxruntime": C(
        "MIT", "https://github.com/microsoft/onnxruntime", DESKTOP, "static or dynamic",
        scope=SPEECH,
        via="transitive: sherpa-onnx / inflect — a prebuilt binary release, never built from source",
        notes=(
            "Consumed as a prebuilt binary from one of two places: sherpa-onnx pulls a "
            "repackaged static build from csukuangfj/onnxruntime-libs, and the inflect backend "
            "pulls Microsoft's own release when sherpa is off (the Version column links whichever "
            "the scanned build used). Neither archive carries a LICENSE file, so the text stored "
            "under licenses/cmake/onnxruntime/ comes from the upstream repository."
        ),
    ),
    "espeak_ng": C(
        "GPL-3.0-or-later", "https://github.com/espeak-ng/espeak-ng", DESKTOP, "static",
        scope=SPEECH,
        via="transitive: sherpa-onnx (via piper-phonemize) and the inflect TTS backend",
        notes=(
            "The only copyleft dependency linked into a shipped binary. This project is AGPL-3.0, "
            "and GPLv3 code may be combined with AGPLv3 code (AGPLv3 §13), so the combination is "
            "sound — but it does mean the desktop build cannot be relicensed to anything "
            "non-(A)GPL while espeak-ng is linked. Not built for iOS/Android (speech and inflect "
            "are both OFF there). The bundled ucd-tools is under the Unicode licence (COPYING.UCD) "
            "and parts are Apache-2.0 (COPYING.APACHE); all four texts are copied."
        ),
        extra_licenses=["COPYING", "COPYING.APACHE", "COPYING.BSD2", "COPYING.UCD"],
    ),
    "piper_phonemize": C(
        "MIT", "https://github.com/csukuangfj/piper-phonemize", DESKTOP, "static",
        scope=SPEECH,
        via="transitive: sherpa-onnx",
        notes="Vendors uni-algo (see its licenses/ directory), copied here.",
        extra_licenses=["licenses"],
    ),
    "kaldi_decoder": C("Apache-2.0", "https://github.com/k2-fsa/kaldi-decoder", DESKTOP, "static", scope=SPEECH, via="transitive: sherpa-onnx"),
    "kaldi_native_fbank": C("Apache-2.0", "https://github.com/csukuangfj/kaldi-native-fbank", DESKTOP, "static", scope=SPEECH, via="transitive: sherpa-onnx"),
    "kaldifst": C("Apache-2.0", "https://github.com/k2-fsa/kaldifst", DESKTOP, "static", scope=SPEECH, via="transitive: sherpa-onnx"),
    "openfst": C("Apache-2.0", "https://www.openfst.org/", DESKTOP, "static", scope=SPEECH, via="transitive: sherpa-onnx (via kaldifst)"),
    "kissfft": C("BSD-3-Clause", "https://github.com/mborgerding/kissfft", DESKTOP, "static", scope=SPEECH, via="transitive: sherpa-onnx"),
    "simple-sentencepiece": C("Apache-2.0", "https://github.com/pkufool/simple-sentencepiece", DESKTOP, "static", scope=SPEECH, via="transitive: sherpa-onnx"),
    "eigen": C(
        "MPL-2.0", "https://eigen.tuxfamily.org/", DESKTOP, "header-only",
        scope=SPEECH,
        via="transitive: sherpa-onnx (via kaldi-decoder)",
        notes="MPL-2.0 is file-level copyleft and header-only here; no obligation beyond notice.",
        extra_licenses=["COPYING.APACHE", "COPYING.BSD", "COPYING.MPL2", "COPYING.MINPACK"],
    ),

    # ── CPM: build-time only ─────────────────────────────────────────────────
    "catch2": C(
        "BSL-1.0", "https://github.com/catchorg/Catch2", [], "build-only",
        scope=TOOLING,
        via="hkp-rt/tests — test framework, never linked into a shipped binary",
    ),
    "packageproject": C(
        "MIT", "https://github.com/TheLartians/PackageProject.cmake", [], "build-only",
        scope=TOOLING,
        via="transitive: saucer — CMake install/export helper",
    ),

    # ── Vendored into the tree ───────────────────────────────────────────────
    "crow": C(
        "BSD-3-Clause", "https://github.com/CrowCpp/Crow", ALL, "vendored source",
        scope=CORE,
        via="3rdparty/crow.h + 3rdparty/crow/ — the HTTP framework, v1.2.1",
        notes=(
            "Copied in without its LICENSE file; the upstream BSD-3-Clause text is stored under "
            "licenses/vendored/crow/. Two files inside carry their own terms: crow/TinySHA1.hpp "
            "(ISC-style, © Saurav Mohapatra) and crow/http_parser_merged.h (derived from Node.js "
            "http-parser, MIT). Both texts are stored alongside."
        ),
    ),
    "yas": C(
        "BSL-1.0", "https://github.com/niXman/yas", ALL, "vendored source",
        scope=CORE,
        via="3rdparty/yas/ — the YAS binary wire format used across runtimes",
        notes="Licence text is embedded in every header; the canonical BSL-1.0 text is stored here.",
    ),
    "mdns": C(
        "Unlicense", "https://github.com/mjansson/mdns", ALL, "vendored source",
        scope=CORE,
        via="3rdparty/mdns.h — mDNS/DNS-SD for LAN discovery",
        notes="Released into the public domain by its author; the header states the dedication.",
    ),
    "inflect": C(
        "LicenseRef-UNRESOLVED", "https://huggingface.co/owensong/Inflect-Micro-v2-ONNX", DESKTOP, "vendored source",
        scope=["text-to-speech"],
        via="3rdparty/inflect/ — the inflect text-to-speech backend (HKP_INFLECT_ENABLED)",
        notes=(
            "ACTION REQUIRED: this is a first-party C++17 port of the Inflect v2 pipeline and "
            "currently carries no LICENSE file of its own. Two things need settling before a "
            "release: (1) add the project's own licence header/file to 3rdparty/inflect, and "
            "(2) record the upstream Inflect v2 licence, which governs the port as a derivative "
            "of its algorithm and, separately, the ONNX model weights the service loads at "
            "runtime. The weights are downloaded, not shipped, so they are a distribution "
            "question only if that changes."
        ),
    ),
    "cpm": C(
        "MIT", "https://github.com/cpm-cmake/CPM.cmake", [], "build-only",
        scope=TOOLING,
        via="3rdparty/cmake/CPM.cmake — the dependency fetcher itself",
    ),
    "vcpkg": C(
        "MIT", "https://github.com/microsoft/vcpkg", [], "build-only",
        scope=TOOLING,
        via="3rdparty/vcpkg/ — the package manager itself (a git submodule, not shipped code)",
    ),
}

# vcpkg ports that are build tooling or metadata rather than shipped code.
VCPKG_SKIP = re.compile(r"^(vcpkg-|pkgconf$|aclocal$|doc$)")

# Vendored components, discovered from these paths rather than from a build tree.
VENDORED_PATHS = {
    "crow": "3rdparty/crow",
    "yas": "3rdparty/yas",
    "mdns": "3rdparty/mdns.h",
    "inflect": "3rdparty/inflect",
    "cpm": "3rdparty/cmake/CPM.cmake",
    "vcpkg": "3rdparty/vcpkg",
}

# Licence texts for components that ship none of their own (Crow was vendored without
# its LICENSE; the ONNX Runtime binary archives carry none). Kept beside the generator
# rather than under licenses/, so licenses/ is entirely generated and safe to wipe.
MANUAL_TEXTS = Path(__file__).resolve().parent / "license-texts"

# The npm projects whose production closure reaches a user, and where it reaches them.
# hkp-frontend and readymade-frontend are embedded into the app bundles; hkp-website is
# served to browsers and never shipped inside an app. A package in more than one closure
# takes both scopes, because it is genuinely distributed on both paths.
#
# hkp-website's bundle is a superset of its own manifest: its Vite config aliases
# `hkp-frontend/src`, so the playground it serves drags hkp-frontend's closure into the
# browser too. That is why the website's licence page has to show both scopes.
NPM_ROOTS = {
    "hkp-frontend": {"path": "hkp-frontend", "scope": FRONTEND},
    "readymade-frontend": {"path": "meander/frontend", "scope": FRONTEND},
    "hkp-website": {"path": "hkp-website", "scope": WEBSITE},
}

LICENSE_FILE_RE = re.compile(r"^(LICEN[CS]E|COPYING|NOTICE|UNLICENSE)", re.IGNORECASE)


# =============================================================================
# Service scope verification
# =============================================================================
#
# The curated `scope` above is checked against the sources: for a component our own
# code includes directly, the set of services whose translation units reach that
# include must match what the registry claims. Transitive dependencies have no marker
# and are trusted to the registry, which is why the `via` field records their parent.

SERVICE_ROOT = "hkp-rt/lib/src/services"

# Component -> the include text that proves a service uses it directly.
SCOPE_MARKERS = {
    "llama_cpp": "llama.h",
    "sherpa_onnx": "sherpa-onnx/",
    "inflect": "inflect/engine.h",
    "minimp4": "minimp4.h",
    "fdk-aac": "fdk-aac/",
    "inja": "inja.h",
}

SERVICE_ID_RE = re.compile(r'serviceId\(\)\s*\{\s*return\s*"([^"]+)"')
LOCAL_INCLUDE_RE = re.compile(r'#\s*include\s+"([^"]+)"')


def service_sources(repo: Path) -> dict[str, set[Path]]:
    """Map each hkp-rt service id to the translation units that make it up.

    A service is more than the file declaring its id: text-to-speech reaches its inflect
    backend through tts_inflect.h/.cpp. Start at the declaring header and walk local
    include edges, pulling in each header's sibling .cpp, so the closure is the code that
    actually compiles into that service.
    """
    root = (repo / SERVICE_ROOT).resolve()
    if not root.is_dir():
        return {}

    services: dict[str, set[Path]] = {}
    for header in sorted(root.rglob("*.h")):
        match = SERVICE_ID_RE.search(read_text(header))
        if not match:
            continue
        pending, closure = [header], set()
        while pending:
            current = pending.pop()
            if current in closure or not current.is_file():
                continue
            closure.add(current)
            text = read_text(current)
            sibling = current.with_suffix(".cpp")
            if sibling.is_file():
                pending.append(sibling)
            for target in LOCAL_INCLUDE_RE.findall(text):
                candidate = (current.parent / target).resolve()
                if root in candidate.parents or candidate.parent == root:
                    pending.append(candidate)
        services.setdefault(match.group(1), set()).update(closure)
    return services


def verify_scopes(repo: Path, present: set[str]) -> list[str]:
    """Report components whose curated scope disagrees with the sources."""
    services = service_sources(repo)
    if not services:
        return ["could not read " + SERVICE_ROOT + " — service scopes are unverified"]

    problems = []
    for name, marker in SCOPE_MARKERS.items():
        if name not in present:
            continue
        derived = {
            sid for sid, files in services.items()
            if any(marker in read_text(f) for f in files)
        }
        claimed = set(REGISTRY[name].scope)
        if not derived:
            # An empty derivation means the marker no longer matches anything, which
            # hides a stale scope rather than confirming one.
            problems.append(f"{name}: no service includes '{marker}' — the marker is stale")
        elif derived != claimed:
            problems.append(
                f"{name}: sources say {sorted(derived)}, registry says {sorted(claimed)}"
            )
    return problems


# =============================================================================
# Discovery
# =============================================================================


@dataclass
class Found:
    """One discovered component instance: metadata plus where its texts live."""

    name: str
    group: str
    version: str = ""
    license_paths: list[Path] = field(default_factory=list)
    seen_in: set[str] = field(default_factory=set)
    # Where the build actually fetched it from, which for the sherpa-onnx subtree is
    # often a fork rather than the upstream project named in the registry.
    fetch_url: str = ""
    spdx: str = ""
    # npm entries carry their own scope, accumulated across the closures they appear in;
    # native components take theirs from the REGISTRY instead.
    scopes: list[str] = field(default_factory=list)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def license_files(root: Path, extra: list[str]) -> list[Path]:
    """Top-level licence/notice files in root, plus any explicitly named extras."""
    if not root.is_dir():
        return []
    out = [p for p in sorted(root.iterdir()) if p.is_file() and LICENSE_FILE_RE.match(p.name)]
    for name in extra:
        target = root / name
        if target.is_dir():
            out.extend(p for p in sorted(target.rglob("*")) if p.is_file())
        elif target.is_file() and target not in out:
            out.append(target)
    return out


def discover_vcpkg(repo: Path) -> dict[str, Found]:
    """Read vcpkg's installed trees. Each port drops a `copyright` file we can copy."""
    found: dict[str, Found] = {}
    installed = repo / "3rdparty/vcpkg/installed"
    if not installed.is_dir():
        return found

    # Versions come from the info manifests: <port>_<version>_<triplet>.list
    versions: dict[str, str] = {}
    for listing in (installed / "vcpkg/info").glob("*.list"):
        parts = listing.stem.rsplit("_", 2)
        if len(parts) == 3:
            versions[parts[0]] = parts[1]

    for triplet_dir in sorted(installed.iterdir()):
        if not triplet_dir.is_dir() or triplet_dir.name == "vcpkg":
            continue
        for copyright_file in sorted(triplet_dir.glob("share/*/copyright")):
            port = copyright_file.parent.name
            if VCPKG_SKIP.match(port):
                continue
            # boost-* and boost_* are one component for attribution purposes.
            name = "boost" if port.startswith(("boost-", "boost_", "boost")) else port
            entry = found.setdefault(name, Found(name=name, group="vcpkg"))
            entry.version = entry.version or versions.get(port, "")
            entry.seen_in.add(triplet_dir.name)
            if not entry.license_paths:
                entry.license_paths = [copyright_file]
    return found


def discover_cmake(build_dirs: list[Path]) -> dict[str, Found]:
    """Read CPM/FetchContent trees. Version and URL come from the populate scripts."""
    found: dict[str, Found] = {}
    for build_dir in build_dirs:
        deps = build_dir / "_deps"
        if not deps.is_dir():
            continue
        for src in sorted(deps.glob("*-src")):
            name = src.name[: -len("-src")]
            comp = REGISTRY.get(name)
            entry = found.setdefault(name, Found(name=name, group="cmake"))
            entry.seen_in.add(build_dir.name)
            if not entry.version:
                entry.version, entry.fetch_url = cmake_origin(deps, name)
            if not entry.license_paths:
                entry.license_paths = license_files(src, comp.extra_licenses if comp else [])
            if not entry.license_paths and (MANUAL_TEXTS / name).is_dir():
                entry.license_paths = [f for f in sorted((MANUAL_TEXTS / name).iterdir()) if f.is_file()]
    return found


def cmake_origin(deps: Path, name: str) -> tuple[str, str]:
    """Recover (version, fetch URL) from the scripts CMake generates for the populate step.

    Git-based packages record a checkout tag; URL-based ones (the whole sherpa-onnx
    subtree, and the prebuilt ONNX Runtime) only record the archive they downloaded, so
    the version has to be read out of the archive name.
    """
    subbuild = deps / f"{name}-subbuild"
    for script in subbuild.glob("*-populate-prefix/tmp/*-gitclone.cmake"):
        text = read_text(script)
        tag = re.search(r'checkout\s+"([^"]+)"', text)
        url = re.search(r'clone[^\n]*?"(https://[^"]+)"', text)
        if tag:
            return tag.group(1), url.group(1) if url else ""
    for script in subbuild.glob("*-populate-prefix/src/*-populate-stamp/download-*.cmake"):
        urls = [u for u in re.findall(r"(https://[^\]\s\"]+)", read_text(script))
                if "cmake.org" not in u]
        if urls:
            return version_from_url(urls[0]), urls[0]
    return "", ""


def version_from_url(url: str) -> str:
    """Best-effort version out of a release/archive URL."""
    for pattern in (r"/tags/([^/]+?)\.(?:tar\.gz|tar\.bz2|zip|tgz)$",
                    r"/download/([^/]+)/",
                    r"[-_]v?(\d+\.\d+[\w.]*)\.(?:tar\.gz|tar\.bz2|zip|tgz)$",
                    r"/archive/([0-9a-f]{40})\.zip$"):
        match = re.search(pattern, url)
        if match:
            value = match.group(1)
            return value[:12] if re.fullmatch(r"[0-9a-f]{40}", value) else value
    return ""


def discover_vendored(repo: Path) -> dict[str, Found]:
    found: dict[str, Found] = {}
    for name, rel in VENDORED_PATHS.items():
        path = repo / rel
        if not path.exists():
            continue
        entry = Found(name=name, group="vendored", seen_in={"in-tree"})
        entry.version = vendored_version(repo, name)
        stored = MANUAL_TEXTS / name
        if stored.is_dir():
            entry.license_paths = [f for f in sorted(stored.iterdir()) if f.is_file()]
        elif path.is_dir():
            entry.license_paths = license_files(path, [])
        found[name] = entry
    return found


def vendored_version(repo: Path, name: str) -> str:
    if name == "crow":
        header = repo / "3rdparty/crow/version.h"
        if header.is_file():
            match = re.search(r'VERSION\[\]\s*=\s*"([^"]+)"', read_text(header))
            if match:
                return match.group(1)
    if name == "yas":
        header = repo / "3rdparty/yas/version.hpp"
        if header.is_file():
            match = re.search(r"__YAS_VERSION_STRING\s+\"?([0-9.]+)", read_text(header))
            if match:
                return match.group(1)
    return ""


def discover_npm(repo: Path) -> dict[str, Found]:
    """The production closure of each npm project, read from its lockfile."""
    found: dict[str, Found] = {}
    for label, root in NPM_ROOTS.items():
        rel = root["path"]
        lock = repo / rel / "package-lock.json"
        if not lock.is_file():
            continue
        data = json.loads(read_text(lock))
        for key, meta in data.get("packages", {}).items():
            if not key or meta.get("dev"):
                continue
            # Packages the lockfile constrains to an os/cpu are prebuilt Node-native
            # binaries (fsevents, the @cbor-extract/* set). A browser bundle never
            # contains one on any platform, and these frontends are browser bundles even
            # when embedded in an app. Skip them on the declaration, not on whether they
            # happen to be installed here: npm installs only the ones matching the current
            # machine, so testing the directory would make the output depend on who ran
            # the generator and turn --check into a false alarm on a different platform.
            if meta.get("os") or meta.get("cpu"):
                continue
            pkg_name = key.split("node_modules/")[-1]
            version = meta.get("version", "")
            ident = f"{pkg_name}@{version}" if version else pkg_name
            entry = found.setdefault(ident, Found(name=pkg_name, group="npm", version=version))
            entry.seen_in.add(label)
            # A package in two closures is distributed on both paths, so it takes both
            # scopes and its text is written into both folders.
            for scope in root["scope"]:
                if scope not in entry.scopes:
                    entry.scopes.append(scope)
            if not entry.license_paths:
                pkg_dir = repo / rel / key
                entry.license_paths = license_files(pkg_dir, [])
            if not getattr(entry, "spdx", ""):
                entry.spdx = meta.get("license") or npm_license_from_pkg(repo / rel / key)
    return found


def npm_license_from_pkg(pkg_dir: Path) -> str:
    manifest = pkg_dir / "package.json"
    if not manifest.is_file():
        return ""
    try:
        data = json.loads(read_text(manifest))
    except json.JSONDecodeError:
        return ""
    lic = data.get("license") or data.get("licenses")
    if isinstance(lic, list):
        return " OR ".join(x.get("type", "") for x in lic if isinstance(x, dict))
    if isinstance(lic, dict):
        return lic.get("type", "")
    return lic or ""


# =============================================================================
# Emission
# =============================================================================


def slug(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._@-]", "_", name).lstrip("@").replace("/", "_")


def scope_dir(scope: str) -> str:
    """Directory a scope maps to: buckets sit at the top, services under service/."""
    return scope if scope in BUCKETS else f"service/{scope}"


def copy_licenses(out_root: Path, entry: Found, scopes: list[str], write: bool) -> list[str]:
    """Work out where an entry's licence texts belong, and optionally write them there.

    The scope folders are a convenience for auditing, not the record: licenses/index.json
    carries every text once, keyed by content hash, and the tree is derivable from it.
    They are emitted only under --emit-tree, and are deliberately not committed — a second
    copy of the same bytes that nothing verifies is a copy that can drift.

    The placement is computed either way so the notices list the same file names whether
    or not the tree was written, which keeps the generated markdown deterministic.

    Note the tree is lossy where index.json is not: a package present at two versions
    collapses into one directory here, so one of the two texts wins. Sixteen npm packages
    are in that position today. Prefer the index for anything that has to be exact.
    """
    written: list[str] = []
    for scope in scopes or ["unscoped"]:
        dest_dir = out_root / scope_dir(scope) / slug(entry.name)
        seen: set[str] = set()
        for src in entry.license_paths:
            if not src.is_file():
                continue
            # Flatten nested licence directories (llama.cpp's licenses/, piper-phonemize's
            # vendored uni-algo) into distinct names rather than colliding on LICENSE.md.
            name = src.name
            if src.parent.name.lower() in ("licenses", "license", "third_party", "3rdparty"):
                name = f"{src.parent.name}-{src.name}"
            elif name in seen:
                name = f"{src.parent.name}-{src.name}"
            while name in seen:
                name = f"{src.parent.parent.name}-{name}"
            seen.add(name)
            dest = dest_dir / name
            if write:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(src, dest)
            written.append(str(dest.relative_to(out_root.parent)))
    return sorted(written)


def scope_cell(comp: Component | None) -> str:
    if comp is None or not comp.scope:
        return "?"
    if set(comp.scope) == set(SPEECH):
        return "speech services"
    return ", ".join(f"`{x}`" for x in comp.scope)


def targets_cell(comp: Component | None) -> str:
    if comp is None:
        return "?"
    if not comp.targets:
        return "—"
    if set(comp.targets) == set(ALL):
        return "all"
    if set(comp.targets) == set(DESKTOP):
        return "desktop"
    if set(comp.targets) == set(MOBILE):
        return "mobile"
    return ", ".join(comp.targets)


def render(found: dict[str, dict[str, Found]], written: dict[str, list[str]]) -> str:
    lines: list[str] = []
    add = lines.append

    add("# Third-party notices — Readymade native and mobile builds")
    add("")
    add(
        "Readymade is distributed under the GNU Affero General Public License v3.0 (see "
        "[LICENSE](LICENSE)). It incorporates the third-party components listed below. This file "
        "is generated by [scripts/collect-licenses.py](scripts/collect-licenses.py); the verbatim "
        "licence texts live in [licenses/index.json](licenses/index.json), which is also what the "
        "licence pages in the apps and on the website read. Do not edit either by hand."
    )
    add("")
    add(
        "**Ships in** names the build targets whose shipped artifact contains the component. "
        "`desktop` = macOS, Windows and Linux; `mobile` = iOS and Android; `—` = build-time only, "
        "not present in any shipped artifact. The **Version** link points at the exact archive or "
        "tag the build fetched, which for parts of the sherpa-onnx subtree is a fork rather than "
        "the upstream project the component name links to."
    )
    add("")
    add(
        "**Scoped to** says what needs the component. Most are scoped to one or more "
        "hkp-rt service ids; the rest fall into `runtime-core` (the runtime itself — HTTP, "
        "serialization, discovery, auth), `app-shell` (the desktop application around the "
        "runtime), `frontend` (the web app embedded in every app bundle), `website` "
        "(readymadeit.com's own bundle), `build-only` and `not-shipped`. Running the generator "
        "with `--emit-tree` mirrors this onto disk as `licenses/<scope>/<component>/`, where a "
        "service folder holds everything enabling that one service obliges you to ship. That "
        "tree is derivable from the index and is not committed."
    )
    add("")

    # ── Attention list ────────────────────────────────────────────────────────
    flagged = [
        (name, REGISTRY[name])
        for group in ("vcpkg", "cmake", "vendored")
        for name in found.get(group, {})
        if name in REGISTRY and re.match(r"(REVIEW|ACTION REQUIRED|NOT SHIPPED)", REGISTRY[name].notes)
    ]
    copyleft = [
        (name, REGISTRY[name])
        for group in ("vcpkg", "cmake", "vendored")
        for name in found.get(group, {})
        if name in REGISTRY and REGISTRY[name].targets and re.search(r"GPL|MPL|CC-BY", REGISTRY[name].spdx)
    ]
    attention = dict(flagged + copyleft)
    if attention:
        add("## Needs a decision")
        add("")
        add(
            "Everything else here is permissive and satisfied by the attribution in this file. "
            "These are the entries that carry an obligation or an open question."
        )
        add("")
        for name in sorted(attention):
            comp = attention[name]
            add(f"- **{name}** — `{comp.spdx}`, ships in {targets_cell(comp)}. {comp.notes}")
        add("")

    # ── Native groups ─────────────────────────────────────────────────────────
    headings = {
        "vcpkg": ("vcpkg packages", "Installed into `3rdparty/vcpkg/installed/<triplet>` and linked by `find_package()`."),
        "cmake": ("CMake-fetched packages (CPM / FetchContent)", "Fetched at configure time by `3rdparty/CMakeLists.txt`, the root `CMakeLists.txt`, or transitively by one of those. Direct and transitive dependencies are listed together; the *Pulled in by* column says which."),
        "vendored": ("Vendored source", "Third-party source copied into the repository under `3rdparty/`."),
    }
    for group in ("vcpkg", "cmake", "vendored"):
        entries = found.get(group, {})
        if not entries:
            continue
        title, blurb = headings[group]
        add(f"## {title}")
        add("")
        add(blurb)
        add("")
        add("| Component | Version | Licence | Scoped to | Ships in | Linkage | Pulled in by | Texts |")
        add("| --- | --- | --- | --- | --- | --- | --- | --- |")
        for name in sorted(entries):
            entry = entries[name]
            comp = REGISTRY.get(name)
            texts = written.get(f"{group}/{name}", [])
            # File names, not links: the tree they would point at is generated on demand
            # (--emit-tree) rather than committed, so a link would usually dangle. The
            # texts themselves are in licenses/index.json.
            text_cell = ", ".join(sorted({Path(t).name for t in texts})) or "—"
            version = entry.version or "—"
            if entry.fetch_url:
                version = f"[{version}]({entry.fetch_url})"
            add(
                f"| [{name}]({comp.url if comp else ''}) | {version} | "
                f"{comp.spdx if comp else '**UNKNOWN**'} | {scope_cell(comp)} | "
                f"{targets_cell(comp)} | {comp.linkage if comp else '?'} | "
                f"{comp.via if comp else '?'} | {text_cell} |"
            )
        add("")
        notes = [(n, REGISTRY[n]) for n in sorted(entries) if n in REGISTRY and REGISTRY[n].notes]
        if notes:
            add("**Notes**")
            add("")
            for name, comp in notes:
                add(f"- **{name}** — {comp.notes}")
            add("")

    # ── npm ───────────────────────────────────────────────────────────────────
    npm = found.get("npm", {})
    if npm:
        add("## Bundled web frontend (npm)")
        add("")
        add(
            "Two distribution paths, and the *Frontend* column says which a package is on. "
            "`hkp-frontend` and `readymade-frontend` are embedded into the desktop, iOS and "
            "Android bundles, so those packages ship inside every app. `hkp-website` is served "
            "to browsers from readymadeit.com and is never inside an app — but because the site "
            "aliases `hkp-frontend/src` to serve the playground, its browser bundle carries both "
            "sets. A package on both paths is listed once and attributed under both."
        )
        add("")
        add(
            "Each list is the production dependency closure of that project's "
            "`package-lock.json`, a superset of what the bundler actually emits into `dist/` — "
            "erring towards over-attribution. Two things are excluded because they are never "
            "bundled: development-only tooling (Vite, ESLint, test runners), and prebuilt "
            "Node-native binaries, which the lockfile marks with an `os`/`cpu` constraint and "
            "which no browser bundle contains on any platform."
        )
        add("")
        add(
            "A `—` in the *Text* column means the package ships no licence file of its own; its "
            "SPDX identifier as declared in its `package.json` is what the *Licence* column reports, "
            "and that declaration is the attribution."
        )
        add("")
        add("| Package | Version | Licence | Frontend | Text in index |")
        add("| --- | --- | --- | --- | --- |")
        for ident in sorted(npm, key=str.lower):
            entry = npm[ident]
            texts = written.get(f"npm/{ident}", [])
            text_cell = "yes" if texts else "—"
            spdx = getattr(entry, "spdx", "") or "**UNKNOWN**"
            add(
                f"| `{entry.name}` | {entry.version} | {spdx} | "
                f"{', '.join(sorted(entry.seen_in))} | {text_cell} |"
            )
        add("")

    # ── Per-scope index ───────────────────────────────────────────────────────
    by_scope: dict[str, list[str]] = {}
    for group in ("vcpkg", "cmake", "vendored"):
        for name in found.get(group, {}):
            for scope in REGISTRY[name].scope if name in REGISTRY else []:
                by_scope.setdefault(scope, []).append(name)

    services = sorted(k for k in by_scope if k not in BUCKETS)
    buckets = [k for k in ("runtime-core", "app-shell", "build-only", "not-shipped") if k in by_scope]
    if services or buckets:
        add("## What each service pulls in")
        add("")
        add(
            "One row per scope. A service's row is self-contained — it is the full set of "
            "notices for a build with that service enabled, on top of `runtime-core`, which "
            "every build needs. `scripts/collect-licenses.py --emit-tree` writes these out "
            "as folders of licence files under `licenses/`, which is useful for an audit or "
            "a release tarball; the texts themselves live in `licenses/index.json`."
        )
        add("")
        add("| Scope | Components |")
        add("| --- | --- |")
        for scope in services + buckets:
            label = f"`{scope}`" if scope not in BUCKETS else f"**{scope}**"
            names = []
            for name in sorted(set(by_scope[scope])):
                has_text = any(written.get(f"{g}/{name}") for g in ("vcpkg", "cmake", "vendored"))
                # A component with no text has no folder either; say so rather than
                # letting a reader hunt for one that was never written.
                names.append(name if has_text else f"{name} (no text — see notes)")
            add(f"| {label} | {', '.join(names)} |")
        add("")
        add(
            f"The {len(services)} services listed here are the ones with a third-party "
            "dependency of their own; the other hkp-rt services need nothing beyond "
            "`runtime-core`."
        )
        add("")

    add("---")
    add("")
    add(
        "Regenerate with `scripts/collect-licenses.py`, or verify with `--check`. The run fails "
        "on either of two disagreements: a component on disk that the script's registry does not "
        "describe, or a service scope that the hkp-rt sources contradict. So neither a new "
        "dependency nor a dependency moving between services can reach a release without someone "
        "recording what changed."
    )
    add("")
    return "\n".join(lines)


# =============================================================================
# Machine-readable output
# =============================================================================
#
# licenses/index.json feeds the in-app and on-site licence pages. It carries the verbatim
# texts rather than links to them: attribution means reproducing the licence wherever the
# code is distributed, and a page that only points at a repository has not done that.
# Texts are deduplicated by content hash — the same MIT text backs hundreds of packages —
# which is what keeps the payload small enough to ship.

# Which distribution surfaces exist, and which npm root reaches which. The website serves
# the playground by aliasing hkp-frontend/src, so anything in that closure is distributed
# to browsers as well as inside the apps.
NPM_ROOT_SURFACES = {
    "hkp-frontend": ["website"] + TARGETS,
    "readymade-frontend": TARGETS,
    "hkp-website": ["website"],
}


def surfaces_for(entry: Found, comp: Component | None) -> list[str]:
    """Every surface whose shipped artifact contains this component."""
    if entry.group == "npm":
        out: set[str] = set()
        for label in entry.seen_in:
            out.update(NPM_ROOT_SURFACES.get(label, []))
        return [s for s in ["website"] + TARGETS if s in out]
    return list(comp.targets) if comp else []


def build_index(found: dict[str, dict[str, Found]]) -> dict:
    """Assemble the JSON: deduplicated texts plus one record per component."""
    texts: dict[str, str] = {}
    components: list[dict] = []

    for group in ("vcpkg", "cmake", "vendored", "npm"):
        for key in sorted(found.get(group, {}), key=str.lower):
            entry = found[group][key]
            comp = REGISTRY.get(entry.name if group != "npm" else "")
            refs = []
            for path in entry.license_paths:
                if not path.is_file():
                    continue
                body = read_text(path)
                digest = hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]
                texts.setdefault(digest, body)
                refs.append({"file": path.name, "hash": digest})

            record = {
                "name": entry.name,
                "version": entry.version,
                "spdx": (comp.spdx if comp else entry.spdx) or "UNKNOWN",
                "group": group,
                "surfaces": surfaces_for(entry, comp),
                "texts": refs,
            }
            if comp:
                record["url"] = comp.url
                record["scopes"] = comp.scope
                if comp.via:
                    record["via"] = comp.via
                if comp.notes:
                    record["notes"] = comp.notes
            else:
                record["url"] = f"https://www.npmjs.com/package/{entry.name}"
                record["scopes"] = entry.scopes
            components.append(record)

    return {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "project": {
            "name": "Readymade",
            "spdx": "AGPL-3.0-only",
            "source": "https://github.com/cbastuck/hkp",
        },
        "surfaces": ["website"] + TARGETS,
        "texts": texts,
        "components": components,
    }


# =============================================================================
# Main
# =============================================================================


def default_build_dirs(repo: Path) -> list[Path]:
    """Build trees to read. More trees = better coverage of per-platform dependencies."""
    candidates = [
        repo / "build",
        repo / "build/meander-ios-device",
        repo / "build/meander-ios-simulator",
        repo / "build-tests",
    ]
    for cxx in sorted((repo / "meander-android/app/.cxx").glob("*/*/*")):
        candidates.append(cxx)
    return [p for p in candidates if (p / "_deps").is_dir()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--build-dir", action="append", type=Path, default=[],
                        help="CMake build tree to scan for _deps (repeatable). Defaults to the known trees.")
    parser.add_argument("--out", type=Path, default=REPO, help="Output root (default: repo root).")
    parser.add_argument("--check", action="store_true", help="Generate into a temp dir and diff against the committed output.")
    parser.add_argument("--allow-unknown", action="store_true", help="Do not fail on components missing from the registry.")
    parser.add_argument("--emit-tree", action="store_true",
                        help="Also write licenses/<scope>/<component>/ folders of licence "
                             "files. Derivable from licenses/index.json and therefore not "
                             "committed; emit it for an audit or a release tarball.")
    args = parser.parse_args()

    build_dirs = args.build_dir or default_build_dirs(REPO)
    if not build_dirs:
        print("no CMake build tree with a _deps/ directory found — configure a build first "
              "(./build.sh) so the fetched packages are on disk", file=sys.stderr)
        return 2

    print(f"scanning build trees: {', '.join(str(b.relative_to(REPO)) for b in build_dirs)}", file=sys.stderr)

    found = {
        "vcpkg": discover_vcpkg(REPO),
        "cmake": discover_cmake(build_dirs),
        "vendored": discover_vendored(REPO),
        "npm": discover_npm(REPO),
    }

    unknown = [
        f"{group}/{name}"
        for group in ("vcpkg", "cmake", "vendored")
        for name in found[group]
        if name not in REGISTRY
    ]
    if unknown:
        print("components on disk with no registry entry:", file=sys.stderr)
        for item in unknown:
            print(f"  {item}", file=sys.stderr)
        print("add them to REGISTRY in this script (licence, targets, linkage, what pulled them in)",
              file=sys.stderr)
        if not args.allow_unknown:
            return 1

    present = {name for group in ("vcpkg", "cmake", "vendored") for name in found[group]}
    problems = verify_scopes(REPO, present)
    if problems:
        print("service scopes disagree with the sources:", file=sys.stderr)
        for problem in problems:
            print(f"  {problem}", file=sys.stderr)
        print("fix the `scope=` entry in REGISTRY, or SCOPE_MARKERS if the include moved",
              file=sys.stderr)
        if not args.allow_unknown:
            return 1

    out_root = Path(tempfile.mkdtemp(prefix="licenses-check-")) if args.check else args.out
    licenses_dir = out_root / "licenses"

    # index.json is the record and lives in licenses/; only the generated scope folders
    # beside it are cleared, and only when this run is going to rewrite them.
    if args.emit_tree and not args.check and licenses_dir.is_dir():
        for child in licenses_dir.iterdir():
            if child.is_dir():
                shutil.rmtree(child)

    written: dict[str, list[str]] = {}
    for group, entries in found.items():
        for key, entry in entries.items():
            scopes = entry.scopes if group == "npm" else REGISTRY[key].scope if key in REGISTRY else []
            written[f"{group}/{key}"] = copy_licenses(
                licenses_dir, entry, scopes, write=args.emit_tree and not args.check
            )

    missing = [k for k, v in written.items() if not v and not k.startswith("npm/")]
    if missing:
        print(f"no licence text found for: {', '.join(sorted(missing))}", file=sys.stderr)

    notices = out_root / "THIRD-PARTY-NOTICES.md"
    notices.write_text(render(found, written), encoding="utf-8")

    index = licenses_dir / "index.json"
    index.parent.mkdir(parents=True, exist_ok=True)
    index.write_text(json.dumps(build_index(found), indent=1, sort_keys=False), encoding="utf-8")

    if args.check:
        stale = False
        for committed, fresh in (
            (REPO / "THIRD-PARTY-NOTICES.md", notices),
            (REPO / "licenses/index.json", index),
        ):
            result = subprocess.run(
                ["diff", "-u", str(committed), str(fresh)],
                capture_output=True, text=True,
            )
            if result.returncode != 0:
                print(f"{committed.relative_to(REPO)} is out of date — "
                      "run scripts/collect-licenses.py", file=sys.stderr)
                # index.json is one line per key at this indent; a full diff is unreadable.
                print("\n".join(result.stdout.splitlines()[:40]), file=sys.stderr)
                stale = True
        if stale:
            return 1
        print("THIRD-PARTY-NOTICES.md and licenses/index.json are up to date", file=sys.stderr)
        return 0

    counts = {g: len(e) for g, e in found.items()}
    print(f"wrote {notices.relative_to(REPO)} and {licenses_dir.relative_to(REPO)}/ "
          f"({counts['vcpkg']} vcpkg, {counts['cmake']} cmake, {counts['vendored']} vendored, "
          f"{counts['npm']} npm)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
