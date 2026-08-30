import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Check, ChevronDown, Clipboard, Cpu, Database, Flame, Gauge, HardDrive, Monitor, Package, Plus, RotateCcw, Save, Search, ShieldCheck, ShoppingCart, Sparkles, Trash2, X, Zap } from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { catalog, categories, formatPKR, getPart, type Category, type Part, type Platform } from '@/data/catalog';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const coreCategories: Category[] = ['CPU', 'Motherboard', 'GPU', 'RAM', 'Storage', 'PSU', 'Case', 'Cooler'];
const iconFor: Record<Category, typeof Cpu> = { CPU: Cpu, Motherboard: Package, GPU: Gauge, RAM: Database, Storage: HardDrive, PSU: Zap, Case: Package, Cooler: Flame, Monitor, Accessories: ShoppingCart };
type Selected = Partial<Record<Category, string>>;
type Quantities = Partial<Record<Category, number>>;

const memoryTypesIn = (spec?: string): string[] => spec?.match(/DDR[2345]/g) ?? [];

function getCompatibilityWarnings(cpu?: Part, board?: Part, ram?: Part, psu?: Part, estimatedDraw = 0) {
  const socketOkay = !cpu || !board || cpu.socket === board.socket;
  const boardMemoryTypes = memoryTypesIn(board?.spec);
  const memoryOkay = !board || !ram || !boardMemoryTypes.length || boardMemoryTypes.includes(ram.memory ?? '');
  const powerOkay = !psu || estimatedDraw === 0 || (psu.watts ?? 0) >= estimatedDraw * 1.25;
  return [
    !socketOkay && `${cpu?.name} uses ${cpu?.socket}, but ${board?.name} uses ${board?.socket}. Choose a matching socket.`,
    !memoryOkay && `${ram?.name} is ${ram?.memory}, but ${board?.name} expects ${boardMemoryTypes.join(' or ')}. Choose matching memory.`,
    !powerOkay && `${psu?.name} is ${psu?.watts}W, but this build needs about ${Math.ceil(estimatedDraw * 1.25)}W with headroom.`,
  ].filter(Boolean) as string[];
}

function Home() {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<Exclude<Platform, 'Universal'>>('AMD');
  const [activeCategory, setActiveCategory] = useState<Category>('CPU');
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('All brands');
  const [selected, setSelected] = useState<Selected>({});
  const [quantities, setQuantities] = useState<Quantities>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('pakbuild-current');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { platform?: Exclude<Platform, 'Universal'>; selected?: Selected; quantities?: Quantities };
        if (parsed.platform && parsed.selected) {
          setPlatform(parsed.platform); setSelected(parsed.selected); setQuantities(parsed.quantities ?? {});
          setSavedAt('Restored from this device');
        }
      } catch { /* ignore corrupt local data */ }
    }
  }, []);

  const currentParts = useMemo(() => Object.values(selected).map(getPart).filter(Boolean) as Part[], [selected]);
  const total = currentParts.reduce((sum, part) => sum + part.price * (quantities[part.category] ?? 1), 0);
  const baseTotal = currentParts.filter((part) => !['Monitor', 'Accessories'].includes(part.category)).reduce((sum, part) => sum + part.price, 0);
  const selectedCpu = getPart(selected.CPU);
  const selectedBoard = getPart(selected.Motherboard);
  const selectedGpu = getPart(selected.GPU);
  const selectedRam = getPart(selected.RAM);
  const selectedPsu = getPart(selected.PSU);
  const estimatedDraw = (selectedCpu || selectedGpu) ? (selectedCpu?.watts ?? 0) + (selectedGpu?.watts ?? 0) + 110 : 0;
  const compatibilityWarnings = getCompatibilityWarnings(selectedCpu, selectedBoard, selectedRam, selectedPsu, estimatedDraw);
  const brands = useMemo(() => ['All brands', ...Array.from(new Set(catalog.filter((part) => part.category === activeCategory).map((part) => part.brand)))], [activeCategory]);
  const visibleParts = useMemo(() => catalog.filter((part) => {
    const platformMatches = part.platform === 'Universal' || part.platform === platform;
    const categoryMatches = part.category === activeCategory;
    const searchMatches = `${part.name} ${part.brand} ${part.spec} ${part.generation ?? ''} ${part.detail}`.toLowerCase().includes(search.toLowerCase());
    const brandMatches = brand === 'All brands' || part.brand === brand;
    return platformMatches && categoryMatches && searchMatches && brandMatches;
  }).sort((first, second) => first.price - second.price), [activeCategory, brand, platform, search]);

  const switchPlatform = (nextPlatform: Exclude<Platform, 'Universal'>) => {
    setPlatform(nextPlatform);
  };
  const selectPart = (part: Part) => {
    setSelected((current) => ({ ...current, [part.category]: part.id }));
    toast({ title: `${part.category} added`, description: `${part.name} is now in your build.` });
  };
  const removePart = (category: Category) => {
    setSelected((current) => { const next = { ...current }; delete next[category]; return next; });
  };
  const saveBuild = () => {
    localStorage.setItem('pakbuild-current', JSON.stringify({ platform, selected, quantities }));
    setSavedAt('Saved just now');
    toast({ title: 'Build saved locally', description: 'Your parts are stored on this device.' });
  };
  const loadBuild = () => {
    const stored = localStorage.getItem('pakbuild-current');
    if (!stored) { toast({ title: 'No saved build yet', description: 'Save this build first to load it later.' }); return; }
    try {
      const parsed = JSON.parse(stored);
      setPlatform(parsed.platform); setSelected(parsed.selected); setQuantities(parsed.quantities ?? {});
      setSavedAt('Loaded just now'); toast({ title: 'Build loaded', description: 'Your saved parts are back on the bench.' });
    } catch { toast({ title: 'Could not load build', description: 'The saved build appears to be invalid.' }); }
  };
  const resetBuild = () => {
    setPlatform('AMD'); setSelected({}); setQuantities({}); setSavedAt(null); setSearch(''); setBrand('All brands');
    toast({ title: 'Bench reset', description: 'Start with any part you want.' });
  };
  const copySummary = async () => {
    const lines = currentParts.map((part) => `${part.category}: ${part.name} — ${formatPKR(part.price * (quantities[part.category] ?? 1))}`);
    const summary = `PakBuild manual build · ${platform}\n${lines.join('\n')}\nTotal: ${formatPKR(total)}\nPrices are estimates; verify with Pakistani retailers.`;
    try { await navigator.clipboard.writeText(summary); toast({ title: 'Summary copied', description: 'Paste it into a message or retailer chat.' }); } catch { toast({ title: 'Copy unavailable', description: 'Select and copy the summary manually.' }); }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <CompatibilityPopup warnings={compatibilityWarnings} />
      <header className="border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[3px_3px_0_hsl(215_35%_13%)]"><Cpu size={21} strokeWidth={2.5} /></div>
            <div><p className="text-[17px] font-bold tracking-tight">PakBuild</p><p className="mono text-[9px] uppercase tracking-[.22em] text-muted-foreground">PC price desk · PK</p></div>
          </div>
          <div className="hidden items-center gap-2 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /><span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Local catalog · PKR estimates · verify before checkout</span></div>
          <button data-testid="button-reset-top" onClick={resetBuild} className="pressable flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"><RotateCcw size={14} /> Reset</button>
        </div>
      </header>

      <main className="grid-paper mx-auto max-w-[1440px] px-4 pb-12 sm:px-7">
        <section className="rise-in grid gap-7 py-8 sm:py-11 lg:grid-cols-[1fr_330px] lg:items-end">
          <div>
            <div className="mb-4 flex items-center gap-2"><span className="rounded-full bg-accent px-3 py-1 mono text-[10px] font-medium uppercase tracking-widest text-accent-foreground">Street-price logic</span><span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">Built for Pakistan</span></div>
            <h1 className="max-w-3xl text-4xl font-bold leading-[.98] tracking-[-.055em] sm:text-6xl">Price the build.<br /><span className="text-accent">Skip the guesswork.</span></h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">A fast, honest way to spec a desktop with the parts actually found in Pakistan. Choose every part yourself, check the fit, and take a clean quote to your retailer.</p>
          </div>
          <div className="border-l-2 border-primary pl-5 lg:mb-1"><p className="mono text-[10px] uppercase tracking-[.18em] text-muted-foreground">Current estimate</p><p data-testid="text-hero-total" className="mt-2 text-3xl font-bold tracking-tight">{formatPKR(total)}</p><p className="mt-1 text-xs text-muted-foreground">{currentParts.length} of 10 slots filled · excluding delivery</p></div>
        </section>

        <section className="rise-in-delay rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-sm)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><p className="mono text-[10px] uppercase tracking-[.17em] text-muted-foreground">01 / Start from zero</p><h2 className="mt-1 text-lg font-bold">Build it your way</h2><p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">No budget presets or recommended builds. Choose every part yourself, from any price band, and use the fit check to stay in control.</p></div>
            <div className="flex shrink-0 rounded-lg bg-muted p-1" role="group" aria-label="Filter processor platform"><button data-testid="button-platform-intel" onClick={() => switchPlatform('Intel')} className={`rounded-md px-4 py-2 text-xs font-bold transition ${platform === 'Intel' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>Intel</button><button data-testid="button-platform-amd" onClick={() => switchPlatform('AMD')} className={`rounded-md px-4 py-2 text-xs font-bold transition ${platform === 'AMD' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>AMD</button></div>
          </div>
        </section>

        <div className="lg:hidden"><CompatibilityCard cpu={selectedCpu} board={selectedBoard} ram={selectedRam} psu={selectedPsu} gpu={selectedGpu} estimatedDraw={estimatedDraw} /></div>

        <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_365px]">
          <section className="min-w-0">
            <div className="mb-4 flex items-end justify-between gap-3"><div><p className="mono text-[10px] uppercase tracking-[.17em] text-muted-foreground">02 / Choose components</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Build your parts list</h2></div><span className="mono hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:block">{catalog.length} listings · lowest to highest</span></div>
            <div className="scrollbar-none mb-3 flex gap-1 overflow-x-auto border-b border-border pb-0">{categories.map((item) => { const Icon = iconFor[item.id]; const picked = selected[item.id]; return <button data-testid={`tab-category-${item.id.toLowerCase()}`} key={item.id} onClick={() => { setActiveCategory(item.id); setBrand('All brands'); setSearch(''); }} className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-semibold transition ${activeCategory === item.id ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><Icon size={14} />{item.short}{picked && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}</button>; })}</div>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><input data-testid="input-search-parts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${activeCategory.toLowerCase()}...`} className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" /></label><label className="relative sm:w-44"><select data-testid="select-brand-filter" value={brand} onChange={(event) => setBrand(event.target.value)} className="h-10 w-full appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-xs font-semibold outline-none focus:border-primary">{brands.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" /></label></div>
            {visibleParts.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center"><Package className="mx-auto text-muted-foreground" size={28} /><p className="mt-3 font-semibold">No matching parts</p><p className="mt-1 text-xs text-muted-foreground">Try another brand, search term, or price band.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{visibleParts.map((part) => { const isSelected = selected[part.category] === part.id; return <PartCard key={part.id} part={part} selected={isSelected} onSelect={() => selectPart(part)} />; })}</div>}
            <div className="mt-5 rounded-xl border border-border bg-secondary p-4 text-secondary-foreground"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-primary" size={18} /><div><p className="text-sm font-bold">Compatibility is checked as you build</p><p className="mt-1 text-xs leading-5 text-secondary-foreground/70">We match CPU sockets to boards, watch estimated power draw, and flag memory platform fit. Always confirm BIOS support, case clearance, and retailer warranty before paying.</p></div></div></div>
          </section>

          <aside className="lg:sticky lg:top-5">
            <div className="overflow-hidden rounded-2xl border border-secondary bg-secondary text-secondary-foreground shadow-[var(--shadow-md)]">
              <div className="flex items-start justify-between border-b border-secondary-foreground/15 p-5"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-primary">03 / Your quote</p><h2 className="mt-1 text-xl font-bold">The build desk</h2></div><div className="rounded-lg bg-primary p-2 text-primary-foreground"><ShoppingCart size={17} /></div></div>
              <div className="p-5"><div className="mb-5 flex items-end justify-between"><div><p className="mono text-[10px] uppercase tracking-widest text-secondary-foreground/55">{platform} · manual build</p><p data-testid="text-build-total" className="mt-1 text-[30px] font-bold tracking-[-.04em] text-primary">{formatPKR(total)}</p></div><p className="mono text-right text-[10px] leading-4 text-secondary-foreground/55">EST. TOTAL<br />PKR</p></div>
                <div className="space-y-1.5">{categories.map((item) => { const part = getPart(selected[item.id]); const qty = quantities[item.id] ?? 1; return <BuildLine key={item.id} category={item.id} part={part} quantity={qty} onRemove={() => removePart(item.id)} onQuantity={(delta) => setQuantities((current) => ({ ...current, [item.id]: Math.max(1, Math.min(3, (current[item.id] ?? 1) + delta)) }))} />; })}</div>
                <div className="my-5 border-t border-secondary-foreground/15 pt-4"><div className="flex justify-between text-xs text-secondary-foreground/60"><span>Core system</span><span>{formatPKR(baseTotal)}</span></div><div className="mt-2 flex justify-between text-xs text-secondary-foreground/60"><span>Estimate headroom</span><span>{formatPKR(Math.max(0, total - baseTotal))}</span></div></div>
                <div className="grid grid-cols-2 gap-2"><button data-testid="button-save-build" onClick={saveBuild} className="pressable flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-xs font-bold text-primary-foreground"><Save size={14} /> Save build</button><button data-testid="button-load-build" onClick={loadBuild} className="pressable flex items-center justify-center gap-2 rounded-lg border border-secondary-foreground/20 py-3 text-xs font-bold hover:bg-secondary-foreground/10"><RotateCcw size={14} /> Load saved</button></div>
                <button data-testid="button-copy-summary" onClick={copySummary} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold text-secondary-foreground/70 transition hover:bg-secondary-foreground/10 hover:text-secondary-foreground"><Clipboard size={14} /> Copy build summary</button>
                {savedAt && <p data-testid="status-saved-build" className="mt-2 text-center mono text-[9px] uppercase tracking-wider text-primary">{savedAt}</p>}
              </div>
            </div>
             <div className="hidden lg:block"><CompatibilityCard cpu={selectedCpu} board={selectedBoard} ram={selectedRam} psu={selectedPsu} gpu={selectedGpu} estimatedDraw={estimatedDraw} /></div>
            <CatalogSnapshot baseTotal={baseTotal} />
          </aside>
        </div>
        <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-border pt-5 text-xs text-muted-foreground sm:flex-row"><p className="flex items-center gap-2"><Sparkles size={14} className="text-accent" /> PakBuild uses local sample listings to keep estimates grounded.</p><p className="max-w-xl text-left sm:text-right">Prices are approximate street estimates in PKR, not live quotes. Verify stock, tax, exchange-rate movement, and warranty with retailers in your city.</p></footer>
      </main>
    </div>
  );
}

function PartCard({ part, selected, onSelect }: { part: Part; selected: boolean; onSelect: () => void }) {
  return <article data-testid={`card-part-${part.id}`} className={`pressable group relative overflow-hidden rounded-xl border bg-card p-4 ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}><div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: part.accent }} /><div className="flex items-start justify-between gap-3 pl-2"><div><p className="mono text-[10px] uppercase tracking-wider text-muted-foreground">{part.brand} · {part.generation ?? part.tier}</p><h3 data-testid={`text-part-name-${part.id}`} className="mt-1 text-sm font-bold leading-5">{part.name}</h3></div>{selected ? <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check size={15} /></span> : <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition group-hover:border-primary group-hover:text-primary"><Plus size={15} /></span>}</div><div className="mt-4 flex items-end justify-between gap-2 pl-2"><div><p data-testid={`text-price-${part.id}`} className="mono text-sm font-medium">{formatPKR(part.price)}</p><p className="mt-1 text-[11px] text-muted-foreground">{part.spec}</p></div><button data-testid={`button-select-${part.id}`} onClick={onSelect} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${selected ? 'bg-primary/20 text-foreground' : 'bg-muted hover:bg-primary hover:text-primary-foreground'}`}>{selected ? 'Selected' : 'Add part'}</button></div></article>;
}

function BuildLine({ category, part, quantity, onRemove, onQuantity }: { category: Category; part?: Part; quantity: number; onRemove: () => void; onQuantity: (delta: number) => void }) {
  return <div data-testid={`row-build-${category.toLowerCase()}`} className="group flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-secondary-foreground/8">{part ? <><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary-foreground/10 text-primary">{(() => { const Icon = iconFor[category]; return <Icon size={13} />; })()}</div><div className="min-w-0 flex-1"><p className="mono text-[9px] uppercase tracking-wider text-secondary-foreground/50">{category}</p><p className="truncate text-xs font-semibold">{part.name}</p></div>{['Monitor', 'Accessories'].includes(category) && <div className="flex items-center rounded-md border border-secondary-foreground/15"><button data-testid={`button-decrease-${category.toLowerCase()}`} onClick={() => onQuantity(-1)} className="px-1.5 py-1 text-xs text-secondary-foreground/60 hover:text-primary">−</button><span className="mono px-1 text-[10px]">{quantity}</span><button data-testid={`button-increase-${category.toLowerCase()}`} onClick={() => onQuantity(1)} className="px-1.5 py-1 text-xs text-secondary-foreground/60 hover:text-primary">+</button></div>}<p className="mono hidden text-[10px] text-secondary-foreground/70 sm:block">{formatPKR(part.price * quantity)}</p><button data-testid={`button-remove-${category.toLowerCase()}`} onClick={onRemove} aria-label={`Remove ${category}`} className="p-1 text-secondary-foreground/35 opacity-0 transition hover:text-accent group-hover:opacity-100"><Trash2 size={13} /></button></> : <><div className="flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-secondary-foreground/20 text-secondary-foreground/40"><Plus size={13} /></div><p className="flex-1 text-xs text-secondary-foreground/45">{category}</p><span className="mono text-[9px] uppercase tracking-widest text-secondary-foreground/35">open</span></>}</div>;
}

function CompatibilityPopup({ warnings }: { warnings: string[] }) {
  const warningKey = warnings.join('|');
  const [dismissedKey, setDismissedKey] = useState('');
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'closing'>('hidden');

  useEffect(() => {
    if (!warningKey) {
      setDismissedKey('');
      setPhase('hidden');
    } else if (warningKey !== dismissedKey) {
      setPhase('visible');
    }
  }, [dismissedKey, warningKey]);

  if (phase === 'hidden' || warnings.length === 0) return null;
  return <div data-testid="compatibility-popup" role="alert" className={`fit-warning-popup ${phase === 'closing' ? 'fit-warning-popup-closing' : ''}`} onAnimationEnd={() => setPhase((current) => current === 'closing' ? 'hidden' : current)}>
    <div className="flex min-w-0 items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground"><AlertTriangle size={18} /></div>
      <div className="min-w-0 flex-1">
        <p className="mono text-[10px] font-medium uppercase tracking-[.16em] text-accent">Compatibility warning</p>
        <p className="mt-1 text-sm font-bold">Parts need attention</p>
        <ul className="mt-1 space-y-1 text-xs leading-5 text-muted-foreground">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
      </div>
      <button data-testid="button-close-compatibility-popup" aria-label="Close compatibility warning" onClick={() => { setDismissedKey(warningKey); setPhase('closing'); }} className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X size={17} /></button>
    </div>
  </div>;
}

function CompatibilityCard({ cpu, board, ram, psu, gpu, estimatedDraw }: { cpu?: Part; board?: Part; ram?: Part; psu?: Part; gpu?: Part; estimatedDraw: number }) {
  const socketOkay = !cpu || !board || cpu.socket === board.socket;
  const boardMemoryTypes = memoryTypesIn(board?.spec);
  const boardMemory = boardMemoryTypes.join('/');
  const memoryOkay = !board || !ram || !boardMemoryTypes.length || boardMemoryTypes.includes(ram.memory ?? '');
  const powerOkay = !psu || estimatedDraw === 0 || (psu.watts ?? 0) >= estimatedDraw * 1.25;
  const warnings = [
    !socketOkay && `${cpu?.name} uses ${cpu?.socket}, but ${board?.name} uses ${board?.socket}. Choose a matching socket.`,
    !memoryOkay && `${ram?.name} is ${ram?.memory}, but ${board?.name} expects ${boardMemory}. Choose matching memory.`,
    !powerOkay && `${psu?.name} is ${psu?.watts}W, but this build needs about ${Math.ceil(estimatedDraw * 1.25)}W with headroom.`,
  ].filter(Boolean) as string[];
  const checksOkay = socketOkay && memoryOkay && powerOkay;
  return <div className="mt-4 rounded-xl border border-border bg-card p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Fit check</h3><span className={`rounded-full px-2 py-1 mono text-[9px] uppercase tracking-wider ${checksOkay ? 'bg-primary/20 text-foreground' : 'bg-accent/15 text-accent'}`}>{checksOkay ? 'Looking good' : 'Review needed'}</span></div>{warnings.length > 0 && <div data-testid="status-compatibility-warning" role="alert" className="mb-4 rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs leading-5 text-accent"><div className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" /><div><p className="font-bold">Parts need attention</p><ul className="mt-1 list-disc space-y-1 pl-4">{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div></div></div>}<div className="space-y-2.5 text-xs"><div className="flex items-center justify-between"><span className="text-muted-foreground">Socket match</span><span data-testid="status-socket" className="flex items-center gap-1 font-semibold">{socketOkay ? <Check size={13} className="text-primary" /> : <AlertTriangle size={13} className="text-accent" />}{cpu && board ? `${cpu.socket} / ${board.socket}` : 'Choose CPU + board'}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Memory match</span><span data-testid="status-memory" className="flex items-center gap-1 font-semibold">{memoryOkay ? <Check size={13} className="text-primary" /> : <AlertTriangle size={13} className="text-accent" />}{ram && board ? `${ram.memory} / ${boardMemory ?? 'unknown'}` : 'Choose RAM + board'}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Estimated draw</span><span data-testid="text-estimated-draw" className="mono">{estimatedDraw ? `${estimatedDraw}W` : 'Waiting for CPU + GPU'} <span className="text-muted-foreground">{estimatedDraw ? '+ margin' : ''}</span></span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">PSU headroom</span><span data-testid="status-power" className="flex items-center gap-1 font-semibold">{powerOkay ? <Check size={13} className="text-primary" /> : <AlertTriangle size={13} className="text-accent" />}{psu ? `${psu.watts}W selected` : 'Choose a PSU'}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">Graphics</span><span className="font-semibold">{gpu?.spec.split('·')[0] ?? 'Waiting for GPU'}</span></div></div></div>;
}

function CatalogSnapshot({ baseTotal }: { baseTotal: number }) {
  const snapshotParts = catalog.filter((part) => ['CPU', 'GPU', 'RAM'].includes(part.category));
  const average = snapshotParts.length ? Math.round(snapshotParts.reduce((sum, part) => sum + part.price, 0) / snapshotParts.length) : 0;
  return <div className="mt-4 rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between"><div><p className="mono text-[9px] uppercase tracking-widest text-muted-foreground">Catalog snapshot</p><h3 className="mt-1 text-sm font-bold">Across every price band</h3></div><Gauge size={17} className="text-accent" /></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-muted p-3"><p className="mono text-[9px] text-muted-foreground">CPU/GPU/RAM avg.</p><p data-testid="text-market-average" className="mt-1 text-sm font-bold">{formatPKR(average)}</p></div><div className="rounded-lg bg-muted p-3"><p className="mono text-[9px] text-muted-foreground">Your core</p><p data-testid="text-market-core" className="mt-1 text-sm font-bold">{formatPKR(baseTotal)}</p></div></div><p className="mt-3 text-[11px] leading-4 text-muted-foreground">You are choosing from {catalog.length} sample listings without budget-based recommendations.</p></div>;
}

function Router() {
  return <Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey={window.location.pathname}><Router /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;