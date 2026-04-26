import type { AppData } from '../types';

import { formatPLN } from './format';


export function generateReport(state: AppData): void {
    const { notes, expenses, tasks, calendarEvents, budget } = state;

    const totalApproved = expenses
        .filter(e => e.loanApproved)
        .reduce((s, e) => s + e.price, 0);
    const totalNotApproved = expenses
        .filter(e => !e.loanApproved)
        .reduce((s, e) => s + e.price, 0);
    const total = totalApproved + totalNotApproved;
    const remaining = budget - total;

    const esc = (s: string) =>
        s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const safeHref = (url: string) => {
        try {
            const parsed = new URL(url);
            return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? esc(parsed.href) : '';
        } catch {
            return '';
        }
    };

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Renovation Report</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
    h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 4px; }
    h2 { font-size: 15px; margin-top: 28px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    p.meta { color: #555; font-size: 11px; margin: 0 0 16px; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 12px 0; }
    .card { border: 1px solid #ccc; border-radius: 4px; padding: 10px; }
    .card-label { font-size: 11px; color: #666; }
    .card-value { font-size: 17px; font-weight: bold; }
    .green { color: #16a34a; }
    .yellow { color: #b45309; }
    .blue { color: #1d4ed8; }
    .red { color: #dc2626; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #f0f0f0; text-align: left; padding: 5px 8px; border: 1px solid #ccc;
         font-size: 10px; text-transform: uppercase; }
    td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; }
    tr:nth-child(even) td { background: #f9f9f9; }
    small { color: #555; }
    .note { margin-bottom: 16px; border-left: 3px solid #ccc; padding-left: 12px; }
    .note h3 { font-size: 13px; margin: 0 0 4px; }
    pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 12px; margin: 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>🏠 Renovation Report</h1>
  <p class="meta">Generated: ${new Date().toLocaleDateString('pl-PL', { dateStyle: 'long' })}</p>

  <h2>Budget summary</h2>
  <div class="summary">
    <div class="card">
      <div class="card-label">Total Budget</div>
      <div class="card-value blue">${formatPLN(budget)}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Spent</div>
      <div class="card-value">${formatPLN(total)}</div>
    </div>
    <div class="card">
      <div class="card-label">Remaining</div>
      <div class="card-value ${remaining >= 0 ? 'blue' : 'red'}">${formatPLN(remaining)}</div>
    </div>
    <div class="card">
      <div class="card-label">Loan Approved</div>
      <div class="card-value green">${formatPLN(totalApproved)}</div>
    </div>
    <div class="card">
      <div class="card-label">Not Approved</div>
      <div class="card-value yellow">${formatPLN(totalNotApproved)}</div>
    </div>
  </div>

  <h2>Expenses (${expenses.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Description</th><th>Date</th><th>Price</th><th>Shop</th>
        <th>Invoice No</th><th>Invoice</th><th>Payment</th><th>Loan</th>
      </tr>
    </thead>
    <tbody>
      ${
            expenses.length === 0
                ? '<tr><td colspan="8" style="text-align:center;color:#999">No expenses.</td></tr>'
                : expenses
                    .map(
                        e => `<tr>
        <td>${esc(e.description)}</td>
        <td>${esc(e.date)}</td>
        <td>${formatPLN(e.price)}</td>
        <td>${esc(e.shopName === '' ? '—' : e.shopName)}</td>
        <td>${esc(e.invoiceNo === '' ? '—' : e.invoiceNo)}</td>
        <td>${(() => {
            if (e.invoiceForm === 'gdrive' && e.invoiceLink) {
                const href = safeHref(e.invoiceLink);
                return href ? `<a href="${href}" rel="noopener noreferrer">GDrive</a>` : 'GDrive (invalid link)';
            }
            return esc(e.invoiceForm);
        })()}</td>
        <td>${(() => {
            if (e.paymentConfirmationLink) {
                const href = safeHref(e.paymentConfirmationLink);
                return href ? `<a href="${href}" rel="noopener noreferrer">GDrive</a>` : 'GDrive (invalid link)';
            }
            return '—';
        })()}</td>
        <td>${e.loanApproved ? '✓' : '✗'}</td>
      </tr>`
                    )
                    .join('')
        }
    </tbody>
  </table>

  <h2>Tasks (${tasks.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Task</th><th>Start</th><th>End</th><th>Assignee</th><th>Status</th><th>Subtasks</th>
      </tr>
    </thead>
    <tbody>
      ${
            tasks.length === 0
                ? '<tr><td colspan="6" style="text-align:center;color:#999">No tasks.</td></tr>'
                : tasks
                    .map(
                        t => `<tr>
        <td>${esc(t.title)}${t.notes ? `<br><small>${esc(t.notes)}</small>` : ''}</td>
        <td>${esc(t.startDate !== '' && t.startDate ? t.startDate : '—')}</td>
        <td>${esc(t.endDate !== '' && t.endDate ? t.endDate : '—')}</td>
        <td>${esc(t.assignee !== '' && t.assignee ? t.assignee : '—')}</td>
        <td>${t.completed ? '✓ Done' : 'In progress'}</td>
        <td>${
            t.subtasks.length > 0
                ? t.subtasks
                    .map(s => `${esc(s.title)} (${s.completed ? '✓' : '○'})`)
                    .join('<br>')
                : '—'
        }</td>
      </tr>`
                    )
                    .join('')
        }
    </tbody>
  </table>

  <h2>Calendar events (${calendarEvents.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Title</th><th>Start</th><th>End</th><th>Contractor</th><th>Work Type</th><th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${
            calendarEvents.length === 0
                ? '<tr><td colspan="6" style="text-align:center;color:#999">No events.</td></tr>'
                : calendarEvents
                    .map(
                        e => `<tr>
        <td>${esc(e.title)}</td>
        <td>${esc(e.date)}</td>
        <td>${esc(e.endDate !== '' && e.endDate ? e.endDate : e.date)}</td>
        <td>${esc(e.contractor !== '' && e.contractor ? e.contractor : '—')}</td>
        <td>${esc(e.eventType)}</td>
        <td>${esc(e.notes !== '' && e.notes ? e.notes : '—')}</td>
      </tr>`
                    )
                    .join('')
        }
    </tbody>
  </table>

  <h2>Notes (${notes.length})</h2>
  ${
        notes.length === 0
            ? '<p style="color:#999">No notes.</p>'
            : notes
                .map(
                    n => `<div class="note">
    <h3>${esc(n.title)}</h3>
    <pre>${esc(n.content)}</pre>
  </div>`
                )
                .join('')
    }
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
    }
}
