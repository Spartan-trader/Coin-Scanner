import { useEffect, useMemo, useState } from 'react';
import { useStoredPhoto } from '../components/usePhotoUrl';
import { listItems } from '../db/db';
import { DENOMINATIONS, VERIFICATION_LABELS, itemTitle, type CollectionItem } from '../db/types';
import { VALUABLE_THRESHOLD, computeStats, formatMoney, formatRange, valueRange } from '../lib/stats';

type Sort = 'newest' | 'oldest' | 'year' | 'value';
const PAGE = 60;

interface Props {
  onOpen: (id: string) => void;
}

export function CollectionScreen({ onOpen }: Props) {
  const [items, setItems] = useState<CollectionItem[] | null>(null);
  const [q, setQ] = useState('');
  const [denom, setDenom] = useState('');
  const [status, setStatus] = useState('');
  const [mint, setMint] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    listItems().then(setItems);
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const needle = q.trim().toLowerCase();
    const out = items.filter(
      (i) =>
        (!denom || i.denomination === denom) &&
        (!status || i.verificationStatus === status) &&
        (!mint || (mint === '?' ? i.mintMark === '' : i.mintMark === mint)) &&
        (!needle ||
          [i.year, i.series, i.denomination, i.mintMark, i.variety, i.notes, i.storageLocation, i.conditionNotes]
            .join(' ')
            .toLowerCase()
            .includes(needle)),
    );
    const val = (i: CollectionItem) => valueRange(i)?.high ?? -1; // unvalued sort last
    const yr = (i: CollectionItem) => parseInt(i.year, 10) || 99999;
    out.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.createdAt.localeCompare(b.createdAt);
        case 'year':
          return yr(a) - yr(b);
        case 'value':
          return val(b) - val(a);
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return out;
  }, [items, q, denom, status, mint, sort]);

  const stats = useMemo(() => computeStats(items ?? []), [items]);

  if (!items) return <div className="screen"><p className="center muted">Loading…</p></div>;

  return (
    <div className="screen collection">
      <header className="bar">
        <span />
        <h1>My Collection</h1>
        <span />
      </header>

      <div className="stats">
        <Stat label="Coins" value={String(stats.totalCoins)} testId="stat-coins" />
        <Stat
          label={`Est. value (${stats.valuedRecords} of ${stats.records} valued)`}
          value={
            stats.valueLow === null
              ? 'Not yet verified'
              : stats.valueLow === stats.valueHigh
                ? formatMoney(stats.valueLow)
                : `${formatMoney(stats.valueLow)} – ${formatMoney(stats.valueHigh)}`
          }
        />
        <Stat label="Not yet verified" value={String(stats.needsResearch)} />
        <Stat
          label={`Possibly valuable (≥ $${VALUABLE_THRESHOLD} or expert review)`}
          value={String(stats.potentiallyValuable)}
          onClick={() => setSort('value')}
        />
      </div>

      <div className="filters">
        <input type="search" placeholder="Search year, series, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row wrap">
          <select value={denom} onChange={(e) => setDenom(e.target.value)} aria-label="Denomination filter">
            <option value="">All denominations</option>
            {DENOMINATIONS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select value={mint} onChange={(e) => setMint(e.target.value)} aria-label="Mint mark filter">
            <option value="">All mint marks</option>
            <option value="none">None</option>
            {['P', 'D', 'S', 'W', 'O', 'CC'].map((m) => (
              <option key={m}>{m}</option>
            ))}
            <option value="?">Unknown</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
            <option value="">All statuses</option>
            {Object.entries(VERIFICATION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="newest">Newest scanned</option>
            <option value="oldest">Oldest scanned</option>
            <option value="year">Year</option>
            <option value="value">Highest value</option>
          </select>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="center muted">No coins yet. Tap “Scan” to add your first coin.</p>
      ) : (
        <>
          <p className="muted small">
            Showing {Math.min(limit, filtered.length)} of {filtered.length}
          </p>
          <ul className="cards" data-testid="coin-list">
            {filtered.slice(0, limit).map((i) => (
              <CoinCard key={i.id} item={i} onOpen={() => onOpen(i.id)} />
            ))}
          </ul>
          {filtered.length > limit && (
            <button className="btn secondary" onClick={() => setLimit((l) => l + PAGE)}>
              Show more
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, onClick, testId }: { label: string; value: string; onClick?: () => void; testId?: string }) {
  return (
    <button className="stat" onClick={onClick} disabled={!onClick} data-testid={testId}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </button>
  );
}

function CoinCard({ item, onOpen }: { item: CollectionItem; onOpen: () => void }) {
  const front = useStoredPhoto(item.frontPhotoId, 'thumb');
  const back = useStoredPhoto(item.backPhotoId, 'thumb');
  return (
    <li>
      <button className="card" onClick={onOpen}>
        <span className="thumbs">
          {front ? <img src={front} alt="" loading="lazy" /> : <span className="empty" />}
          {back ? <img src={back} alt="" loading="lazy" /> : <span className="empty" />}
        </span>
        <span className="card-body">
          <strong>{itemTitle(item)}</strong>
          <span className="small">{formatRange(item)}</span>
          <span className={`badge ${item.verificationStatus}`}>{VERIFICATION_LABELS[item.verificationStatus]}</span>
        </span>
      </button>
    </li>
  );
}
