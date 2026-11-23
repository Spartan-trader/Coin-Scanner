import { useState } from 'react';
import {
  CONFIDENCE_LABELS,
  DENOMINATIONS,
  VALUE_KIND_LABELS,
  VERIFICATION_LABELS,
  type CollectionItem,
  type IdConfidence,
  type ValueKind,
  type VerificationStatus,
} from '../db/types';
import { canResearch, researchLinks, type ResearchLink } from '../lib/pricing';
import { SERIES_SUGGESTIONS } from '../lib/series';
import { parseMoney, todayStamp } from '../lib/util';

interface Props {
  item: CollectionItem;
  onChange: (item: CollectionItem) => void;
}

function moneyText(n: number | null) {
  return n === null ? '' : String(n);
}

/** Manual identification + valuation form. Every field can be left blank. */
export function ItemForm({ item, onChange }: Props) {
  const set = <K extends keyof CollectionItem>(k: K, v: CollectionItem[K]) => onChange({ ...item, [k]: v });
  const setValue = <K extends keyof CollectionItem['value']>(k: K, v: CollectionItem['value'][K]) =>
    onChange({ ...item, value: { ...item.value, [k]: v } });

  // Keep money fields as text while typing so "1." or "" don't jump around.
  const [low, setLow] = useState(moneyText(item.value.low));
  const [high, setHigh] = useState(moneyText(item.value.high));
  const [paid, setPaid] = useState(moneyText(item.purchasePrice));
  const [showMore, setShowMore] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  const [research, setResearch] = useState<ResearchLink | null>(null);

  /** Entering a price right after using a "Find Price" link records where it came from. */
  function setPrice(field: 'low' | 'high', text: string) {
    const v = { ...item.value, [field]: parseMoney(text) };
    if (research && !item.value.source.trim()) {
      v.source = research.sourceName;
      v.kind = research.kind;
      if (!v.asOf) v.asOf = todayStamp();
    }
    onChange({ ...item, value: v });
  }

  const seriesOptions = SERIES_SUGGESTIONS.filter((s) => !item.denomination || s.denomination === item.denomination);

  return (
    <div className="form">
      <section>
        <h2>Identification</h2>
        <div className="grid2">
          <label>
            Denomination
            <select value={item.denomination} onChange={(e) => set('denomination', e.target.value)}>
              <option value="">Unknown</option>
              {DENOMINATIONS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Year
            <input
              inputMode="numeric"
              placeholder="Unknown"
              value={item.year}
              onChange={(e) => set('year', e.target.value)}
            />
          </label>
          <label>
            Mint mark
            <select value={item.mintMark} onChange={(e) => set('mintMark', e.target.value)}>
              <option value="">Unknown</option>
              <option value="none">None (Philadelphia)</option>
              <option value="P">P</option>
              <option value="D">D</option>
              <option value="S">S</option>
              <option value="W">W</option>
              <option value="O">O</option>
              <option value="CC">CC</option>
            </select>
          </label>
          <label>
            Series
            <input
              list="series-list"
              placeholder="e.g. Lincoln Wheat"
              value={item.series}
              onChange={(e) => set('series', e.target.value)}
            />
            <datalist id="series-list">
              {seriesOptions.map((s) => (
                <option key={s.series + s.denomination} value={s.series} />
              ))}
            </datalist>
          </label>
        </div>
        <label>
          Condition notes
          <input
            placeholder="e.g. worn, toned, scratches on reverse"
            value={item.conditionNotes}
            onChange={(e) => set('conditionNotes', e.target.value)}
          />
        </label>
        <div className="grid2">
          <label>
            ID confidence
            <select value={item.idConfidence} onChange={(e) => set('idConfidence', e.target.value as IdConfidence)}>
              {Object.entries(CONFIDENCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={item.verificationStatus}
              onChange={(e) => set('verificationStatus', e.target.value as VerificationStatus)}
            >
              {Object.entries(VERIFICATION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section>
        <h2>Value</h2>
        <button
          type="button"
          className="btn secondary find-price"
          disabled={!canResearch(item)}
          onClick={() => setShowPrices((v) => !v)}
          aria-expanded={showPrices}
        >
          🔎 Find Price
        </button>
        {!canResearch(item) && <p className="muted small">Enter the denomination or series first, then tap Find Price.</p>}
        {showPrices && canResearch(item) && (
          <div className="research" data-testid="research-links">
            <p className="small muted">
              Opens in a new tab, already searched for this coin. Read the price there, come back, and type it below —
              the source and today’s date are filled in for you. Prices depend heavily on condition, so compare a few.
            </p>
            {researchLinks(item).map((l) => (
              <a
                key={l.id}
                className={`research-link ${research?.id === l.id ? 'used' : ''}`}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setResearch(l)}
              >
                <strong>{l.label} ↗</strong>
                <span className="small muted">{l.description}</span>
              </a>
            ))}
          </div>
        )}
        <p className="muted small">Leave blank if not researched yet. Blank is shown as “Value not yet verified”, never $0.</p>
        <div className="grid2">
          <label>
            Low ($)
            <input
              inputMode="decimal"
              placeholder="—"
              value={low}
              onChange={(e) => {
                setLow(e.target.value);
                setPrice('low', e.target.value);
              }}
            />
          </label>
          <label>
            High ($)
            <input
              inputMode="decimal"
              placeholder="—"
              value={high}
              onChange={(e) => {
                setHigh(e.target.value);
                setPrice('high', e.target.value);
              }}
            />
          </label>
        </div>
        <div className="grid2">
          <label>
            Value type
            <select value={item.value.kind} onChange={(e) => setValue('kind', e.target.value as ValueKind)}>
              {Object.entries(VALUE_KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pricing date
            <input type="date" value={item.value.asOf} onChange={(e) => setValue('asOf', e.target.value)} />
          </label>
        </div>
        <label>
          Pricing source
          <input
            placeholder="e.g. PCGS Price Guide, Red Book 2026"
            value={item.value.source}
            onChange={(e) => setValue('source', e.target.value)}
          />
        </label>
        <label>
          Grade / condition assumed
          <input
            placeholder="e.g. VF-20"
            value={item.value.gradeAssumption}
            onChange={(e) => setValue('gradeAssumption', e.target.value)}
          />
        </label>
      </section>

      <button type="button" className="link" onClick={() => setShowMore((s) => !s)}>
        {showMore ? '▾ Fewer details' : '▸ More details (variety, storage, purchase price…)'}
      </button>
      {showMore && (
        <section>
          <div className="grid2">
            <label>
              Country
              <input value={item.country} onChange={(e) => set('country', e.target.value)} />
            </label>
            <label>
              Composition
              <input
                placeholder="e.g. 95% copper"
                value={item.composition}
                onChange={(e) => set('composition', e.target.value)}
              />
            </label>
          </div>
          <label>
            Variety / error
            <input
              placeholder="e.g. Doubled die obverse"
              value={item.variety}
              onChange={(e) => set('variety', e.target.value)}
            />
          </label>
          <div className="grid2">
            <label>
              Quantity
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => set('quantity', Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              />
            </label>
            <label>
              Purchase price ($)
              <input
                inputMode="decimal"
                placeholder="—"
                value={paid}
                onChange={(e) => {
                  setPaid(e.target.value);
                  set('purchasePrice', parseMoney(e.target.value));
                }}
              />
            </label>
          </div>
          <label>
            Storage location
            <input
              placeholder="e.g. Album 2, page 5"
              value={item.storageLocation}
              onChange={(e) => set('storageLocation', e.target.value)}
            />
          </label>
          <label>
            Value notes
            <textarea rows={2} value={item.value.notes} onChange={(e) => setValue('notes', e.target.value)} />
          </label>
          <label>
            Personal notes
            <textarea rows={3} value={item.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </section>
      )}
    </div>
  );
}
