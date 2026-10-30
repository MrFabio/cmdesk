import { useState } from "react";
import { X } from "lucide-react";
import { ATTRS, ROLES } from "@/lib/cm/types";
import type { Filters } from "@/lib/cm/query";
import { currencyOf } from "@/lib/cm/labels";
import { DEFAULT_SEARCHES, sameSearch, useSearches } from "@/lib/cm/searches";
import { useSettings } from "@/lib/cm/settings";
import type { ParsedSave } from "@/lib/cm/types";
import { chip, chipOn, control } from "./ui";

const SIDES = [
  { bit: 1, label: "R" },
  { bit: 2, label: "L" },
  { bit: 4, label: "C" },
];

export function FilterBar({
  save,
  filters,
  showPa,
  count,
  query,
  onChange,
  onReset,
  onApply,
}: {
  save: ParsedSave;
  filters: Filters;
  showPa: boolean;
  count: number;
  query: string;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  onApply: (filters: Filters, query: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  const custom = useSearches((state) => state.custom);
  const saveSearch = useSearches((state) => state.saveSearch);
  const removeSearch = useSearches((state) => state.removeSearch);
  const currency = useSettings((state) => state.currency);
  const wagePeriod = useSettings((state) => state.wagePeriod);
  const symbol = currencyOf(currency).symbol;
  const wageUnit = wagePeriod === "week" ? "wk" : wagePeriod === "month" ? "mo" : "yr";
  const toggleBit = (mask: number, bit: number) => (mask & bit ? mask & ~bit : mask | bit);

  return (
    <div className="border-b border-line">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="text-sm">
          <span className="font-medium">Search</span>
          <span className="ml-2 font-mono text-xs text-faint">{count}</span>
        </p>
        <div className="flex items-center gap-2">
          <button type="button" className={chip} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
            {open ? "Hide filters" : "More filters"}
          </button>
          <button type="button" className={chip} onClick={onReset}>
            Clear
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3 pb-3" role="group" aria-label="Status">
        <Toggle on={filters.free} label="Free" onClick={() => onChange({ free: !filters.free })} />
        <Toggle on={filters.loan} label="On loan" onClick={() => onChange({ loan: !filters.loan })} />
        <Toggle on={filters.listed} label="Listed" onClick={() => onChange({ listed: !filters.listed })} />
        <Toggle on={filters.request} label="Transfer request" onClick={() => onChange({ request: !filters.request })} />
        <Toggle on={filters.bosman} label="Bosman" onClick={() => onChange({ bosman: !filters.bosman })} />
        <Toggle on={filters.unprotected} label="Unprotected" onClick={() => onChange({ unprotected: !filters.unprotected })} />
        <Toggle on={filters.expiring} label="Expiring ≤6 months" onClick={() => onChange({ expiring: !filters.expiring })} />
      </div>
      <div className="px-3 pb-3">
        <p className="mb-1 text-xs text-faint">Searches</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {DEFAULT_SEARCHES.map((search) => (
            <button
              key={search.id}
              type="button"
              aria-pressed={sameSearch(filters, query, search)}
              className={`${chip} ${sameSearch(filters, query, search) ? chipOn : ""}`}
              onClick={() => onApply(search.filters, search.query)}
            >
              {search.name}
            </button>
          ))}
          {custom.map((search) => {
            const on = sameSearch(filters, query, search);
            return (
              <span
                key={search.id}
                className={`inline-flex h-9 items-stretch overflow-hidden rounded-sm border ${on ? "border-accent bg-accent text-accent-ink" : "border-line text-muted"}`}
              >
                <button type="button" className="px-2.5 text-xs" aria-pressed={on} onClick={() => onApply(search.filters, search.query)}>
                  {search.name}
                </button>
                <button
                  type="button"
                  className={`border-l px-2 ${on ? "border-accent-ink/30" : "border-line"}`}
                  aria-label={`Remove ${search.name}`}
                  onClick={() => removeSearch(search.id)}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            );
          })}
          {naming ? (
            <form
              className="flex flex-wrap items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                saveSearch(draft, filters, query);
                setDraft("");
                setNaming(false);
              }}
            >
              <input
                className={`${control} w-40`}
                value={draft}
                autoFocus
                aria-label="Search name"
                placeholder="Name this search"
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" className={`${chip} ${chipOn}`} disabled={!draft.trim()}>
                Save
              </button>
              <button type="button" className={chip} onClick={() => setNaming(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" className={chip} onClick={() => setNaming(true)}>
              Save search
            </button>
          )}
        </div>
      </div>
      <div className={`${open ? "block" : "hidden"} space-y-3 px-3 pb-3`}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <Field label="Age from" value={filters.ageMin} onChange={(ageMin) => onChange({ ageMin })} />
          <Field label="Age to" value={filters.ageMax} onChange={(ageMax) => onChange({ ageMax })} />
          <Field label="CA from" value={filters.caMin} onChange={(caMin) => onChange({ caMin })} />
          <Field label="CA to" value={filters.caMax} onChange={(caMax) => onChange({ caMax })} />
          {showPa ? (
            <>
              <Field label="PA from" value={filters.paMin} onChange={(paMin) => onChange({ paMin })} />
              <Field label="PA to" value={filters.paMax} onChange={(paMax) => onChange({ paMax })} />
            </>
          ) : null}
          <Field label={`Wage ≤ ${symbol}/${wageUnit}`} value={filters.wageMax} onChange={(wageMax) => onChange({ wageMax })} />
          <Field label={`Value ≥ ${symbol}`} value={filters.valueMin} onChange={(valueMin) => onChange({ valueMin })} />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select
            label="Nation"
            value={filters.nationId}
            onChange={(nationId) => onChange({ nationId })}
            options={save.nations.map((nation) => ({ id: nation.id, label: nation.name }))}
          />
          <Select
            label="Division"
            value={filters.divisionId}
            onChange={(divisionId) => onChange({ divisionId })}
            options={save.comps.map((comp) => ({ id: comp.id, label: comp.name }))}
          />
          <Select
            label="Club"
            value={filters.clubId}
            onChange={(clubId) => onChange({ clubId })}
            options={save.clubs.map((club) => ({ id: club.id, label: club.name }))}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-xs text-faint">Position</p>
            <div className="flex flex-wrap gap-1">
              {ROLES.map((role) => (
                <Toggle
                  key={role.bit}
                  on={(filters.posMask & role.bit) !== 0}
                  label={role.label}
                  onClick={() => onChange({ posMask: toggleBit(filters.posMask, role.bit) })}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-faint">Side</p>
            <div className="flex gap-1">
              {SIDES.map((side) => (
                <Toggle
                  key={side.bit}
                  on={(filters.sideMask & side.bit) !== 0}
                  label={side.label}
                  onClick={() => onChange({ sideMask: toggleBit(filters.sideMask, side.bit) })}
                />
              ))}
            </div>
          </div>
          <AttrMin
            label="Attribute"
            attr={filters.attrA}
            min={filters.attrAMin}
            onAttr={(attrA) => onChange({ attrA })}
            onMin={(attrAMin) => onChange({ attrAMin })}
          />
          <AttrMin
            label="And"
            attr={filters.attrB}
            min={filters.attrBMin}
            onAttr={(attrB) => onChange({ attrB })}
            onMin={(attrBMin) => onChange({ attrBMin })}
          />
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${chip} ${on ? chipOn : ""}`}>
      {label}
    </button>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs text-faint">
      {label}
      <input className={`${control} mt-1`} inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: { id: number; label: string }[];
}) {
  return (
    <label className="block text-xs text-faint">
      {label}
      <select className={`${control} mt-1`} value={value} onChange={(event) => onChange(Number(event.target.value))}>
        <option value={-1}>Any</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AttrMin({
  label,
  attr,
  min,
  onAttr,
  onMin,
}: {
  label: string;
  attr: Filters["attrA"];
  min: string;
  onAttr: (attr: Filters["attrA"]) => void;
  onMin: (min: string) => void;
}) {
  return (
    <div className="flex items-end gap-1">
      <label className="block text-xs text-faint">
        {label}
        <select className={`${control} mt-1`} value={attr} onChange={(event) => onAttr(event.target.value as Filters["attrA"])}>
          <option value="">Any</option>
          {ATTRS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block w-16 text-xs text-faint">
        Min
        <input className={`${control} mt-1`} inputMode="numeric" value={min} onChange={(event) => onMin(event.target.value)} />
      </label>
    </div>
  );
}
