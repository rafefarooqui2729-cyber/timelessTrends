import React from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { Badge, Card, Empty, Err, Panel, money } from './ui.jsx';

export default function Overview() {
  const { data, error, loading } = useLoad(async () => ({ r: await api.get('/api/admin/reports/overview'), p: await api.get('/api/admin/products'), s: await api.get('/api/admin/settings') }), []);
  if (loading) return <p className="center-note">Loading…</p>;
  if (error) return <Err e={error} />;
  const { r, p, s } = data; const t = r.today; const m = r.month; const f = m.financials;
  return (
    <div className="page">
      <h1>Overview</h1>
      {!s.whatsapp_number && <p className="alert warn">WhatsApp number is not set yet. <Link to="/admin/settings">Add it in Settings</Link> so the website’s enquiry buttons work.</p>}
      {p.length === 0 && <Panel title="Get started"><ol className="steps"><li><Link to="/admin/products">Add your first product</Link> with its colours.</li><li><Link to="/admin/arrivals">Record stock received</Link> (quantity and cost).</li><li>Publish it so customers can see it.</li><li><Link to="/admin/orders">Record an order</Link> when a customer confirms on WhatsApp.</li><li><Link to="/admin/expenses">Record expenses</Link> to see profit.</li></ol></Panel>}
      <h3 className="sub">Today ({t.date})</h3>
      <div className="stats">
        <Card label="Orders recorded today" value={t.orders.created} /><Card label="Pending orders" value={t.orders.pending} /><Card label="Units sold today" value={t.units_sold} />
        <Card label="Stock received today" value={t.stock.stock_received} /><Card label="New products today" value={t.products_added} /><Card label="Low-stock items" value={t.low_stock.length} tone={t.low_stock.length ? 'warn' : ''} />
        <Card label="WhatsApp button clicks" value={t.website_activity.whatsapp_button_clicks} hint="Website activity only — not orders" /><Card label="Confirmed enquiries" value={t.business_records.confirmed_enquiries} hint="Recorded by you" />
      </div>
      <h3 className="sub">This month ({m.month})</h3>
      <div className="stats">
        <Card label="Completed orders" value={m.orders.completed} /><Card label="Units sold" value={m.units_sold} /><Card label="Recorded sales" value={money(m.recorded_sales)} hint="Net of returns" />
        <Card label="Est. gross profit" value={money(f.gross_profit)} hint="Sales minus cost of goods sold" /><Card label="Recorded expenses" value={money(f.operating_expenses)} /><Card label="Outstanding payments" value={money(m.outstanding_payments.amount)} hint={`${m.outstanding_payments.orders} order(s), as recorded`} />
      </div>
      {f.units_with_unknown_cost > 0 && <p className="alert warn">{f.units_with_unknown_cost} sold unit(s) have no recorded cost, so profit is overstated. Add costs when receiving stock.</p>}
      <Panel title="Low stock" actions={<Link to="/admin/inventory">Inventory →</Link>}>
        {t.low_stock.length ? <table><thead><tr><th>Product</th><th>Colour</th><th>Available</th><th>Alert level</th></tr></thead><tbody>{t.low_stock.map((r) => <tr key={r.variant_id}><td>{r.product}</td><td>{r.colour}</td><td>{r.available <= 0 ? <Badge s="out_of_stock" /> : r.available}</td><td>{r.min_stock}</td></tr>)}</tbody></table> : <Empty>Nothing is low on stock.</Empty>}
      </Panel>
    </div>
  );
}
