"""Technical and content audit helpers for LLM/GEO discoverability."""

from __future__ import annotations

import asyncio
import ipaddress
import json
import re
import socket
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import httpx


MAX_DOCUMENT_BYTES = 2_000_000
MAX_REDIRECTS = 5
AUDIT_USER_AGENT = "GEOTrack-Audit/1.0 (+https://geotrack.ai)"
LLM_BOTS = ("GPTBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended")


class AuditFetchError(ValueError):
    """A safe, user-facing URL audit error."""


@dataclass
class PageSignals:
    title: str = ""
    description: str = ""
    canonical: str = ""
    robots_meta: str = ""
    language: str = ""
    headings: dict[str, list[str]] = field(
        default_factory=lambda: {f"h{level}": [] for level in range(1, 7)}
    )
    image_count: int = 0
    images_without_alt: int = 0
    json_ld_types: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)
    text_parts: list[str] = field(default_factory=list)
    og_title: str = ""
    og_description: str = ""

    @property
    def text(self) -> str:
        return re.sub(r"\s+", " ", " ".join(self.text_parts)).strip()

    @property
    def word_count(self) -> int:
        return len(re.findall(r"\b[\wÀ-ÿ'-]+\b", self.text))


class SignalParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.signals = PageSignals()
        self._capture: str | None = None
        self._buffer: list[str] = []
        self._skip_depth = 0
        self._json_ld = False

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attrs = {key.lower(): value or "" for key, value in attrs_list}
        if tag == "html":
            self.signals.language = attrs.get("lang", "").strip()
        if tag in {"script", "style", "noscript", "template"}:
            self._skip_depth += 1
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self._json_ld = True
            self._capture = "jsonld"
            self._buffer = []
        elif tag == "title":
            self._capture = "title"
            self._buffer = []
        elif tag in self.signals.headings:
            self._capture = tag
            self._buffer = []
        elif tag == "meta":
            name = attrs.get("name", "").lower()
            prop = attrs.get("property", "").lower()
            content = attrs.get("content", "").strip()
            if name == "description":
                self.signals.description = content
            elif name == "robots":
                self.signals.robots_meta = content.lower()
            elif prop == "og:title":
                self.signals.og_title = content
            elif prop == "og:description":
                self.signals.og_description = content
        elif tag == "link":
            rel = attrs.get("rel", "").lower().split()
            if "canonical" in rel:
                self.signals.canonical = attrs.get("href", "").strip()
        elif tag == "img":
            self.signals.image_count += 1
            if not attrs.get("alt", "").strip():
                self.signals.images_without_alt += 1
        elif tag == "a" and attrs.get("href"):
            self.signals.links.append(attrs["href"])

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self._capture == tag:
            value = re.sub(r"\s+", " ", " ".join(self._buffer)).strip()
            if tag == "title":
                self.signals.title = value
            elif tag in self.signals.headings and value:
                self.signals.headings[tag].append(value)
            self._capture = None
            self._buffer = []
        elif tag == "script" and self._json_ld:
            raw = "".join(self._buffer).strip()
            self.signals.json_ld_types.extend(_json_ld_types(raw))
            self._json_ld = False
            self._capture = None
            self._buffer = []
        if tag in {"script", "style", "noscript", "template"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buffer.append(data)
        if self._skip_depth == 0 and data.strip():
            self.signals.text_parts.append(data.strip())


def _json_ld_types(raw: str) -> list[str]:
    if not raw:
        return []
    try:
        payload = json.loads(raw)
    except (TypeError, ValueError, json.JSONDecodeError):
        return []
    found: list[str] = []

    def walk(value) -> None:
        if isinstance(value, dict):
            item_type = value.get("@type")
            if isinstance(item_type, str):
                found.append(item_type)
            elif isinstance(item_type, list):
                found.extend(str(item) for item in item_type)
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(payload)
    return list(dict.fromkeys(found))


def parse_page(html: str) -> PageSignals:
    parser = SignalParser()
    parser.feed(html)
    return parser.signals


async def _validate_public_url(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise AuditFetchError("L’URL doit être une adresse HTTP ou HTTPS valide")
    if parsed.username or parsed.password:
        raise AuditFetchError("Les URL contenant des identifiants ne sont pas autorisées")
    try:
        addresses = await asyncio.to_thread(
            socket.getaddrinfo,
            parsed.hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise AuditFetchError("Le nom de domaine est introuvable") from exc
    for address in {item[4][0] for item in addresses}:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise AuditFetchError("Cette URL pointe vers une adresse réseau non publique")
    return parsed.geturl()


async def safe_get(client: httpx.AsyncClient, url: str) -> tuple[httpx.Response, str]:
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        current = await _validate_public_url(current)
        response = await client.get(
            current,
            headers={"User-Agent": AUDIT_USER_AGENT, "Accept": "text/html,application/xml,text/plain;q=0.9,*/*;q=0.1"},
            follow_redirects=False,
        )
        if response.status_code not in {301, 302, 303, 307, 308}:
            if len(response.content) > MAX_DOCUMENT_BYTES:
                raise AuditFetchError("Le document dépasse la taille maximale analysable de 2 Mo")
            return response, current
        location = response.headers.get("location")
        if not location:
            return response, current
        current = urljoin(current, location)
    raise AuditFetchError("L’URL effectue trop de redirections")


async def optional_safe_get(client: httpx.AsyncClient, url: str) -> tuple[httpx.Response, str]:
    """Fetch an auxiliary audit resource without aborting the whole report."""
    try:
        return await safe_get(client, url)
    except (AuditFetchError, httpx.HTTPError):
        request = httpx.Request("GET", url)
        return httpx.Response(599, request=request, text=""), url


def _robots_rules(content: str) -> dict:
    groups: dict[str, list[str]] = {}
    agents: list[str] = []
    sitemaps: list[str] = []
    for raw_line in content.splitlines():
        line = raw_line.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, value = (part.strip() for part in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            agents = [value.lower()]
            groups.setdefault(value.lower(), [])
        elif key == "disallow":
            for agent in agents:
                groups.setdefault(agent, []).append(value)
        elif key == "sitemap" and value:
            sitemaps.append(value)

    def status(bot: str) -> str:
        rules = groups.get(bot.lower(), groups.get("*", []))
        return "blocked" if any(rule.strip() == "/" for rule in rules) else "allowed"

    return {
        "blocks_all": status("*") == "blocked",
        "bots": {bot: status(bot) for bot in LLM_BOTS},
        "sitemaps": list(dict.fromkeys(sitemaps)),
    }


def _finding(priority: str, category: str, title: str, evidence: str, recommendation: str) -> dict:
    return {
        "priority": priority,
        "category": category,
        "title": title,
        "evidence": evidence,
        "recommendation": recommendation,
    }


def build_findings(
    signals: PageSignals,
    *,
    page_status: int,
    robots_status: int,
    robots: dict,
    sitemap_status: int,
    sitemap_url_count: int,
    llms_status: int,
    brand: str,
) -> list[dict]:
    findings: list[dict] = []
    if page_status >= 400:
        findings.append(_finding("critical", "Accessibilité", "La page n’est pas accessible", f"HTTP {page_status}", "Rétablir une réponse HTTP 200 avant toute optimisation GEO."))
    if robots.get("blocks_all"):
        findings.append(_finding("critical", "Exploration", "robots.txt bloque toute exploration", "User-agent: * avec Disallow: /", "Autoriser les robots utiles ou limiter le blocage aux zones réellement privées."))
    blocked_bots = [bot for bot, state in robots.get("bots", {}).items() if state == "blocked"]
    if blocked_bots:
        findings.append(_finding("high", "LLM", "Des robots de LLM sont bloqués", ", ".join(blocked_bots), "Réviser robots.txt selon votre politique d’indexation et autoriser explicitement les agents souhaités."))
    if "noindex" in signals.robots_meta:
        findings.append(_finding("critical", "Indexation", "La page demande à ne pas être indexée", f'meta robots="{signals.robots_meta}"', "Retirer noindex si cette page doit apparaître dans les moteurs et les systèmes de recherche augmentée."))
    if not signals.title:
        findings.append(_finding("high", "Métadonnées", "Titre HTML absent", "Aucune balise <title> exploitable", "Ajouter un titre unique qui associe clairement l’entité, l’offre et le sujet principal."))
    elif not 25 <= len(signals.title) <= 70:
        findings.append(_finding("medium", "Métadonnées", "Titre HTML peu optimal", f"{len(signals.title)} caractères", "Viser environ 25 à 70 caractères avec la marque et l’intention principale."))
    if not signals.description:
        findings.append(_finding("high", "Métadonnées", "Meta description absente", "Aucune description détectée", "Rédiger une description factuelle de la page, de son offre et de sa valeur distinctive."))
    if not signals.headings["h1"]:
        findings.append(_finding("high", "Structure", "Titre H1 absent", "Aucun H1 détecté", "Ajouter un H1 descriptif qui répond directement au sujet de la page."))
    elif len(signals.headings["h1"]) > 1:
        findings.append(_finding("medium", "Structure", "Plusieurs H1 détectés", f"{len(signals.headings['h1'])} H1", "Conserver un H1 principal et structurer les sections suivantes avec H2/H3."))
    if signals.word_count < 250:
        findings.append(_finding("high", "Contenu", "Contenu textuel trop léger", f"{signals.word_count} mots détectés", "Enrichir la page avec une réponse complète, des faits vérifiables, des cas d’usage et des réponses aux questions fréquentes."))
    if not signals.canonical:
        findings.append(_finding("medium", "Indexation", "URL canonique absente", "Aucune balise rel=canonical", "Déclarer l’URL canonique absolue pour consolider les signaux de la page."))
    if not signals.json_ld_types:
        findings.append(_finding("high", "Données structurées", "Aucune donnée Schema.org détectée", "Aucun JSON-LD exploitable", "Ajouter un JSON-LD adapté : Organization, WebSite et un type métier comme Product, Service, Article ou LocalBusiness."))
    elif not {"Organization", "WebSite"} & set(signals.json_ld_types):
        findings.append(_finding("medium", "Entité", "L’entité de marque est peu structurée", f"Types détectés : {', '.join(signals.json_ld_types)}", "Compléter le JSON-LD avec Organization ou WebSite, logo, URL et profils sameAs."))
    if brand:
        mentions = len(re.findall(re.escape(brand), signals.text, re.IGNORECASE))
        if mentions == 0:
            findings.append(_finding("high", "Entité", "La marque n’est pas clairement nommée", f'“{brand}” absent du texte visible', "Présenter explicitement la marque, son expertise, sa zone de service et ses preuves de légitimité."))
    question_headings = sum(1 for values in signals.headings.values() for value in values if "?" in value)
    if question_headings == 0:
        findings.append(_finding("medium", "GEO", "Aucune réponse structurée sous forme de question", "Aucun titre interrogatif détecté", "Ajouter une FAQ utile avec des questions naturelles et des réponses autonomes, courtes puis détaillées."))
    links_text = " ".join(signals.links).lower()
    if not any(marker in links_text for marker in ("about", "a-propos", "qui-sommes", "contact")):
        findings.append(_finding("medium", "Confiance", "Signaux d’identité difficiles à trouver", "Aucun lien À propos ou Contact détecté", "Rendre visibles les pages À propos, Contact, mentions légales, auteurs et preuves d’expertise."))
    if signals.image_count and signals.images_without_alt:
        findings.append(_finding("low", "Accessibilité", "Des images n’ont pas de texte alternatif", f"{signals.images_without_alt}/{signals.image_count} images sans alt", "Ajouter des textes alternatifs descriptifs aux images porteuses d’information."))
    if not signals.language:
        findings.append(_finding("low", "Technique", "Langue du document non déclarée", "Attribut lang absent sur <html>", "Déclarer la langue principale, par exemple <html lang=\"fr\">."))
    if not signals.og_title or not signals.og_description:
        findings.append(_finding("low", "Partage", "Métadonnées Open Graph incomplètes", "og:title ou og:description absent", "Compléter les métadonnées Open Graph pour améliorer les reprises et partages."))
    if robots_status >= 400:
        findings.append(_finding("medium", "Exploration", "robots.txt absent ou inaccessible", f"HTTP {robots_status} sur /robots.txt", "Créer un robots.txt explicite, le rendre accessible et y déclarer le sitemap XML."))
    if sitemap_status >= 400 or sitemap_url_count == 0:
        findings.append(_finding("medium", "Exploration", "Sitemap XML absent ou vide", f"HTTP {sitemap_status}, {sitemap_url_count} URL", "Publier un sitemap XML à jour, accessible et déclaré dans robots.txt."))
    if llms_status == 404:
        findings.append(_finding("low", "GEO", "Aucun fichier llms.txt détecté", "HTTP 404 sur /llms.txt", "Optionnel : publier un llms.txt concis qui référence les contenus de référence du site."))

    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    return sorted(findings, key=lambda item: order[item["priority"]])


async def audit_url(url: str, brand: str = "") -> dict:
    candidate = url.strip()
    if "://" not in candidate:
        candidate = f"https://{candidate}"
    candidate = await _validate_public_url(candidate)
    async with httpx.AsyncClient(timeout=httpx.Timeout(20, connect=8)) as client:
        page_response, final_url = await safe_get(client, candidate)
        content_type = page_response.headers.get("content-type", "")
        if "html" not in content_type.lower() and not page_response.text.lstrip().lower().startswith(("<!doctype html", "<html")):
            raise AuditFetchError("L’URL ne renvoie pas une page HTML analysable")
        signals = parse_page(page_response.text)
        parsed = urlparse(final_url)
        root = f"{parsed.scheme}://{parsed.netloc}"

        robots_response, robots_url = await optional_safe_get(client, urljoin(root, "/robots.txt"))
        robots_content = robots_response.text if robots_response.status_code < 400 else ""
        robots = _robots_rules(robots_content)
        sitemap_url = robots["sitemaps"][0] if robots["sitemaps"] else urljoin(root, "/sitemap.xml")
        sitemap_response, final_sitemap_url = await optional_safe_get(client, sitemap_url)
        sitemap_count = len(re.findall(r"<loc(?:\s[^>]*)?>", sitemap_response.text, re.IGNORECASE)) if sitemap_response.status_code < 400 else 0
        llms_response, llms_url = await optional_safe_get(client, urljoin(root, "/llms.txt"))

    findings = build_findings(
        signals,
        page_status=page_response.status_code,
        robots_status=robots_response.status_code,
        robots=robots,
        sitemap_status=sitemap_response.status_code,
        sitemap_url_count=sitemap_count,
        llms_status=llms_response.status_code,
        brand=brand.strip(),
    )
    penalty = {"critical": 25, "high": 12, "medium": 6, "low": 2}
    score = max(0, 100 - sum(penalty[item["priority"]] for item in findings))
    priority_counts = {
        priority: sum(item["priority"] == priority for item in findings)
        for priority in ("critical", "high", "medium", "low")
    }
    return {
        "url": candidate,
        "final_url": final_url,
        "brand": brand.strip(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "score": score,
        "priority_counts": priority_counts,
        "findings": findings,
        "page": {
            "status": page_response.status_code,
            "content_type": page_response.headers.get("content-type"),
            "title": signals.title,
            "description": signals.description,
            "canonical": signals.canonical,
            "language": signals.language,
            "robots_meta": signals.robots_meta,
            "word_count": signals.word_count,
            "headings": {key: len(value) for key, value in signals.headings.items()},
            "h1": signals.headings["h1"],
            "image_count": signals.image_count,
            "images_without_alt": signals.images_without_alt,
            "json_ld_types": signals.json_ld_types,
        },
        "robots": {
            "url": robots_url,
            "status": robots_response.status_code,
            **robots,
        },
        "sitemap": {
            "url": final_sitemap_url,
            "status": sitemap_response.status_code,
            "url_count": sitemap_count,
        },
        "llms_txt": {
            "url": llms_url,
            "status": llms_response.status_code,
            "present": llms_response.status_code < 400,
        },
    }
