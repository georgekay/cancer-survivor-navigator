"use client";

import Link from "next/link";


import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Building2,
  CreditCard,
  Pill,
  Car,
  Phone,
  Globe,
  MapPin,
  BadgeCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

type County = { county_name: string; region_name: string };
type Category = "bills_coverage" | "meds" | "transport";

type Resource = {
  resource_id: string;
  name: string;
  category: string;
  description_short: string | null;
  phone: string | null;
  website: string | null;
  languages: string | null;
  eligibility_notes: string | null;
  how_to_use: string | null;
  last_verified_date: string | null;
  match_rank: number;
};

const rankMeta = (rank: number) => {
  if (rank === 1)
    return { label: "Near you (county)", className: "bg-emerald-50 text-emerald-800 ring-emerald-200" };
  if (rank === 2)
    return { label: "Your region", className: "bg-blue-50 text-blue-800 ring-blue-200" };
  return { label: "Statewide", className: "bg-slate-50 text-slate-800 ring-slate-200" };
};

const categoryMeta: Record<Category, { label: string; icon: any; blurb: string }> = {
  bills_coverage: {
    label: "Bills & Coverage",
    icon: CreditCard,
    blurb: "Help with bills, denials, financial assistance, and insurance navigation.",
  },
  meds: {
    label: "Medications",
    icon: Pill,
    blurb: "Copay help, patient assistance programs, and prescription support.",
  },
  transport: {
    label: "Transportation",
    icon: Car,
    blurb: "Rides, paratransit, and lodging near treatment when available.",
  },
};

function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function Page() {
  const [counties, setCounties] = useState<County[]>([]);
  const [q, setQ] = useState("");
  const [selectedCounty, setSelectedCounty] = useState<County | null>(null);
  const [category, setCategory] = useState<Category | null>(null);

  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingCounties, setLoadingCounties] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rankFilter, setRankFilter] = useState<"all" | 1 | 2 | 3>("all");
  const [resourceSearch, setResourceSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoadingCounties(true);
      setError(null);

      const { data, error } = await supabase
        .from("counties")
        .select("county_name, region_name")
        .order("county_name", { ascending: true });

      if (error) setError(error.message);
      else setCounties((data ?? []) as County[]);

      setLoadingCounties(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedCounty) return;
    try {
      localStorage.setItem("txsn_county", selectedCounty.county_name);
      localStorage.setItem("txsn_region", selectedCounty.region_name);
    } catch {}
  }, [selectedCounty]);


  useEffect(() => {
    (async () => {
      if (!selectedCounty || !category) return;

      setLoadingResources(true);
      setError(null);
      setResources([]);

      const { data, error } = await supabase.rpc("match_resources", {
        p_county: selectedCounty.county_name,
        p_region: selectedCounty.region_name,
        p_category: category,
      });

      if (error) setError(error.message);
      else setResources((data ?? []) as Resource[]);

      setLoadingResources(false);
    })();
  }, [selectedCounty, category]);

  const filteredCounties = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return counties;
    return counties.filter((c) => c.county_name.toLowerCase().includes(s));
  }, [counties, q]);

  const filteredResources = useMemo(() => {
    const s = resourceSearch.trim().toLowerCase();
    return resources.filter((r) => {
      const byRank = rankFilter === "all" ? true : r.match_rank === rankFilter;
      const byText =
        !s ||
        r.name.toLowerCase().includes(s) ||
        (r.description_short ?? "").toLowerCase().includes(s) ||
        (r.languages ?? "").toLowerCase().includes(s);
      return byRank && byText;
    });
  }, [resources, rankFilter, resourceSearch]);

  const reset = () => {
    setSelectedCounty(null);
    setCategory(null);
    setResources([]);
    setRankFilter("all");
    setResourceSearch("");
  };
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-slate-800" />
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                Texas Survivorship Navigator
              </h1>
              <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200">
                Gulf Coast pilot
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              County → Region → Statewide resources for bills, meds, and transportation.
            </p>
          </div>

          <Link
            href="/wizard"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            title="Bill Help Wizard"
          >
            Bill Help Wizard
          </Link>

          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            title="Reset"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <div>
                <div className="font-semibold">Something went wrong</div>
                <div className="text-sm opacity-90">{error}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500">STEP 1</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <MapPin className="h-5 w-5" /> Choose your county
                </h2>
                <p className="mt-1 text-sm text-slate-600">We’ll prioritize resources closest to you.</p>
              </div>

              {selectedCounty && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
                  <BadgeCheck className="h-4 w-4" />
                  Selected
                </span>
              )}
            </div>

            <div className="mt-4">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search county (e.g., Harris)"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-slate-100">
              {loadingCounties ? (
                <div className="p-4 text-sm text-slate-600">Loading counties…</div>
              ) : (
                filteredCounties.map((c) => {
                  const selected = selectedCounty?.county_name === c.county_name;
                  return (
                    <button
                      key={c.county_name}
                      onClick={() => {
                        setSelectedCounty(c);
                        setCategory(null);
                        setResources([]);
                        setRankFilter("all");
                        setResourceSearch("");
                      }}
                      className={cx(
                        "w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50",
                        selected && "bg-slate-50"
                      )}
                    >
                      <div className="font-medium text-slate-900">{c.county_name}</div>
                      <div className="text-xs text-slate-600">{c.region_name}</div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedCounty && (
              <div className="mt-3 text-sm text-slate-700">
                Selected: <span className="font-semibold">{selectedCounty.county_name}</span>{" "}
                <span className="text-slate-500">({selectedCounty.region_name})</span>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">STEP 2</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">What do you need help with?</h2>
            <p className="mt-1 text-sm text-slate-600">Pick one category to see ranked resources.</p>

            <div className="mt-4 grid gap-3">
              {(["bills_coverage", "meds", "transport"] as Category[]).map((cat) => {
                const meta = categoryMeta[cat];
                const Icon = meta.icon;
                const active = category === cat;

                return (
                  <button
                    key={cat}
                    disabled={!selectedCounty}
                    onClick={() => setCategory(cat)}
                    className={cx(
                      "rounded-2xl border px-4 py-4 text-left shadow-sm transition",
                      !selectedCounty
                        ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                        : active
                        ? "border-slate-300 bg-slate-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl border border-slate-200 bg-white p-2">
                        <Icon className="h-5 w-5 text-slate-800" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{meta.label}</div>
                        <div className="mt-1 text-sm text-slate-600">{meta.blurb}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {!selectedCounty && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Select a county first to unlock categories.
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">STEP 3</div>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Your resource list</h2>
              <p className="mt-1 text-sm text-slate-600">Ordered by proximity: county → region → statewide.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex gap-2">
                {(["all", 1, 2, 3] as const).map((r) => (
                  <button
                    key={String(r)}
                    onClick={() => setRankFilter(r)}
                    className={cx(
                      "rounded-full border px-3 py-1 text-xs font-medium",
                      rankFilter === r
                        ? "border-slate-300 bg-slate-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                    disabled={!resources.length}
                  >
                    {r === "all" ? "All" : r === 1 ? "County" : r === 2 ? "Region" : "Statewide"}
                  </button>
                ))}
              </div>

              <input
                value={resourceSearch}
                onChange={(e) => setResourceSearch(e.target.value)}
                placeholder="Search resources..."
                className="w-full sm:w-64 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-slate-300"
                disabled={!resources.length}
              />
            </div>
          </div>

          {!selectedCounty || !category ? (
            <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              Choose a county and a category to load results.
            </div>
          ) : loadingResources ? (
            <div className="mt-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
              ))}
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
              No matches found for this category.
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              {filteredResources.map((r) => {
                const rank = rankMeta(r.match_rank);
                return (
                  <div key={r.resource_id} className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-lg font-semibold text-slate-900">{r.name}</div>
                        {r.description_short && <p className="mt-1 text-sm text-slate-600">{r.description_short}</p>}
                      </div>

                      <span className={cx("inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium ring-1", rank.className)}>
                        {rank.label}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
                      {r.phone && (
                        <a
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
                          href={`tel:${r.phone.replace(/[^0-9+]/g, "")}`}
                          title="Call"
                        >
                          <Phone className="h-4 w-4" />
                          Call
                        </a>
                      )}

                      {r.website && (
                        <a
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
                          href={r.website}
                          target="_blank"
                          rel="noreferrer"
                          title="Open website"
                        >
                          <Globe className="h-4 w-4" />
                          Website
                        </a>
                      )}

                      {r.languages && (
                        <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <span className="font-medium">Languages:</span>&nbsp;{r.languages}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-800">What to do next</summary>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{r.how_to_use ?? "—"}</div>
                      </details>

                      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Eligibility & notes</summary>
                        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{r.eligibility_notes ?? "—"}</div>
                      </details>
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      {r.last_verified_date ? `Last verified: ${r.last_verified_date}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="mt-8 text-xs text-slate-500">
          <p>
            This tool provides resource navigation and is not medical, legal, or financial advice. If you have an urgent
            billing deadline or immediate safety concern, contact your care team or local emergency services.
          </p>
        </footer>
      </main>
    </div>
  );
}
