import { useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { useApp } from '../contexts/AppContext';
import type { Expense } from '../types';
import { formatPLN } from '../utils/format';
import { generateReport } from '../utils/report';


interface ExpenseFormData {
    description: string;
    date: string;
    price: string;
    shopName: string;
    invoiceNo: string;
    invoiceForm: 'paper' | 'gdrive';
    invoiceLink: string;
    loanApproved: boolean;
}

const emptyForm: ExpenseFormData = {
    description: '',
    date: new Date().toISOString().split('T')[0],
    price: '',
    shopName: '',
    invoiceNo: '',
    invoiceForm: 'paper',
    invoiceLink: '',
    loanApproved: false
};

export default function Finance() {
    const { state, dispatch } = useApp();
    const [modal, setModal] = useState<{ open: boolean; editExpense?: Expense }>({ open: false });
    const [form, setForm] = useState<ExpenseFormData>(emptyForm);
    const [budgetInput, setBudgetInput] = useState(String(state.budget));

    const totalApproved = state.expenses.filter(e => e.loanApproved).reduce((s, e) => s + e.price, 0);
    const totalNotApproved = state.expenses.filter(e => !e.loanApproved).reduce((s, e) => s + e.price, 0);
    const total = totalApproved + totalNotApproved;
    const remaining = state.budget - total;

    const pieData = [
        { name: 'Loan Approved', value: totalApproved },
        { name: 'Not Approved', value: totalNotApproved },
        { name: 'Remaining Budget', value: Math.max(remaining, 0) }
    ];
    const pieColors = ['#10B981', '#F59E0B', '#3B82F6'];

    // Unique shop names for autosuggest
    const shopNames = Array.from(new Set(state.expenses.map(e => e.shopName).filter(Boolean)));

    const openNew = () => {
        setForm(emptyForm);
        setModal({ open: true });
    };
    const openEdit = (e: Expense) => {
        setForm({ ...e, price: String(e.price), invoiceLink: e.invoiceLink ?? '' });
        setModal({ open: true, editExpense: e });
    };

    const save = () => {
        const price = parseFloat(form.price);
        if (!form.description.trim() || isNaN(price)) {
            return;
        }
        const data = { ...form, price, invoiceLink: form.invoiceLink === '' ? undefined : form.invoiceLink };
        if (modal.editExpense) {
            dispatch({ type: 'UPDATE_EXPENSE', payload: { ...modal.editExpense, ...data } });
        } else {
            dispatch({ type: 'ADD_EXPENSE', payload: data });
        }
        setModal({ open: false });
    };

    const del = (id: string) => {
        // eslint-disable-next-line no-alert
        if (confirm('Delete expense?')) {
            dispatch({ type: 'DELETE_EXPENSE', payload: id });
        }
    };

    const handleBudgetSave = () => {
        const b = parseFloat(budgetInput);
        if (!isNaN(b)) {
            dispatch({ type: 'SET_BUDGET', payload: b });
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-800">Finance</h1>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                    <label className="text-sm text-gray-600 whitespace-nowrap">Budget (zł):</label>
                    <input
                        type="number"
                        value={budgetInput}
                        onChange={e => {
                            setBudgetInput(e.target.value);
                        }}
                        onBlur={handleBudgetSave}
                        className="border rounded px-3 py-1 text-sm w-32 focus:outline-none focus:border-blue-400"
                    />
                    <button
                        type="button"
                        onClick={() => {
                            generateReport(state);
                        }}
                        className="bg-gray-700 text-white px-3 py-1 rounded text-sm hover:bg-gray-800"
                    >
                        📄 Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="text-sm text-gray-500">Loan Approved</div>
                    <div className="text-2xl font-bold text-green-600">{formatPLN(totalApproved)}</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="text-sm text-gray-500">Not Approved</div>
                    <div className="text-2xl font-bold text-yellow-600">{formatPLN(totalNotApproved)}</div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm border">
                    <div className="text-sm text-gray-500">Remaining Budget</div>
                    <div className={`text-2xl font-bold ${remaining >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatPLN(remaining)}</div>
                </div>
            </div>

            {total > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm border h-64">
                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                dataKey="value"
                                label={({ name, value }: { name: string; value: number }) => `${name}: ${formatPLN(value)}`}
                            >
                                {pieData.map((entry, i) => (
                                    <Cell
                                        key={entry.name}
                                        fill={pieColors[i % pieColors.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip formatter={(v: unknown) => formatPLN(Number(v))} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="font-semibold text-gray-700">Expenses</h2>
                    <button
                        type="button"
                        onClick={openNew}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                    >+ Add Expense
                    </button>
                </div>

                {/* Card view – mobile */}
                <div className="md:hidden divide-y">
                    {state.expenses.length === 0
                        && <p className="text-center text-gray-400 py-8">No expenses yet.</p>}
                    {state.expenses.map(e => (
                        <div
                            key={e.id}
                            className="p-4 space-y-1"
                        >
                            <div className="flex justify-between items-start gap-2">
                                <span className="font-medium text-gray-800">{e.description}</span>
                                <span className="font-bold text-gray-900 whitespace-nowrap">{formatPLN(e.price)}</span>
                            </div>
                            <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                                <span>📅 {e.date}</span>
                                {e.shopName && <span>🏪 {e.shopName}</span>}
                                {e.invoiceNo && <span>🧾 {e.invoiceNo}</span>}
                                <span>{e.invoiceForm === 'gdrive' && e.invoiceLink
                                    ? (
                                        <a
                                            href={e.invoiceLink}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-blue-600 underline"
                                        >GDrive
                                        </a>
                                    )
                                    : e.invoiceForm}
                                </span>
                                <span>{e.loanApproved ? <span className="text-green-600">✓ Loan</span> : <span className="text-gray-400">✗ Loan</span>}</span>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        openEdit(e);
                                    }}
                                    className="text-xs text-blue-600 hover:underline"
                                >Edit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        del(e.id);
                                    }}
                                    className="text-xs text-red-500 hover:underline"
                                >Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Table view – desktop */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                {['Description', 'Date', 'Price', 'Shop', 'Invoice No', 'Invoice', 'Loan', 'Actions'].map(h => (
                                    <th
                                        key={h}
                                        className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                                    >{h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {state.expenses.length === 0
                                && (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="text-center text-gray-400 py-8"
                                        >No expenses yet.
                                        </td>
                                    </tr>
                                )}
                            {state.expenses.map(e => (
                                <tr
                                    key={e.id}
                                    className="border-t hover:bg-gray-50"
                                >
                                    <td className="px-3 py-2">{e.description}</td>
                                    <td className="px-3 py-2">{e.date}</td>
                                    <td className="px-3 py-2 font-medium">{formatPLN(e.price)}</td>
                                    <td className="px-3 py-2">{e.shopName}</td>
                                    <td className="px-3 py-2">{e.invoiceNo}</td>
                                    <td className="px-3 py-2">
                                        {e.invoiceForm === 'gdrive' && e.invoiceLink
                                            ? (
                                                <a
                                                    href={e.invoiceLink}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-blue-600 underline"
                                                >GDrive
                                                </a>
                                            )
                                            : e.invoiceForm}
                                    </td>
                                    <td className="px-3 py-2">{e.loanApproved ? <span className="text-green-600">✓</span> : <span className="text-gray-400">✗</span>}</td>
                                    <td className="px-3 py-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                openEdit(e);
                                            }}
                                            className="text-blue-600 hover:underline mr-2"
                                        >Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                del(e.id);
                                            }}
                                            className="text-red-500 hover:underline"
                                        >Del
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {modal.open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl">
                        <h2 className="text-lg font-bold mb-4">{modal.editExpense ? 'Edit Expense' : 'New Expense'}</h2>
                        <div className="space-y-3">
                            <input
                                placeholder="Description *"
                                value={form.description}
                                onChange={e => {
                                    setForm(f => ({ ...f, description: e.target.value }));
                                }}
                                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                            />
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => {
                                        setForm(f => ({ ...f, date: e.target.value }));
                                    }}
                                    className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                                />
                                <input
                                    type="number"
                                    placeholder="Price *"
                                    value={form.price}
                                    onChange={e => {
                                        setForm(f => ({ ...f, price: e.target.value }));
                                    }}
                                    className="flex-1 border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                                />
                            </div>
                            <div>
                                <input
                                    list="shop-suggestions"
                                    placeholder="Shop name"
                                    value={form.shopName}
                                    onChange={e => {
                                        setForm(f => ({ ...f, shopName: e.target.value }));
                                    }}
                                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                                />
                                <datalist id="shop-suggestions">
                                    {shopNames.map(name => (
                                        <option
                                            key={name}
                                            value={name}
                                        />
                                    ))}
                                </datalist>
                            </div>
                            <input
                                placeholder="Invoice No"
                                value={form.invoiceNo}
                                onChange={e => {
                                    setForm(f => ({ ...f, invoiceNo: e.target.value }));
                                }}
                                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                            />
                            <div className="flex gap-2 items-center">
                                <label className="text-sm text-gray-600">Invoice form:</label>
                                <select
                                    value={form.invoiceForm}
                                    onChange={e => {
                                        const { value } = e.target;
                                        if (value === 'paper' || value === 'gdrive') {
                                            setForm(f => ({ ...f, invoiceForm: value }));
                                        }
                                    }}
                                    className="border rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                                >
                                    <option value="paper">Paper</option>
                                    <option value="gdrive">Google Drive</option>
                                </select>
                            </div>
                            {form.invoiceForm === 'gdrive'
                                && (
                                    <input
                                        placeholder="Google Drive link"
                                        value={form.invoiceLink}
                                        onChange={e => {
                                            setForm(f => ({ ...f, invoiceLink: e.target.value }));
                                        }}
                                        className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                                    />
                                )}
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.loanApproved}
                                    onChange={e => {
                                        setForm(f => ({ ...f, loanApproved: e.target.checked }));
                                    }}
                                />
                                {' '}
                                Loan Approved
                            </label>
                        </div>
                        <div className="flex gap-2 mt-4 justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setModal({ open: false });
                                }}
                                className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
                            >Cancel
                            </button>
                            <button
                                type="button"
                                onClick={save}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
