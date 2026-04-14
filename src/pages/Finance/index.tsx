import { useEffect, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { useApp } from '../../contexts/AppContext';
import type { Expense } from '../../types';
import { cn } from '../../utils/classnames';
import { formatPLN } from '../../utils/format';
import { generateReport } from '../../utils/report';

import type { ExpenseFormData } from './ExpenseModal';
import { ExpenseList, ExpenseModal } from './ExpenseModal';


type SortKey = keyof Pick<Expense, 'description' | 'date' | 'price' | 'shopName' | 'invoiceNo' | 'loanApproved'>;
type SortDir = 'asc' | 'desc';

function todayLocalDate(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
}

const emptyForm: ExpenseFormData = {
    description: '',
    date: '',
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
    const [form, setForm] = useState(emptyForm);
    const [budgetInput, setBudgetInput] = useState(String(state.budget));
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    useEffect(() => {
        document.title = 'Finance | Renovation';
    }, []);

    useEffect(() => {
        // eslint-disable-next-line @eslint-react/set-state-in-effect
        setBudgetInput(String(state.budget));
    }, [state.budget]);

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

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortedExpenses = [...state.expenses].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        let cmp: number;
        if (typeof av === 'boolean' && typeof bv === 'boolean') {
            cmp = Number(av) - Number(bv);
        } else if (typeof av === 'number' && typeof bv === 'number') {
            cmp = av - bv;
        } else {
            cmp = String(av).localeCompare(String(bv));
        }
        return sortDir === 'asc' ? cmp : -cmp;
    });

    const openNew = () => {
        setForm({ ...emptyForm, date: todayLocalDate() });
        setModal({ open: true });
    };
    const openEdit = (e: Expense) => {
        setForm({
            description: e.description,
            date: e.date,
            price: String(e.price),
            shopName: e.shopName,
            invoiceNo: e.invoiceNo,
            invoiceForm: e.invoiceForm,
            invoiceLink: e.invoiceLink ?? '',
            loanApproved: e.loanApproved
        });
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
                <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Finance</h1>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                    <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">Budget (zł):</label>
                    <input
                        type="number"
                        value={budgetInput}
                        onChange={e => {
                            setBudgetInput(e.target.value);
                        }}
                        onBlur={handleBudgetSave}
                        className="border dark:border-gray-600 rounded px-3 py-1 text-sm w-32 focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
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
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Loan Approved</div>
                    <div className="text-2xl font-bold text-green-600">{formatPLN(totalApproved)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Not Approved</div>
                    <div className="text-2xl font-bold text-yellow-600">{formatPLN(totalNotApproved)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">Remaining Budget</div>
                    <div className={cn('text-2xl font-bold', remaining >= 0 ? 'text-blue-600' : 'text-red-600')}>{formatPLN(remaining)}</div>
                </div>
            </div>

            {total > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border dark:border-gray-700 h-64">
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

            <ExpenseList
                expenses={state.expenses}
                sortedExpenses={sortedExpenses}
                sortKey={sortKey}
                sortDir={sortDir}
                onToggleSort={toggleSort}
                onEdit={openEdit}
                onDelete={del}
                onAdd={openNew}
            />

            {modal.open && (
                <ExpenseModal
                    editExpense={modal.editExpense}
                    form={form}
                    shopNames={shopNames}
                    onFormChange={update => {
                        setForm(f => ({ ...f, ...update }));
                    }}
                    onSave={save}
                    onClose={() => {
                        setModal({ open: false });
                    }}
                />
            )}
        </div>
    );
}
