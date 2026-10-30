import { X } from "lucide-react";
import { CURRENCIES, WAGE_PERIODS, rateNote } from "@/lib/cm/labels";
import { COLUMN_DEFS, MUTE_STOPS, PACKS, THEMES, useSettings } from "@/lib/cm/settings";
import { useDesk } from "@/lib/cm/store";
import { Stat } from "./stat";
import { button, chipClass } from "./ui";

export function SettingsView({ onClose }: { onClose: () => void }) {
  const pack = useSettings((state) => state.pack);
  const theme = useSettings((state) => state.theme);
  const showPa = useSettings((state) => state.showPa);
  const nameStyle = useSettings((state) => state.nameStyle);
  const density = useSettings((state) => state.density);
  const columns = useSettings((state) => state.columns);
  const hideGkOutfield = useSettings((state) => state.hideGkOutfield);
  const muteBelow = useSettings((state) => state.muteBelow);
  const rememberSort = useSettings((state) => state.rememberSort);
  const currency = useSettings((state) => state.currency);
  const wagePeriod = useSettings((state) => state.wagePeriod);
  const setPack = useSettings((state) => state.setPack);
  const setTheme = useSettings((state) => state.setTheme);
  const setShowPa = useSettings((state) => state.setShowPa);
  const setNameStyle = useSettings((state) => state.setNameStyle);
  const setDensity = useSettings((state) => state.setDensity);
  const setColumn = useSettings((state) => state.setColumn);
  const setHideGkOutfield = useSettings((state) => state.setHideGkOutfield);
  const setMuteBelow = useSettings((state) => state.setMuteBelow);
  const setRememberSort = useSettings((state) => state.setRememberSort);
  const setCurrency = useSettings((state) => state.setCurrency);
  const setWagePeriod = useSettings((state) => state.setWagePeriod);
  const setSavedSort = useSettings((state) => state.setSavedSort);
  const reset = useSettings((state) => state.reset);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Settings</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Kept in this browser. The theme, attribute colours, and the searches you save all stay here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-11 items-center justify-center rounded-sm border border-line hover:bg-surface-2"
            aria-label="Close settings"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <section>
          <h3 className="text-sm font-medium">Theme</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={theme === item.id}
                onClick={() => setTheme(item.id)}
                className={`overflow-hidden rounded-sm border text-left hover:bg-surface-2 ${theme === item.id ? "border-accent" : "border-line"}`}
              >
                <span className={`theme-strip theme-strip-${item.id}`} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="block px-3 pt-2 text-sm font-medium">{item.label}</span>
                <span className="block px-3 pb-3 text-xs text-muted">{item.note}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium">Attribute colours</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {PACKS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={pack === item.id}
                onClick={() => setPack(item.id)}
                className={`rounded-sm border px-3 py-3 text-left hover:bg-surface-2 ${pack === item.id ? "border-accent" : "border-line"}`}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="mt-1 block text-xs text-muted">{item.note}</span>
                <span className={`mt-2 flex gap-3 text-sm ${pack === item.id ? "" : "opacity-70"}`} data-pack={item.id}>
                  {[4, 8, 11, 14, 17, 20].map((value) => (
                    <Stat key={value} value={value} kind="attr" mute={false} />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">
            Attributes use 1–4, 5–8, 9–11, 12–14, 15–17, 18–20. Ability uses the same colours after dividing by ten.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium">Money</h3>
          <p className="mt-1 text-xs text-faint">The file stores pounds. This only changes what you see.</p>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Currency">
            {CURRENCIES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={currency === item.id}
                className={chipClass(currency === item.id)}
                onClick={() => setCurrency(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">{rateNote(currency)}</p>
          <p className="mt-4 text-xs text-faint">Wages</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Wage period">
            {WAGE_PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={wagePeriod === item.id}
                className={chipClass(wagePeriod === item.id)}
                onClick={() => setWagePeriod(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">Weekly is how the file stores it. A month is 52 ÷ 12 weeks. A year is 52.</p>
        </section>

        <section>
          <h3 className="text-sm font-medium">Display</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" aria-pressed={showPa} className={chipClass(showPa)} onClick={() => setShowPa(!showPa)}>
              Show potential
            </button>
            <button
              type="button"
              aria-pressed={nameStyle === "common"}
              className={chipClass(nameStyle === "common")}
              onClick={() => setNameStyle("common")}
            >
              Common name
            </button>
            <button
              type="button"
              aria-pressed={nameStyle === "full"}
              className={chipClass(nameStyle === "full")}
              onClick={() => setNameStyle("full")}
            >
              Full name
            </button>
            <button
              type="button"
              aria-pressed={density === "comfortable"}
              className={chipClass(density === "comfortable")}
              onClick={() => setDensity("comfortable")}
            >
              Comfortable rows
            </button>
            <button
              type="button"
              aria-pressed={density === "compact"}
              className={chipClass(density === "compact")}
              onClick={() => setDensity("compact")}
            >
              Compact rows
            </button>
            <button
              type="button"
              aria-pressed={hideGkOutfield}
              className={chipClass(hideGkOutfield)}
              onClick={() => setHideGkOutfield(!hideGkOutfield)}
            >
              Hide goalkeeping for outfielders
            </button>
            <button
              type="button"
              aria-pressed={rememberSort}
              className={chipClass(rememberSort)}
              onClick={() => {
                const next = !rememberSort;
                setRememberSort(next);
                if (next) {
                  const desk = useDesk.getState();
                  setSavedSort(desk.sortKey, desk.sortDir);
                }
              }}
            >
              Remember column sort
            </button>
          </div>
          <div className="mt-4">
            <p className="text-xs text-faint">Quiet attributes under</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MUTE_STOPS.map((stop) => (
                <button
                  key={stop}
                  type="button"
                  aria-pressed={muteBelow === stop}
                  className={chipClass(muteBelow === stop)}
                  onClick={() => setMuteBelow(stop)}
                >
                  {stop === 0 ? "Off" : String(stop)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-faint">Numbers under the line stay grey. Ability and potential keep their colour.</p>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium">Columns</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COLUMN_DEFS.map((column) => (
              <label key={column.id} className="flex h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={column.id === "pa" ? showPa && columns.pa : columns[column.id]}
                  disabled={column.locked || (column.id === "pa" && !showPa)}
                  onChange={(event) => setColumn(column.id, event.target.checked)}
                />
                {column.label}
              </label>
            ))}
          </div>
        </section>

        <button type="button" className={`${button} self-start`} onClick={reset}>
          Reset settings
        </button>
      </div>
    </div>
  );
}
