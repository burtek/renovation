import type { Expense } from '../../types';
import { cn } from '../../utils/classnames';
import { formatPLN } from '../../utils/format';


export interface ExpenseFormData {
    description: string;
    date: string;
    price: string;
    shopName: string;
    invoiceNo: string;
    invoiceForm: 'paper' | 'gdrive';
    invoiceLink: string;
    loanApproved: boolean;
}

interface Props {
    editExpense: Expense | undefined;
    form: ExpenseFormData;
    shopNames: string[];
    onFormChange: (update: Partial<ExpenseFormData>) => void;
    onSave: () => void;
    onClose: () => void;
}

export function ExpenseModal({ editExpense, form, shopNames, onFormChange, onSave, onClose }: Props) {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl">
                <h2 className="text-lg font-bold mb-4 dark:text-gray-100">{editExpense ? 'Edit Expense' : 'New Expense'}</h2>
                <div className="space-y-3">
                    <input
                        placeholder="Description *"
                        value={form.description}
                        onChange={e => {
                            onFormChange({ description: e.target.value });
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                    />
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={form.date}
                            onChange={e => {
                                onFormChange({ date: e.target.value });
                            }}
                            className="flex-1 border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                        />
                        <input
                            type="number"
                            placeholder="Price *"
                            value={form.price}
                            onChange={e => {
                                onFormChange({ price: e.target.value });
                            }}
                            className="flex-1 border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                        />
                    </div>
                    <div>
                        <input
                            list="shop-suggestions"
                            placeholder="Shop name"
                            value={form.shopName}
                            onChange={e => {
                                onFormChange({ shopName: e.target.value });
                            }}
                            className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
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
                            onFormChange({ invoiceNo: e.target.value });
                        }}
                        className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                    />
                    <div className="flex gap-2 items-center">
                        <label className="text-sm text-gray-600 dark:text-gray-400">Invoice form:</label>
                        <select
                            value={form.invoiceForm}
                            onChange={e => {
                                const { value } = e.target;
                                if (value === 'paper' || value === 'gdrive') {
                                    onFormChange({ invoiceForm: value });
                                }
                            }}
                            className="border dark:border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
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
                                    onFormChange({ invoiceLink: e.target.value });
                                }}
                                className="w-full border dark:border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white dark:bg-gray-700 dark:text-gray-100"
                            />
                        )}
                    <label className="flex items-center gap-2 text-sm dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={form.loanApproved}
                            onChange={e => {
                                onFormChange({ loanApproved: e.target.checked });
                            }}
                        />
                        {' '}
                        Loan Approved
                    </label>
                </div>
                <div className="flex gap-2 mt-4 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >Save
                    </button>
                </div>
            </div>
        </div>
    );
}

export function safeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? url : '';
    } catch {
        return '';
    }
}

type SortKey = keyof Pick<Expense, 'description' | 'date' | 'price' | 'shopName' | 'invoiceNo' | 'loanApproved'>;
type SortDir = 'asc' | 'desc';

interface SortableColumn {
    label: string;
    key: SortKey;
}
interface UnsortableColumn {
    label: string;
    key?: never;
}
type Column = SortableColumn | UnsortableColumn;

const EXPENSE_COLUMNS: Column[] = [
    { label: 'Description', key: 'description' },
    { label: 'Date', key: 'date' },
    { label: 'Price', key: 'price' },
    { label: 'Shop', key: 'shopName' },
    { label: 'Invoice No', key: 'invoiceNo' },
    { label: 'Invoice' },
    { label: 'Loan', key: 'loanApproved' },
    { label: 'Actions' }
];

interface ExpenseListProps {
    expenses: Expense[];
    sortedExpenses: Expense[];
    sortKey: SortKey;
    sortDir: SortDir;
    onToggleSort: (key: SortKey) => void;
    onEdit: (expense: Expense) => void;
    onDelete: (id: string) => void;
    onAdd: () => void;
}

export function ExpenseList({ expenses, sortedExpenses, sortKey, sortDir, onToggleSort, onEdit, onDelete, onAdd }: ExpenseListProps) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h2 className="font-semibold text-gray-700 dark:text-gray-300">Expenses</h2>
                <button
                    type="button"
                    onClick={onAdd}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                >+ Add Expense
                </button>
            </div>

            {/* Card view – mobile */}
            <div className="md:hidden divide-y dark:divide-gray-700">
                {expenses.length === 0
                    && <p className="text-center text-gray-400 dark:text-gray-500 py-8">No expenses yet.</p>}
                {sortedExpenses.map(e => (
                    <div
                        key={e.id}
                        className="p-4 space-y-1"
                    >
                        <div className="flex justify-between items-start gap-2">
                            <span className="font-medium text-gray-800 dark:text-gray-100">{e.description}</span>
                            <span className="font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">{formatPLN(e.price)}</span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                            <span>📅 {e.date}</span>
                            {e.shopName && <span>🏪 {e.shopName}</span>}
                            {e.invoiceNo && <span>🧾 {e.invoiceNo}</span>}
                            <span>{e.invoiceForm === 'gdrive' && e.invoiceLink
                                ? (() => {
                                    const url = safeUrl(e.invoiceLink);
                                    return url
                                        ? (
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 underline"
                                            >GDrive
                                            </a>
                                        )
                                        : 'GDrive (invalid link)';
                                })()
                                : e.invoiceForm}
                            </span>
                            <span>{e.loanApproved ? <span className="text-green-600">✓ Loan</span> : <span className="text-gray-400 dark:text-gray-500">✗ Loan</span>}</span>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    onEdit(e);
                                }}
                                className="text-xs text-blue-600 hover:underline"
                            >Edit
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    onDelete(e.id);
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
                <table className="w-full text-sm dark:text-gray-300">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                            {EXPENSE_COLUMNS.map(({ label, key }) => (
                                <th
                                    key={label}
                                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                                    aria-sort={key && sortKey === key
                                        ? (sortDir === 'asc' ? 'ascending' : 'descending')
                                        : undefined}
                                >
                                    {key
                                        ? (
                                            <button
                                                type="button"
                                                className={cn('cursor-pointer select-none hover:text-gray-800 dark:hover:text-gray-200')}
                                                onClick={() => {
                                                    onToggleSort(key);
                                                }}
                                            >
                                                {label}
                                                {sortKey === key
                                                    && (
                                                        <span className="ml-1">
                                                            {sortDir === 'asc' ? '↑' : '↓'}
                                                        </span>
                                                    )}
                                            </button>
                                        )
                                        : label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.length === 0
                            && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="text-center text-gray-400 dark:text-gray-500 py-8"
                                    >No expenses yet.
                                    </td>
                                </tr>
                            )}
                        {sortedExpenses.map(e => (
                            <tr
                                key={e.id}
                                className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                <td className="px-3 py-2">{e.description}</td>
                                <td className="px-3 py-2">{e.date}</td>
                                <td className="px-3 py-2 font-medium">{formatPLN(e.price)}</td>
                                <td className="px-3 py-2">{e.shopName}</td>
                                <td className="px-3 py-2">{e.invoiceNo}</td>
                                <td className="px-3 py-2">
                                    {e.invoiceForm === 'gdrive' && e.invoiceLink
                                        ? (() => {
                                            const url = safeUrl(e.invoiceLink);
                                            return url
                                                ? (
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 underline"
                                                    >GDrive
                                                    </a>
                                                )
                                                : 'GDrive (invalid link)';
                                        })()
                                        : e.invoiceForm}
                                </td>
                                <td className="px-3 py-2">{e.loanApproved ? <span className="text-green-600">✓</span> : <span className="text-gray-400 dark:text-gray-500">✗</span>}</td>
                                <td className="px-3 py-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onEdit(e);
                                        }}
                                        className="text-blue-600 hover:underline mr-2"
                                    >Edit
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onDelete(e.id);
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
    );
}
