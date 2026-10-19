import React, { useState } from 'react';
export const money = (n) => (n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n));
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
export const Card = ({ label, value, hint, tone }) => <div className={`stat ${tone || ''}`} title={hint}><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</div>;
export const Badge = ({ s }) => <span className={`badge b-${s}`}>{String(s).replace(/_/g, ' ')}</span>;
export const Err = ({ e }) => (e ? <p className="alert err" role="alert">{e.message || String(e)}</p> : null);
export const Panel = ({ title, children, actions }) => <section className="panel"><div className="panel-head"><h2>{title}</h2>{actions}</div>{children}</section>;
export const Empty = ({ children }) => <p className="empty">{children}</p>;
export function Field({ label, children, hint }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export function useAction() {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [ok, setOk] = useState('');
  const run = async (fn, msg = 'Saved') => { setBusy(true); setError(null); setOk(''); try { const r = await fn(); setOk(msg); return r; } catch (e) { setError(e); return null; } finally { setBusy(false); } };
  return { busy, error, ok, run };
}
export const Bars = ({ rows, label = 'name', value = 'amount' }) => {
  const max = Math.max(1, ...rows.map((r) => r[value]));
  return <div className="bars">{rows.map((r) => <div key={r[label]} className="bar"><span>{r[label]}</span><div><i style={{ width: `${(r[value] / max) * 100}%` }} /></div><b>{r[value]}</b></div>)}</div>;
};
