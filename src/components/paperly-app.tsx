"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, CloudOff, Download, FileCheck2, FileClock, Files, Grid2X2, Heart, History, Layers2, Leaf, LockKeyhole, Menu, MonitorDown, Plus, Search, Settings2, ShieldCheck, Sparkles, Star, WandSparkles, X, Zap } from "lucide-react";
import { categories, formatBytes, tools, type Category, type Tool } from "@/lib/tools";
import { HeroArt } from "./hero-art";
import { ToolIcon } from "./tool-icon";
import { ToolDialog, type JobDetails } from "./tool-dialog";
import { InfoDialog, type InfoType } from "./info-dialog";

type View = "all" | "history" | "favorites";
type HistoryItem = JobDetails & { id: string; createdAt: string };
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const categoryIcons = { Organize: Layers2, Convert: ArrowLeftRight, "Edit & optimize": WandSparkles, Security: LockKeyhole };
const initialWorkspace = "My workspace";

export function PaperlyApp() {
  const [view, setView] = useState<View>("all");
  const [category, setCategory] = useState<Category | "All tools">("All tools");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [workspaceName, setWorkspaceName] = useState(initialWorkspace);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [info, setInfo] = useState<InfoType | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [toast, setToast] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const toolsSection = useRef<HTMLElement>(null);
  const favoriteTouched = useRef(false);
  const localHistory = useRef<HistoryItem[]>([]);

  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    try {
      const savedFavorites = JSON.parse(localStorage.getItem("paperly-favorites") ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage, an external store
      if (Array.isArray(savedFavorites)) setFavorites(savedFavorites.filter((id: unknown) => typeof id === "string" && tools.some((tool) => tool.id === id)));
      const savedHistory = JSON.parse(localStorage.getItem("paperly-history") ?? "[]");
      if (Array.isArray(savedHistory)) { localHistory.current = savedHistory.filter((item) => typeof item?.id === "string" && item.id.startsWith("local-")); setHistory(savedHistory); }
      setWorkspaceName(localStorage.getItem("paperly-name") ?? initialWorkspace);
    } catch { /* The app also works when local storage is unavailable. */ }
    setStorageReady(true);
    const controller = new AbortController();
    fetch("/api/workspace", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Workspace is offline");
      const data = await response.json();
      if (!favoriteTouched.current) setFavorites(data.workspace.favorites);
      setWorkspaceName(data.workspace.name);
      const merged: HistoryItem[] = data.history;
      const unsaved = localHistory.current.filter((item) => !merged.some((saved) => saved.id === item.id) && item.id.startsWith("local-"));
      setHistory([...unsaved, ...merged].slice(0, 50));
    }).catch(() => { /* File processing remains available without a network. */ });
    const params = new URLSearchParams(window.location.search);
    const requestedTool = tools.find((tool) => tool.id === params.get("tool"));
    if (requestedTool) setSelectedTool(requestedTool);
    if (params.get("view") === "history") setView("history");
    setOnline(navigator.onLine);
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onOnline = () => {
      setOnline(true);
      void (async () => {
        try {
          if (localStorage.getItem("paperly-favorites-pending") === "true") {
            const saved = JSON.parse(localStorage.getItem("paperly-favorites") ?? "[]");
            const response = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorites: saved }) });
            if (response.ok) localStorage.removeItem("paperly-favorites-pending");
          }
          for (const item of [...localHistory.current]) {
            const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "job", toolId: item.toolId, fileName: item.fileName, inputSize: item.inputSize, outputSize: item.outputSize, pageCount: item.pageCount }) });
            if (!response.ok) continue;
            const data = await response.json();
            localHistory.current = localHistory.current.filter((saved) => saved.id !== item.id);
            setHistory((previous) => previous.map((saved) => saved.id === item.id ? data.job : saved));
          }
        } catch { /* The next reconnect will try again. */ }
      })();
    };
    const onOffline = () => setOnline(false);
    const onInstallPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); notify("paperly is installed. Make yourself at home!"); };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setView("all"); setTimeout(() => searchInput.current?.focus(), 30); }
    };
    window.addEventListener("online", onOnline); window.addEventListener("offline", onOffline); window.addEventListener("beforeinstallprompt", onInstallPrompt); window.addEventListener("appinstalled", onInstalled); window.addEventListener("keydown", onKey);
    return () => { controller.abort(); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); window.removeEventListener("beforeinstallprompt", onInstallPrompt); window.removeEventListener("appinstalled", onInstalled); window.removeEventListener("keydown", onKey); };
  }, [notify]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(""), 4200); return () => clearTimeout(timeout); }, [toast]);
  useEffect(() => { if (!storageReady) return; try { localStorage.setItem("paperly-favorites", JSON.stringify(favorites)); localStorage.setItem("paperly-history", JSON.stringify(history)); localStorage.setItem("paperly-name", workspaceName); } catch { /* Optional local backup. */ } }, [favorites, history, workspaceName, storageReady]);
  useEffect(() => { if (!profileOpen) return; const close = (event: MouseEvent) => { if (!(event.target as HTMLElement).closest(".workspace-profile")) setProfileOpen(false); }; const key = (event: KeyboardEvent) => { if (event.key === "Escape") setProfileOpen(false); }; document.addEventListener("click", close); window.addEventListener("keydown", key); return () => { document.removeEventListener("click", close); window.removeEventListener("keydown", key); }; }, [profileOpen]);

  const navigate = (next: View, nextCategory: Category | "All tools" = "All tools") => { setView(next); setCategory(nextCategory); setSearch(""); setSidebarOpen(false); setProfileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openTool = (tool: Tool) => { setSelectedTool(tool); setSidebarOpen(false); };
  const toggleFavorite = async (tool: Tool) => {
    favoriteTouched.current = true;
    const next = favorites.includes(tool.id) ? favorites.filter((id) => id !== tool.id) : [...favorites, tool.id];
    setFavorites(next);
    notify(next.includes(tool.id) ? `${tool.name} added to your favorites` : `${tool.name} removed from your favorites`);
    if (!navigator.onLine) { localStorage.setItem("paperly-favorites-pending", "true"); return; }
    try { const response = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorites: next }) }); if (!response.ok) throw new Error(); localStorage.removeItem("paperly-favorites-pending"); }
    catch { notify("Saved on this device. We’ll sync your favorites when you’re back online."); try { localStorage.setItem("paperly-favorites-pending", "true"); } catch {} }
  };
  const saveHistory = async (job: JobDetails) => {
    const newItem: HistoryItem = { ...job, id: `local-${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
    localHistory.current = [newItem, ...localHistory.current].slice(0, 50);
    setHistory((previous) => [newItem, ...previous].slice(0, 50));
    try { const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "job", ...job }) }); if (!response.ok) throw new Error(); const data = await response.json(); setHistory((previous) => previous.map((item) => item.id === newItem.id ? data.job : item)); localHistory.current = localHistory.current.filter((item) => item.id !== newItem.id); }
    catch { notify("File ready! Your history is saved on this device and will sync later."); }
  };
  const saveName = async (name: string) => {
    const response = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "Couldn’t save your workspace. Please try again."); }
    setWorkspaceName(name.trim());
  };
  const clearHistory = async () => {
    const response = await fetch("/api/workspace", { method: "DELETE" });
    if (!response.ok) throw new Error("Your history couldn’t be cleared. Please try again when you’re online.");
    localHistory.current = []; setHistory([]);
  };
  const install = async () => {
    if (installed) { setInfo("install"); return; }
    if (installPrompt) { try { await installPrompt.prompt(); const choice = await installPrompt.userChoice; if (choice.outcome === "accepted") notify("A little closer. paperly is on its way to your home screen."); setInstallPrompt(null); } catch { setInfo("install"); } }
    else setInfo("install");
  };
  const matchingTools = tools.filter((tool) => (view !== "favorites" || favorites.includes(tool.id)) && (category === "All tools" || tool.category === category) && `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(search.toLowerCase()));
  const matchingHistory = history.filter((item) => `${item.fileName} ${tools.find((tool) => tool.id === item.toolId)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const currentTitle = view === "history" ? "My files" : view === "favorites" ? "Favorites" : category === "All tools" ? "All tools" : category;
  const shownCount = view === "history" ? history.length : matchingTools.length;

  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}/>}
    <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
      <button className="brand" onClick={() => navigate("all")} aria-label="paperly home"><span className="brand-mark"><span/><span/><i/></span><span>paperly<span className="brand-dot">.</span></span></button>
      <div className="sidebar-inner"><p className="nav-label">YOUR WORKSPACE</p><nav className="primary-navigation" aria-label="Workspace"><button className={view === "all" ? "active" : ""} onClick={() => navigate("all")}><Grid2X2 size={19}/><span>All tools</span><span className="nav-count">20</span></button><button className={view === "history" ? "active" : ""} onClick={() => navigate("history")}><FileClock size={19}/><span>My files</span>{history.length > 0 && <span className="nav-count">{history.length}</span>}</button><button className={view === "favorites" ? "active" : ""} onClick={() => navigate("favorites")}><Star size={19}/><span>Favorites</span>{favorites.length > 0 && <span className="nav-count">{favorites.length}</span>}</button></nav>
      <div className="sidebar-divider"/><p className="nav-label toolbox-label">THE TOOLBOX</p><nav className="category-navigation" aria-label="Tool collections">{categories.map((item) => { const Icon = categoryIcons[item]; return <button className={view === "all" && category === item ? "category-active" : ""} key={item} onClick={() => navigate("all", item)}><Icon size={17}/><span>{item}</span><ChevronRight size={13}/></button>; })}</nav>
      <div className="sidebar-promo"><div className="promo-top"><span className="promo-heart"><Heart size={17}/></span><span>GOOD TO KNOW</span></div><h3>A little less paperwork.<br/>A little more life.</h3><p>Always free. Always here for you.</p><div className="promo-doodle" aria-hidden="true"><span/><span/><i/></div></div>
      <div className="sidebar-bottom"><button className="help-nav" onClick={() => { setInfo("help"); setSidebarOpen(false); }}><CircleHelp size={18}/><span>Help & feedback</span><ArrowUpRight size={15}/></button><div className="sidebar-footer"><span className="little-flower">✳</span> Made for your everyday.</div></div></div>
    </aside>
    <div className="workspace-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21}/></button><button className="mobile-brand" onClick={() => navigate("all")} aria-label="paperly home">paperly<span>.</span></button><span className="breadcrumb-workspace">Workspace</span><ChevronRight size={14}/><strong>{currentTitle}</strong></div><div className="topbar-actions"><button className="updates-button" onClick={() => setInfo("updates")}><span/> What’s new</button><span className="topbar-divider"/><button className={`button install-button ${installed ? "is-installed" : ""}`} onClick={install}><MonitorDown size={16}/><span>{installed ? "App installed" : "Install app"}</span></button><div className="workspace-profile"><button className="avatar-button" onClick={() => setProfileOpen(!profileOpen)} aria-label="Open workspace menu" aria-expanded={profileOpen}>{workspaceName.trim().charAt(0).toUpperCase() || "M"}<span/></button>{profileOpen && <div className="profile-menu"><div className="profile-menu-heading"><strong>{workspaceName}</strong><span><LockKeyhole size={11}/> Your private guest workspace</span></div><button onClick={() => navigate("history")}><FileClock size={16}/> My recent files</button><button onClick={() => { setInfo("settings"); setProfileOpen(false); }}><Settings2 size={16}/> Workspace settings</button><button onClick={() => { setInfo("privacy"); setProfileOpen(false); }}><ShieldCheck size={16}/> Privacy, by design</button><div className="profile-menu-bottom">No account. No fuss. Just you.</div></div>}</div></div></header>
    {!online && <div className="offline-banner"><CloudOff size={15}/><span>You’re offline. Your files can still be processed in this browser. Previously used tools are available.</span></div>}
    <main className={`main-content ${view !== "all" ? "alternate-view" : ""}`}>
      {view === "all" && <><section className="hero" aria-labelledby="hero-title"><div className="hero-copy"><div className="hero-eyebrow"><Sparkles size={13}/> YOUR EVERYDAY PDF COMPANION</div><h1 id="hero-title">All your PDF tools.<br/><span>One happy place.</span></h1><p>Less time figuring things out. More time getting things done.<br className="hero-linebreak"/> Simple, secure, and always 100% free.</p><div className="hero-actions"><button className="button primary hero-button" onClick={() => { toolsSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }); searchInput.current?.focus({ preventScroll: true }); }}>Find your tool <ArrowDownRight size={17}/></button><button className="hero-how" onClick={() => setInfo("help")}>How it works <ArrowUpRight size={14}/></button></div></div><HeroArt/><span className="hero-corner-note">a little less PDF. a little more possibility.</span></section>
      <div className="trust-strip"><span><ShieldCheck size={16}/><span>Private by design</span></span><i/><span><Zap size={16}/><span>No sign-up. No waiting.</span></span><i/><span><Heart size={16}/><span>100% free. No strings attached.</span></span></div></>}
      {view !== "all" && <div className="collection-heading"><div className="collection-eyebrow">{view === "history" ? <FileClock size={16}/> : <Star size={16}/>} YOUR LITTLE CORNER OF PAPERLY</div><h1>{view === "history" ? "Less searching. More finding." : "Your go-to tools, all together."}</h1><p>{view === "history" ? "A little record of the things you’ve made happen. Your files stay on your device." : "A home for the tools you come back to. Keep your everyday favorites close."}</p></div>}
      <section className="tools-section" ref={toolsSection} aria-labelledby="tools-heading"><div className="tools-heading-row"><div><h2 id="tools-heading">{view === "history" ? "Recent activity" : view === "favorites" ? "Your favorites" : "What’s on your to-do list?"}<span className="heading-count">{view === "history" ? history.length : view === "favorites" ? favorites.length : "20"}</span></h2><p>{view === "history" ? "Just the details. Never your documents." : view === "favorites" ? "A few good tools, right where you left them." : "Pick a tool. We’ll take care of the PDF part."}</p></div><div className="search-field"><Search size={17}/><input ref={searchInput} type="search" aria-label={view === "history" ? "Search recent files" : "Search PDF tools"} placeholder={view === "history" ? "Search your files…" : "Search for a tool…"} value={search} onChange={(event) => setSearch(event.target.value)}/>{search ? <button className="clear-search" onClick={() => setSearch("")} aria-label="Clear search"><X size={14}/></button> : <kbd>⌘ K</kbd>}</div></div>
      {view !== "history" && <div className="filter-bar"><div className="filter-tabs" role="tablist" aria-label="Filter PDF tools" onKeyDown={(event) => { const keys = ["ArrowRight", "ArrowLeft", "Home", "End"]; if (!keys.includes(event.key)) return; event.preventDefault(); const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")); const current = buttons.indexOf(document.activeElement as HTMLButtonElement); const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length; buttons[next]?.focus(); buttons[next]?.click(); }}><button role="tab" tabIndex={category === "All tools" ? 0 : -1} aria-selected={category === "All tools"} className={category === "All tools" ? "active" : ""} onClick={() => setCategory("All tools")}><Grid2X2 size={15}/>All tools</button>{categories.map((item) => { const Icon = categoryIcons[item]; return <button role="tab" tabIndex={category === item ? 0 : -1} aria-selected={category === item} key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}><Icon size={15}/>{item}</button>; })}</div><span className="tool-count-label">{view === "favorites" ? "Made for your flow" : "Small tools. Big possibilities."}</span></div>}
      {view === "history" ? matchingHistory.length > 0 ? <div className="history-panel"><div className="history-table-heading"><span>DOCUMENT</span><span>TOOL</span><span>WHEN</span><span/></div>{matchingHistory.map((item) => { const tool = tools.find((entry) => entry.id === item.toolId); return <div className="history-row" key={item.id}>{tool && <div className="history-file"><ToolIcon tool={tool} size={20}/><div><strong>{item.fileName}</strong><span>{formatBytes(item.outputSize)} · {item.pageCount} {item.pageCount === 1 ? "page" : "pages"}</span></div></div>}<span className="history-tool">{tool?.name}</span><span className="history-date">{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span><button className="text-button" onClick={() => tool && openTool(tool)}>Use tool <ArrowUpRight size={14}/></button></div>; })}<div className="history-note"><ShieldCheck size={14}/><span>These are file details, not stored documents. Find your downloads in your browser’s download folder.</span><button onClick={() => setInfo("settings")}>Manage history <ArrowRight size={13}/></button></div></div> : <div className="empty-state"><div className="empty-illustration"><FileClock size={39}/><span><Plus size={16}/></span></div><h3>{search ? "No files by that name." : "A fresh page. A world of possibilities."}</h3><p>{search ? "Try searching for a different file name or tool." : "Your recently processed files will appear here. Let’s make a little PDF magic happen."}</p><button className="button primary" onClick={() => search ? setSearch("") : navigate("all")}>{search ? "Clear search" : "Explore the tools"}<ArrowRight size={16}/></button></div> : matchingTools.length > 0 ? <div className="tools-grid" aria-label="PDF tools">{matchingTools.map((tool) => <article key={tool.id} className={`tool-card ${tool.color}`}><button className="tool-card-main" onClick={() => openTool(tool)} aria-label={`Open ${tool.name}`}><div className="tool-card-top"><ToolIcon tool={tool}/>{tool.popular && <span className="popular-label">POPULAR</span>}</div><h3>{tool.name}<ArrowUpRight size={16}/></h3><p>{tool.description}</p></button><button className={`favorite-button ${favorites.includes(tool.id) ? "is-favorite" : ""}`} onClick={() => toggleFavorite(tool)} aria-label={`${favorites.includes(tool.id) ? "Remove" : "Add"} ${tool.name} ${favorites.includes(tool.id) ? "from" : "to"} favorites`} aria-pressed={favorites.includes(tool.id)} title={favorites.includes(tool.id) ? "Remove from favorites" : "Save to favorites"}><Star size={16} fill={favorites.includes(tool.id) ? "currentColor" : "none"} strokeWidth={1.6}/></button></article>)}</div> : <div className="empty-state"><div className="empty-illustration">{view === "favorites" && !search ? <Star size={38}/> : <Search size={38}/>}<span><Plus size={16}/></span></div><h3>{view === "favorites" && !favorites.length ? "Keep your favorites close." : "That one’s not in our toolbox. Yet."}</h3><p>{view === "favorites" && !favorites.length ? "Tap the little star on any tool to save it here. A simpler workflow starts with your go-tos." : "Try a different word or explore another collection. Your perfect tool is in here somewhere."}</p><button className="button primary" onClick={() => { setSearch(""); setCategory("All tools"); if (view === "favorites" && !favorites.length) navigate("all"); }}>{view === "favorites" && !favorites.length ? "Find your favorites" : "Show all tools"}<ArrowRight size={16}/></button></div>}
      </section>
      {view === "all" && <section className="privacy-banner"><div className="privacy-banner-icon"><ShieldCheck size={29} strokeWidth={1.5}/><span/></div><div><div className="privacy-banner-eyebrow">A LITTLE PEACE OF MIND, BUILT IN.</div><h3>Your files. Your business.</h3><p>Everything happens right in your browser. No uploads, no accounts, no worries.</p></div><button className="text-button" onClick={() => setInfo("privacy")}>Privacy, by design <ArrowUpRight size={16}/></button><div className="privacy-lines" aria-hidden="true"/></section>}
      <footer className="main-footer"><span>© 2026 paperly<span className="footer-dot">.</span> <span className="footer-tagline">A little less paperwork. A little more life.</span></span><nav aria-label="Footer"><button onClick={() => setInfo("privacy")}>Privacy</button><button onClick={() => setInfo("terms")}>Terms</button><button onClick={() => setInfo("help")}>Need a hand? <ArrowUpRight size={12}/></button></nav></footer>
    </main></div>
    {selectedTool && <ToolDialog key={selectedTool.id} tool={selectedTool} onClose={() => setSelectedTool(null)} onComplete={saveHistory}/>}
    {info && <InfoDialog key={info} type={info} onClose={() => setInfo(null)} workspaceName={workspaceName} onSaveName={saveName} onClearHistory={clearHistory} hasHistory={history.length > 0} notify={notify} installed={installed}/>}
    {toast && <div className="toast" role="status"><CheckCircle2 size={18}/><span>{toast}</span><button onClick={() => setToast("")} aria-label="Dismiss notification"><X size={15}/></button></div>}
  </div>;
}
