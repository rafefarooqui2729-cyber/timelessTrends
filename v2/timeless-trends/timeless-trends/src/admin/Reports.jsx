import React, { useState } from 'react';
import { api } from '../api.js';
import { useLoad } from '../hooks.js';
import { Bars, Card, Empty, Err, Panel, money, today } from './ui.jsx';

function FinTable({ f }) {
  const rows = [['Gross sales (completed orders)', f.gross_sales], ['− Returns refunded', f.returns_value], ['= Net sales revenue', f.net_sales_revenue, 1], ['− Cost of goods sold', f.cost_of_goods_sold], ['= Gross profit (estimate)', f.gross_profit, 1], ['− Operating expenses', f.operating_expenses], ['= Estimated operating profit', f.estimated_operating_profit, 1]];
  return <><table className="fin"><tbody>{rows.map(([l, v, b]) => <tr key={l} className={b ? 'strong' : ''}><td>{l}</td><td>{money(v)}</td></tr>)}</tbody></table>
    {f.units_with_unknown_cost > 0 && <p className="alert warn">{f.units_with_unknown_cost} sold unit(s) have no cost recorded; their cost is not included, so profit is overstated.</p>}
    <p className="muted">Estimates based only on what you recorded. Not audited accounts or tax advice. Revenue ≠ profit. Cash movement ≠ profit (stock purchases and timing of payments differ).</p>
    <div className="stats"><Card label="Cash received" value={money(f.cash.received)} /><Card label="Refunds paid" value={money(f.cash.refunds_paid)} /><Card label="Expenses paid" value={money(f.cash.expenses_paid)} /><Card label="Supplier payments" value={money(f.cash.supplier_payments)} /><Card label="Net cash movement" value={money(f.cash.net_movement)} tone="gold" /></div>
    {f.expenses_by_category.length > 0 && <><h3 className="sub">Expenses by category</h3><Bars rows={f.expenses_by_category.map((c) => ({ name: c.category, amount: c.amount }))} /></>}</>;
}

export function SalesProfit() {
  const first = `${today().slice(0, 7)}-01`; const [from, setFrom] = useState(first); const [to, setTo] = useState(today());
  const { data, error } = useLoad(() => api.get(`/api/admin/reports/range?from=${from}&to=${to}`), [from, to]);
  return <div className="page"><h1>Sales & Profit</h1><div className="filters"><label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label><button className="btn small" onClick={() => window.print()}>Print</button></div>
    <Err e={error} />{data && <><Panel title={`Revenue → profit (${from} to ${to})`}><FinTable f={data.financials} /></Panel>
      <Panel title="Inventory value (now)"><div className="stats"><Card label="Unsold inventory at cost" value={money(data.inventory_now.value_at_cost)} hint="Money invested in stock — not cash" /><Card label="Units on hand" value={data.inventory_now.units_on_hand} /></div></Panel></>}</div>;
}

export function MonthlyReports() {
  const [month, setMonth] = useState(today().slice(0, 7)); const { data: m, error } = useLoad(() => api.get(`/api/admin/reports/monthly?month=${month}`), [month]);
  return <div className="page"><h1>Monthly Reports</h1><div className="filters"><input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /><button className="btn small" onClick={() => window.print()}>Print</button>
    <a className="btn small" href="/api/admin/export/orders">Orders CSV</a><a className="btn small" href="/api/admin/export/stock-movements">Stock CSV</a><a className="btn small" href="/api/admin/export/expenses">Expenses CSV</a><a className="btn small" href="/api/admin/export/products">Products CSV</a></div><Err e={error} />
    {m && <>
      <Panel title={`Orders — ${m.month} (${m.timezone})`}><div className="stats"><Card label="WhatsApp button clicks" value={m.website_activity.whatsapp_button_clicks} hint="Website activity, not orders" /><Card label="Enquiries recorded" value={m.enquiries_recorded} /><Card label="Orders created" value={m.orders.created} /><Card label="Confirmed or later" value={m.orders.confirmed_or_later} />
        <Card label="Completed" value={m.orders.completed} /><Card label="Cancelled" value={m.orders.cancelled} /><Card label="Returned / part-returned" value={m.orders.returned_or_partly} /><Card label="Units sold" value={m.units_sold} /><Card label="Units returned" value={m.units_returned} />
        <Card label="Recorded sales (net)" value={money(m.recorded_sales)} /><Card label="Average order value" value={money(m.average_order_value)} hint="Gross sales ÷ orders completed this month" /><Card label="Outstanding payments" value={money(m.outstanding_payments.amount)} hint={`${m.outstanding_payments.orders} order(s)`} /><Card label="New products added" value={m.new_products_added} /></div>
        <p className="muted">Order counts are for orders dated in this month, by their current status. Sales are counted in the month an order was completed; returns reduce the month they were recorded.</p>
        {m.best_sellers.byProduct.length > 0 ? <><h3 className="sub">Best-selling products</h3><Bars rows={m.best_sellers.byProduct.map((r) => ({ name: r.name, amount: r.units }))} /><h3 className="sub">Best-selling variants</h3><Bars rows={m.best_sellers.byVariant.map((r) => ({ name: `${r.name} — ${r.colour}`, amount: r.units }))} /></> : <Empty>No completed sales this month yet.</Empty>}</Panel>
      <Panel title="Revenue, cost and profit"><FinTable f={m.financials} /></Panel>
      <Panel title="Stock"><div className="stats"><Card label="Opening inventory" value={m.stock.opening_stock} /><Card label="Received" value={m.stock.stock_received} /><Card label="Sold" value={m.stock.units_sold} /><Card label="Returned to sellable" value={m.stock.returns_to_sellable_stock} /><Card label="Damaged / lost" value={m.stock.damaged_or_lost_units} /><Card label="Supplier returns" value={m.stock.supplier_returns} /><Card label="Adjustments" value={m.stock.adjustments} /><Card label="Closing inventory" value={m.stock.closing_stock} tone="gold" /><Card label="Damaged customer returns (not restocked)" value={m.stock.damaged_returns_not_restocked} /></div>
        <div className="table-wrap"><table><thead><tr><th>Product</th><th>Colour</th><th>On hand</th><th>Reserved</th><th>Avg cost</th><th>Value at cost</th></tr></thead><tbody>{m.stock_by_variant.map((r) => <tr key={r.variant_id}><td>{r.product}</td><td>{r.colour}</td><td>{r.stock_on_hand}</td><td>{r.reserved}</td><td>{money(r.avg_cost)}</td><td>{money(r.value_at_cost)}</td></tr>)}</tbody></table></div>
        <p className="muted">Stock-by-colour table shows the current position, not the month-end position. Inventory value uses recorded weighted-average cost.</p></Panel>
      <Panel title="Cash, profit, inventory and savings — kept separate"><div className="stats"><Card label="Business cash balance (end of month)" value={money(m.cash_balance_end_of_month)} /><Card label="Estimated operating profit" value={money(m.financials.estimated_operating_profit)} /><Card label="Unsold inventory (at cost, now)" value={money(m.inventory_now.value_at_cost)} /><Card label="Moved to savings this month" value={money(m.financials.savings_net_transferred)} /><Card label="Savings fund balance (end of month)" value={money(m.savings_fund_balance_end_of_month)} /></div></Panel></>}</div>;
}
