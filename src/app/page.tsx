"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  // new fields (patch v1)
  is_locator?: boolean;
  requires_zip?: boolean;
  website_template?: string | null;
  priority?: number;
};

type FeedbackIssue = "wrong_phone" | "broken_link" | "not_eligible" | "closed" | "other";

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

function safeEncode(s: string) {
  try {
    return encodeURIComponent(s);
  } catch {
    return s;
  }
}

function buildWebsiteUrl(
  r: ResourceMatch,
  ctx: { county: string; region: string; zip: string },
): string | null {
  const tpl = (r.website_template ?? "").trim();
  if (tpl) {
    return tpl
      .replaceAll("{county}", safeEncode(ctx.county))
      .replaceAll("{region}", safeEncode(ctx.region))
      .replaceAll("{zip}", safeEncode(ctx.zip));
  }
  return r.website_url;
}

function rankPill(r: ResourceMatch, lang: Lang) {
  // If DB marks this as a locator, label it clearly.
  if (r.is_locator) return lang === "es" ? "Buscador local" : "Local finder";

  // In our DB: 3=county, 2=region, 1=statewide
  if (r.match_rank >= 3) return lang === "es" ? "Cerca (condado)" : "Near you (county)";
  if (r.match_rank === 2) return lang === "es" ? "Su región" : "Your region";
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
    zipLabel: "ZIP code (optional, helps local finders)",
    zipPlaceholder: "e.g., 77030",
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
    updating: "Searching…",
    noResults:
      "No matches found for this county/region yet. We’ll show statewide resources and local finders (directory tools).",
    deepSearchTitle: "Deep local search (Texas)",
    deepSearchBody:
      "For county programs and local nonprofits, 2-1-1 Texas can locate services near you and tell you what documents you’ll need.",
    call211: "Call 2-1-1 Texas",
    open211: "Open 2-1-1 Texas",
    nextStepsTitle: "Next steps",
    resourcesTitle: "Resources",
    verified: "Last verified",
    sources: "Source",
    report: "Report an issue",
    reportHint:
      "If a phone number is wrong, link is broken, or eligibility changed, you can report it so we can keep the directory accurate.",
    disclaimer:
      "This tool is for navigation and information only. For emergencies, call 911. Program eligibility and availability can change—always confirm details with the program.",
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
    zipLabel: "Código postal (opcional; ayuda con buscadores locales)",
    zipPlaceholder: "Ej., 77030",
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
    updating: "Buscando…",
    noResults:
      "No encontramos coincidencias para este condado/región. Mostraremos recursos estatales y buscadores locales (directorios).",
    deepSearchTitle: "Búsqueda local profunda (Texas)",
    deepSearchBody:
      "Para programas del condado y organizaciones locales, 2-1-1 Texas puede encontrar servicios cerca de usted e indicarle qué documentos necesita.",
    call211: "Llamar a 2-1-1 Texas",
    open211: "Abrir 2-1-1 Texas",
    nextStepsTitle: "Próximos pasos",
    resourcesTitle: "Recursos",
    verified: "Última verificación",
    sources: "Fuente",
    report: "Reportar un problema",
    reportHint:
      "Si un número está mal, el enlace no funciona o la elegibilidad cambió, repórtelo para mantener el directorio actualizado.",
    disclaimer:
      "Esta herramienta es solo para navegación e información. En emergencias, llame al 911. La elegibilidad y disponibilidad pueden cambiar—confirme siempre con el programa.",
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
  const [region, setRegion] = useState<string>("Other/Unknown");
  const [zip, setZip] = useState<string>("");

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

  // Load persisted ZIP
  useEffect(() => {
    try {
      const saved = localStorage.getItem("txsn_zip");
      if (saved) setZip(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("txsn_zip", zip);
    } catch {
      // ignore
    }
  }, [zip]);

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

  const regionOptions = useMemo(() => {
    const s = new Set<string>();
    for (const row of counties) {
      const r = (row.region_name ?? "").trim();
      if (r) s.add(r);
    }
    const list = Array.from(s).sort((a, b) => a.localeCompare(b));
    // Always keep an escape hatch
    return [...list, "Other/Unknown"];
  }, [counties]);


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

  // Auto-search after selections change
  const autoSearchKey = useMemo(() => {
    return `${category}::${countyEffective}::${regionEffective}::${selectedPlaybookId ?? "none"}`;
  }, [category, countyEffective, regionEffective, selectedPlaybookId]);

  useEffect(() => {
    if (!countyEffective && !regionEffective) return;
    const tmr = setTimeout(() => {
      runSearch();
    }, 250);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSearchKey]);

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

  const context = useMemo(
    () => ({ county: countyEffective, region: regionEffective, zip: zip.trim() }),
    [countyEffective, regionEffective, zip],
  );

  async function submitFeedback(resourceId: string, issueType: FeedbackIssue, message: string) {
    const payload = {
      resource_id: resourceId,
      county_name: countyEffective || null,
      region_name: regionEffective || null,
      zip: zip.trim() || null,
      issue_type: issueType,
      message: message || null,
      language: lang,
    };

    const { error } = await supabase.from("resource_feedback").insert(payload);
    if (error) {
      console.error(error);
      alert("Could not submit feedback. Please try again later.");
      return;
    }
    alert(lang === "es" ? "Gracias. Su reporte fue enviado." : "Thanks — your report was submitted.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t.appTitle}</h1>
              <p className="mt-2 max-w-2xl text-slate-600">{t.appSubtitle}</p>
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
                      onChange={(e) => setRegion(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-slate-400"
                    >
                      {regionOptions.map((r) => (
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

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-800">{t.zipLabel}</label>
                  <input
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    placeholder={t.zipPlaceholder}
                    inputMode="numeric"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-slate-400"
                  />
                  <div className="mt-2 text-xs text-slate-500">
                    Local finders can use ZIP/county to show nearby programs. (Optional.)
                  </div>
                </div>

                {/* Category */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-800">{t.categoryLabel}</label>
                  <div className="mt-2 grid gap-2">
                    {(["bills_coverage", "meds", "transport"] as CategoryKey[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setCategory(k)}
                        className={cx(
                          "w-full rounded-xl border px-3 py-3 text-left text-sm",
                          category === k
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                        )}
                      >
                        <div className="font-semibold">{t.categories[k]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Situation */}
                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-800">{t.situationLabel}</label>
                  <div className="mt-1 text-xs text-slate-500">{t.situationHint}</div>
                  <div className="mt-2 grid gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPlaybookId(null)}
                      className={cx(
                        "w-full rounded-xl border px-3 py-2 text-left text-sm",
                        selectedPlaybookId === null
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                      )}
                    >
                      {t.browseOnly}
                    </button>

                    {playbooks.map((p) => (
                      <button
                        key={p.playbook_id}
                        type="button"
                        onClick={() => setSelectedPlaybookId(p.playbook_id)}
                        className={cx(
                          "w-full rounded-xl border px-3 py-2 text-left",
                          selectedPlaybookId === p.playbook_id
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
                        )}
                      >
                        <div className="text-sm font-semibold">{lang === "en" ? p.title_en : p.title_es}</div>
                        <div className={cx("mt-1 text-xs", selectedPlaybookId === p.playbook_id ? "text-slate-200" : "text-slate-600")}>
                          {lang === "en" ? p.summary_en : p.summary_es}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual refresh */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={runSearch}
                    className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {loading ? t.updating : "Refresh results"}
                  </button>
                  {notice ? <div className="mt-3 text-sm text-slate-700">{notice}</div> : null}
                </div>
              </div>
            </div>

            {/* Next steps panel */}
            {selectedPlaybookId && steps.length > 0 && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">{t.nextStepsTitle}</h3>
                <div className="mt-3 grid gap-3">
                  {steps.map((s) => (
                    <div key={s.step_id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">
                        {s.step_order}. {lang === "en" ? s.title_en : s.title_es}
                      </div>
                      <div className="mt-1 text-sm text-slate-700">{lang === "en" ? s.body_en : s.body_es}</div>
                      {s.action_url ? (
                        <a
                          href={s.action_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
                        >
                          {lang === "en" ? s.action_label_en ?? "Open" : s.action_label_es ?? "Abrir"}
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{t.resourcesTitle}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    County → region → statewide, plus local directory finders.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setRankFilter("all")}
                      className={cx(
                        "rounded-lg px-3 py-2 text-sm",
                        rankFilter === "all" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {t.filters.all}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankFilter(3)}
                      className={cx(
                        "rounded-lg px-3 py-2 text-sm",
                        rankFilter === 3 ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {t.filters.county}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankFilter(2)}
                      className={cx(
                        "rounded-lg px-3 py-2 text-sm",
                        rankFilter === 2 ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
                      )}
                    >
                      {t.filters.region}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRankFilter(1)}
                      className={cx(
                        "rounded-lg px-3 py-2 text-sm",
                        rankFilter === 1 ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
                      )}
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
              </div>

              <div className="mt-4 grid gap-3">
                {filteredResources.map((r) => {
                  const desc =
                    (lang === "en" ? r.description_en : r.description_es) ??
                    (r.description_en ?? r.description_es ?? "");
                  const phoneTel = r.phone ? normalizePhoneForTel(r.phone) : null;

                  const website = buildWebsiteUrl(r, context);
                  const needsZip = !!r.requires_zip;
                  const zipOk = !needsZip || !!context.zip;

                  return (
                    <div key={r.resource_id} className="rounded-2xl border border-slate-100 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                          {r.organization ? <div className="text-xs text-slate-600">{r.organization}</div> : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                            {rankPill(r, lang)}
                          </span>
                          {r.languages && (
                            <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                              {r.languages}
                            </span>
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
                          {website && (
                            <a
                              href={website}
                              target="_blank"
                              rel="noreferrer"
                              aria-disabled={!zipOk}
                              className={cx(
                                "rounded-xl px-3 py-2 text-xs font-semibold",
                                zipOk
                                  ? "bg-slate-900 text-white hover:bg-slate-800"
                                  : "bg-slate-200 text-slate-500 cursor-not-allowed",
                              )}
                              onClick={(e) => {
                                if (!zipOk) e.preventDefault();
                              }}
                            >
                              {r.is_locator ? (lang === "es" ? "Abrir buscador" : "Open finder") : "Website"}
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

                          {/* Simple feedback */}
                          <button
                            type="button"
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={async () => {
                              const issue = prompt(
                                `${t.reportHint}\n\nType one word: broken_link | wrong_phone | not_eligible | closed | other`,
                              );
                              if (!issue) return;
                              const issueType = issue.trim() as FeedbackIssue;
                              const msg = prompt(lang === "es" ? "Detalles (opcional):" : "Details (optional):") ?? "";
                              await submitFeedback(r.resource_id, issueType, msg);
                            }}
                          >
                            {t.report}
                          </button>
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

                      {!zipOk && (
                        <div className="mt-2 text-xs text-amber-700">
                          {lang === "es"
                            ? "Ingrese su código postal arriba para usar este buscador local."
                            : "Enter your ZIP code above to use this local finder."}
                        </div>
                      )}
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

              <p className="mt-6 text-xs text-slate-500">{t.disclaimer}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
