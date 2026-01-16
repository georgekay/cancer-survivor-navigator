"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
// IMPORTANT:
// - If your Supabase client lives at "@/supabase" instead, change the import below.
import { supabase } from "@/lib/supabase";

type Lang = "en" | "es";

type CountyRow = {
  county_name: string;
  region_name: string;
};

type PlaybookRow = {
  playbook_id: string;
  category: "bills_coverage" | "meds" | "transport";
  issue_key: string;
  urgency_level: "urgent" | "soon" | "planning";
  title_en: string;
  title_es: string;
  summary_en: string;
  summary_es: string;
  created_at: string;
};

type StepRow = {
  step_id: string;
  playbook_id: string;
  step_order: number;
  title_en: string;
  title_es: string;
  body_en: string;
  body_es: string;
  action_type: string | null;
  action_label_en: string | null;
  action_label_es: string | null;
  action_url: string | null;
  created_at: string;
};

type ResourceMatch = {
  resource_id: string;
  category: string;
  title: string;
  organization: string | null;
  description_en: string | null;
  description_es: string | null;
  phone: string | null;
  website_url: string | null;
  languages: string | null;
  eligibility: string | null;
  access_notes: string | null;
  hours: string | null;
  cost: string | null;
  last_verified: string | null;
  source_url: string | null;
  match_rank: number;
  link_strength?: number;
};

const TX_REGIONS = [
  "Houston Metro",
  "DFW",
  "Austin",
  "San Antonio",
  "El Paso",
  "Rio Grande Valley",
  "Coastal Bend",
  "West Texas",
  "Panhandle",
  "Other/Unknown",
] as const;

type TxRegion = (typeof TX_REGIONS)[number];

type CategoryKey = "bills_coverage" | "meds" | "transport";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizePhoneForTel(phone: string): string | null {
  const cleaned = phone.trim().replace(/(?!^\+)[^0-9]/g, "");
  if (!cleaned) return null;
  const digitCount = cleaned.replace(/\D/g, "").length;
  if (digitCount < 3) return null;
  return cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;
}

function rankPill(rank: number, lang: Lang) {
  // In our DB: 3=county, 2=region, 1=statewide
  if (rank >= 3) return lang === "es" ? "Cerca (condado)" : "Near you (county)";
  if (rank === 2) return lang === "es" ? "Su región" : "Your region";
  return lang === "es" ? "Estatal" : "Statewide";
}

const I18N = {
  en: {
    appTitle: "Texas Cancer Survivor Navigator",
    appSubtitle:
      "Find real, actionable help in Texas for bills, medications, and transportation—tailored to your county/region and your situation.",
    language: "Language",
    english: "English",
    spanish: "Español",
    whereYouAre: "Where are you in Texas?",
    countyLabel: "County",
    countyPlaceholder: "Start typing your county…",
    regionLabel: "Region (helps us prioritize local resources)",
    regionAuto: "Pick from list",
    regionOther: "Other",
    regionUnknown: "Other/Unknown",
    categoryLabel: "What do you need help with?",
    categories: {
      bills_coverage: "Bills & coverage",
      meds: "Medications",
      transport: "Transportation",
    } as Record<CategoryKey, string>,
    situationLabel: "What best matches your situation?",
    situationHint:
      "Pick one for step-by-step guidance. If you’re not sure, you can skip and just browse resources.",
    browseOnly: "Skip (show resources)",
    showResults: "Find resources",
    updating: "Searching…",
    noResults:
      "No matches found for this county/region yet. We’ll show statewide resources and a deep local search option.",
    deepSearchTitle: "Deep local search (Texas)",
    deepSearchBody:
      "If you need more local options (county programs, nonprofits, church funds, transportation vouchers), 2-1-1 Texas can locate programs near you and tell you exactly what documents you’ll need.",
    call211: "Call 2-1-1 Texas",
    open211: "Open 2-1-1 Texas",
    nextStepsTitle: "Next steps",
    resourcesTitle: "Resources",
    verified: "Last verified",
    sources: "Source",
    disclaimer:
      "This tool is for navigation and information only. For emergencies, call 911. Program eligibility and availability can change—always confirm details with the program.",
    buildMore: "Build a guided plan",
    filters: {
      label: "Filter",
      all: "All",
      county: "County",
      region: "Region",
      statewide: "Statewide",
      search: "Search resources…",
    },
  },
  es: {
    appTitle: "Navegador para Sobrevivientes de Cáncer en Texas",
    appSubtitle:
      "Encuentre ayuda real y accionable en Texas para facturas, medicamentos y transporte—según su condado/región y su situación.",
    language: "Idioma",
    english: "English",
    spanish: "Español",
    whereYouAre: "¿Dónde está en Texas?",
    countyLabel: "Condado",
    countyPlaceholder: "Empiece a escribir su condado…",
    regionLabel: "Región (ayuda a priorizar recursos locales)",
    regionAuto: "Elegir de lista",
    regionOther: "Otro",
    regionUnknown: "Other/Unknown",
    categoryLabel: "¿En qué necesita ayuda?",
    categories: {
      bills_coverage: "Facturas y cobertura",
      meds: "Medicamentos",
      transport: "Transporte",
    } as Record<CategoryKey, string>,
    situationLabel: "¿Qué describe mejor su situación?",
    situationHint:
      "Elija una opción para ver pasos guiados. Si no está seguro, puede omitir y ver recursos.",
    browseOnly: "Omitir (mostrar recursos)",
    showResults: "Buscar recursos",
    updating: "Buscando…",
    noResults:
      "No encontramos coincidencias para este condado/región. Mostraremos recursos estatales y una opción de búsqueda local.",
    deepSearchTitle: "Búsqueda local profunda (Texas)",
    deepSearchBody:
      "Si necesita más opciones locales (programas del condado, organizaciones sin fines de lucro, fondos de iglesias, vales de transporte), 2-1-1 Texas puede encontrar programas cerca de usted e indicarle qué documentos necesita.",
    call211: "Llamar a 2-1-1 Texas",
    open211: "Abrir 2-1-1 Texas",
    nextStepsTitle: "Próximos pasos",
    resourcesTitle: "Recursos",
    verified: "Última verificación",
    sources: "Fuente",
    disclaimer:
      "Esta herramienta es solo para navegación e información. En emergencias, llame al 911. La elegibilidad y disponibilidad pueden cambiar—confirme siempre con el programa.",
    buildMore: "Crear un plan guiado",
    filters: {
      label: "Filtrar",
      all: "Todo",
      county: "Condado",
      region: "Región",
      statewide: "Estatal",
      search: "Buscar recursos…",
    },
  },
} as const;

export default function Page() {
  const [lang, setLang] = useState<Lang>("en");
  const t = I18N[lang];

  // Location
  const [counties, setCounties] = useState<CountyRow[]>([]);
  const [countyMode, setCountyMode] = useState<"pick" | "other">("pick");
  const [selectedCounty, setSelectedCounty] = useState<string>("");
  const [otherCounty, setOtherCounty] = useState<string>("");
  const [region, setRegion] = useState<TxRegion>("Other/Unknown");

  // Intent
  const [category, setCategory] = useState<CategoryKey>("bills_coverage");
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);

  // Results
  const [resources, setResources] = useState<ResourceMatch[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<string>("");

  // UI filters
  const [rankFilter, setRankFilter] = useState<"all" | 3 | 2 | 1>("all");
  const [textFilter, setTextFilter] = useState<string>("");

  const countyEffective = useMemo(() => {
    const c = countyMode === "pick" ? selectedCounty : otherCounty;
    return c.trim();
  }, [countyMode, selectedCounty, otherCounty]);

  const regionEffective = useMemo(() => {
    if (countyMode === "pick") {
      const found = counties.find((x) => x.county_name === selectedCounty);
      return found?.region_name ?? "";
    }
    return region === "Other/Unknown" ? "" : region;
  }, [countyMode, counties, selectedCounty, region]);

  const categoryLabel = t.categories[category];

  // Load counties
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("counties")
        .select("county_name, region_name")
        .order("county_name", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error(error);
        setNotice("Could not load counties.");
        return;
      }
      const rows = (data as CountyRow[]) ?? [];
      setCounties(rows);
      if (rows.length > 0) setSelectedCounty(rows[0].county_name);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load playbooks for selected category
  useEffect(() => {
    let cancelled = false;
    setSelectedPlaybookId(null);
    setSteps([]);

    (async () => {
      const { data, error } = await supabase
        .from("issue_playbooks")
        .select("*")
        .eq("category", category)
        .order("urgency_level", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error(error);
        setPlaybooks([]);
        return;
      }
      setPlaybooks((data as PlaybookRow[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [category]);

  // Load steps when playbook changes
  useEffect(() => {
    let cancelled = false;
    setSteps([]);

    if (!selectedPlaybookId) return;

    (async () => {
      const { data, error } = await supabase
        .from("issue_steps")
        .select("*")
        .eq("playbook_id", selectedPlaybookId)
        .order("step_order", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }
      setSteps((data as StepRow[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlaybookId]);

  async function runSearch() {
    setLoading(true);
    setNotice("");
    setResources([]);

    try {
      const payloadBase = {
        p_category: category,
        p_county: countyEffective || null,
        p_region: regionEffective || null,
      };

      // 1) If playbook selected, prefer issue-ranked resources
      if (selectedPlaybookId) {
        const { data, error } = await supabase.rpc("match_issue_resources", {
          ...payloadBase,
          p_playbook_id: selectedPlaybookId,
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          setResources(data as ResourceMatch[]);
          return;
        }
      }

      // 2) Fallback: category + location matching (includes general resources)
      const { data, error } = await supabase.rpc("match_resources", payloadBase);
      if (error) throw error;

      if (!Array.isArray(data) || data.length === 0) {
        setNotice(t.noResults);
        setResources([]);
        return;
      }

      setResources(data as ResourceMatch[]);
    } catch (e) {
      console.error(e);
      setNotice("Search failed. Check your Supabase connection and SQL functions.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-search after selections change (lightweight):
  // - triggers once initial county loads
  // - triggers on category / playbook / county change
  const autoSearchKey = useMemo(() => {
    return `${category}::${countyEffective}::${regionEffective}::${selectedPlaybookId ?? "none"}`;
  }, [category, countyEffective, regionEffective, selectedPlaybookId]);

  useEffect(() => {
    // Don’t run until we have some location context.
    if (!countyEffective && !regionEffective) return;
    // Debounce a bit to avoid hammering while user clicks.
    const tmr = setTimeout(() => {
      runSearch();
    }, 250);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearchKey]);

  const heroBadge = useMemo(() => {
    const where = countyEffective
      ? `${countyEffective}${regionEffective ? ` • ${regionEffective}` : ""}`
      : regionEffective
        ? regionEffective
        : "Texas";
    return `${categoryLabel} • ${where}`;
  }, [countyEffective, regionEffective, categoryLabel]);

  const filteredResources = useMemo(() => {
    const s = textFilter.trim().toLowerCase();
    return resources.filter((r) => {
      const byRank = rankFilter === "all" ? true : r.match_rank === rankFilter;
      const blob = `${r.title ?? ""} ${r.organization ?? ""} ${r.languages ?? ""} ${r.description_en ?? ""} ${r.description_es ?? ""}`
        .toLowerCase();
      const byText = !s ? true : blob.includes(s);
      return byRank && byText;
    });
  }, [resources, rankFilter, textFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t.appTitle}</h1>
              <p className="mt-2 max-w-2xl text-slate-600">{t.appSubtitle}</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                <span>{heroBadge}</span>
              </div>
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-xs font-medium text-slate-700">{t.language}</label>
              <div className="mt-2 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  className={cx(
                    "rounded-lg px-3 py-2 text-sm",
                    lang === "en" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {t.english}
                </button>
                <button
                  type="button"
                  onClick={() => setLang("es")}
                  className={cx(
                    "rounded-lg px-3 py-2 text-sm",
                    lang === "es" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {t.spanish}
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Inputs */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">{t.whereYouAre}</h2>

              <div className="mt-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCountyMode("pick")}
                    className={cx(
                      "flex-1 rounded-xl border px-3 py-2 text-sm",
                      countyMode === "pick"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {t.regionAuto}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCountyMode("other")}
                    className={cx(
                      "flex-1 rounded-xl border px-3 py-2 text-sm",
                      countyMode === "other"
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {t.regionOther}
                  </button>
                </div>

                {countyMode === "pick" ? (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-800">{t.countyLabel}</label>
                    <select
                      value={selectedCounty}
                      onChange={(e) => setSelectedCounty(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-slate-400"
                    >
                      {counties.map((c) => (
                        <option key={c.county_name} value={c.county_name}>
                          {c.county_name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-xs text-slate-500">
                      {t.regionLabel}: <span className="font-medium">{regionEffective || "Texas"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-800">{t.countyLabel}</label>
                    <input
                      value={otherCounty}
                      onChange={(e) => setOtherCounty(e.target.value)}
                      placeholder={t.countyPlaceholder}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-slate-400"
                    />
                    <label className="mt-4 block text-sm font-medium text-slate-800">{t.regionLabel}</label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value as TxRegion)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-slate-400"
                    >
                      {TX_REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-xs text-slate-500">
                      If you’re not sure, choose “Other/Unknown” — we’ll prioritize statewide resources.
                    </div>
                  </div>
                )}
              </div>

              <hr className="my-6 border-slate-100" />

              <div>
                <label className="block text-sm font-medium text-slate-800">{t.categoryLabel}</label>
                <div className="mt-2 grid grid-cols-1 gap-2">
                  {(Object.keys(t.categories) as CategoryKey[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCategory(key)}
                      className={cx(
                        "rounded-xl border px-3 py-2 text-left text-sm",
                        category === key
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                      )}
                    >
                      {t.categories[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-800">{t.situationLabel}</label>
                    <p className="mt-1 text-xs text-slate-500">{t.situationHint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPlaybookId(null)}
                    className={cx(
                      "shrink-0 rounded-lg border px-2 py-1 text-xs",
                      !selectedPlaybookId
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    {t.browseOnly}
                  </button>
                </div>

                <div className="mt-3 grid gap-2">
                  {playbooks.map((p) => {
                    const title = lang === "en" ? p.title_en : p.title_es;
                    const summary = lang === "en" ? p.summary_en : p.summary_es;
                    const selected = selectedPlaybookId === p.playbook_id;
                    return (
                      <button
                        key={p.playbook_id}
                        type="button"
                        onClick={() => setSelectedPlaybookId(p.playbook_id)}
                        className={cx(
                          "rounded-2xl border p-3 text-left",
                          selected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold leading-snug">{title}</div>
                          <span
                            className={cx(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              selected
                                ? "bg-white/15 text-white"
                                : p.urgency_level === "urgent"
                                  ? "bg-rose-50 text-rose-700"
                                  : p.urgency_level === "soon"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-emerald-50 text-emerald-700",
                            )}
                          >
                            {p.urgency_level}
                          </span>
                        </div>
                        <div className={cx("mt-1 text-xs", selected ? "text-white/80" : "text-slate-600")}>
                          {summary}
                        </div>
                      </button>
                    );
                  })}

                  {playbooks.length === 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                      No playbooks found for this category yet.
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={runSearch}
                disabled={loading}
                className={cx(
                  "mt-6 w-full rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm",
                  loading ? "bg-slate-200 text-slate-600" : "bg-slate-900 text-white hover:bg-slate-800",
                )}
              >
                {loading ? t.updating : t.showResults}
              </button>

              <p className="mt-4 text-xs text-slate-500">{t.disclaimer}</p>

              <div className="mt-4">
                <Link href="/wizard" className="inline-flex items-center text-xs font-medium text-slate-700 hover:text-slate-900">
                  {t.buildMore} →
                </Link>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {selectedPlaybookId && steps.length > 0 && (
              <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">{t.nextStepsTitle}</h2>
                <ol className="mt-3 space-y-3">
                  {steps
                    .slice()
                    .sort((a, b) => a.step_order - b.step_order)
                    .map((s) => {
                      const title = lang === "en" ? s.title_en : s.title_es;
                      const body = lang === "en" ? s.body_en : s.body_es;
                      const actionLabel = lang === "en" ? s.action_label_en : s.action_label_es;
                      return (
                        <li key={s.step_id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {s.step_order}. {title}
                              </div>
                              <div className="mt-1 text-sm text-slate-700">{body}</div>
                            </div>
                            {s.action_url && actionLabel && (
                              <a
                                href={s.action_url}
                                className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                                target={s.action_url.startsWith("http") ? "_blank" : undefined}
                                rel={s.action_url.startsWith("http") ? "noreferrer" : undefined}
                              >
                                {actionLabel}
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                </ol>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{t.resourcesTitle}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {categoryLabel}
                    {countyEffective ? ` • ${countyEffective}` : ""}
                    {regionEffective ? ` • ${regionEffective}` : ""}
                  </p>
                </div>
                {notice && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</div>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-600">{t.filters.label}:</span>
                  <button
                    className={cx(
                      "rounded-full px-3 py-1 ring-1",
                      rankFilter === "all" ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200",
                    )}
                    onClick={() => setRankFilter("all")}
                    type="button"
                  >
                    {t.filters.all}
                  </button>
                  <button
                    className={cx(
                      "rounded-full px-3 py-1 ring-1",
                      rankFilter === 3 ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200",
                    )}
                    onClick={() => setRankFilter(3)}
                    type="button"
                  >
                    {t.filters.county}
                  </button>
                  <button
                    className={cx(
                      "rounded-full px-3 py-1 ring-1",
                      rankFilter === 2 ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200",
                    )}
                    onClick={() => setRankFilter(2)}
                    type="button"
                  >
                    {t.filters.region}
                  </button>
                  <button
                    className={cx(
                      "rounded-full px-3 py-1 ring-1",
                      rankFilter === 1 ? "bg-slate-900 text-white ring-slate-900" : "bg-white text-slate-700 ring-slate-200",
                    )}
                    onClick={() => setRankFilter(1)}
                    type="button"
                  >
                    {t.filters.statewide}
                  </button>
                </div>

                <input
                  value={textFilter}
                  onChange={(e) => setTextFilter(e.target.value)}
                  placeholder={t.filters.search}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-slate-400 sm:w-64"
                />
              </div>

              <div className="mt-4 grid gap-3">
                {filteredResources.map((r) => {
                  const desc = (lang === "en" ? r.description_en : r.description_es) ?? (r.description_en ?? r.description_es ?? "");
                  const phoneTel = r.phone ? normalizePhoneForTel(r.phone) : null;
                  return (
                    <div key={r.resource_id} className="rounded-2xl border border-slate-100 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                          {r.organization ? <div className="text-xs text-slate-600">{r.organization}</div> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                            {rankPill(r.match_rank, lang)}
                          </span>
                          {r.languages && (
                            <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] text-slate-700">{r.languages}</span>
                          )}
                          {typeof r.link_strength === "number" && (
                            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                              match: {r.link_strength}/5
                            </span>
                          )}
                        </div>
                      </div>

                      {desc ? <div className="mt-2 text-sm text-slate-700">{desc}</div> : null}

                      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        {r.eligibility && (
                          <div>
                            <span className="font-semibold text-slate-700">Eligibility:</span> {r.eligibility}
                          </div>
                        )}
                        {r.cost && (
                          <div>
                            <span className="font-semibold text-slate-700">Cost:</span> {r.cost}
                          </div>
                        )}
                        {r.hours && (
                          <div>
                            <span className="font-semibold text-slate-700">Hours:</span> {r.hours}
                          </div>
                        )}
                        {r.access_notes && (
                          <div>
                            <span className="font-semibold text-slate-700">Access:</span> {r.access_notes}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {r.website_url && (
                            <a
                              href={r.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              Website
                            </a>
                          )}
                          {r.phone && phoneTel && (
                            <a
                              href={`tel:${phoneTel}`}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                            >
                              Call {r.phone}
                            </a>
                          )}
                        </div>

                        <div className="text-xs text-slate-500">
                          {r.last_verified ? (
                            <span>
                              {t.verified}: {r.last_verified}
                            </span>
                          ) : null}
                          {r.source_url ? (
                            <span>
                              {" "}•{" "}
                              <a href={r.source_url} target="_blank" rel="noreferrer" className="underline">
                                {t.sources}
                              </a>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!loading && filteredResources.length === 0 && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-700">
                    {resources.length === 0 ? (
                      <>Select your county/region, choose a category (and optionally a situation). Results will load automatically.</>
                    ) : (
                      <>No resources match your filters.</>
                    )}
                  </div>
                )}
              </div>

              {/* Deep search */}
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">{t.deepSearchTitle}</h3>
                <p className="mt-1 text-sm text-slate-700">{t.deepSearchBody}</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <a
                    href="tel:+18775417905"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    {t.call211}
                  </a>
                  <a
                    href="https://www.211texas.org/"
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                  >
                    {t.open211}
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
