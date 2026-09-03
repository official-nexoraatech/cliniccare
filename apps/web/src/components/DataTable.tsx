import { useState } from 'react';
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { SearchBox } from './SearchBox';
import {
  tableBodyClass,
  tableCellClass,
  tableClass,
  tableHeaderCellClass,
  tableHeaderClass,
  tableRowClass,
  tableShellClass,
} from './tableStyles';

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  searchable?: boolean;
  pageSize?: number;
  /** Rows-per-page choices offered in the footer selector. Defaults to 10/20/50/100. */
  pageSizeOptions?: number[];
  /** Set false when the page already paginates server-side and renders its own pagination footer (see PatientListPage). */
  showPagination?: boolean;
  emptyMessage?: string;
}

type ColumnMeta = {
  align?: 'left' | 'center' | 'right';
};

function alignmentClass(align: ColumnMeta['align']) {
  if (align === 'center') return 'justify-center text-center';
  if (align === 'right') return 'justify-end text-right';
  return 'justify-start text-left';
}

function textAlignmentClass(align: ColumnMeta['align']) {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  return 'text-left';
}

function sortAriaValue(sort: false | 'asc' | 'desc') {
  if (sort === 'asc') return 'ascending';
  if (sort === 'desc') return 'descending';
  return 'none';
}

function SortIcon({ sort }: { sort: false | 'asc' | 'desc' }) {
  if (sort === 'asc') return <ChevronUp className="h-4 w-4 flex-none text-white" />;
  if (sort === 'desc') return <ChevronDown className="h-4 w-4 flex-none text-white" />;
  return <ChevronsUpDown className="h-3.5 w-3.5 flex-none text-white/75" />;
}

export function DataTable<TData>({
  columns,
  data,
  searchable = true,
  pageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showPagination = true,
  emptyMessage = 'No records found.',
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, pagination },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <SearchBox
          placeholder="Search this list..."
          onSearch={setGlobalFilter}
          className="max-w-sm"
        />
      )}

      <div className={tableShellClass}>
        <table className={tableClass}>
          <thead className={tableHeaderClass}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const align = (header.column.columnDef.meta as ColumnMeta | undefined)?.align;
                  const sort = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();

                  return (
                    <th
                      key={header.id}
                      aria-sort={canSort ? sortAriaValue(sort) : undefined}
                      className={`${tableHeaderCellClass} ${alignmentClass(align)}`}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className={`flex w-full items-center gap-1.5 font-semibold text-white ${alignmentClass(align)}`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <SortIcon sort={sort} />
                        </button>
                      ) : (
                        <span className={`flex w-full items-center font-semibold text-white ${alignmentClass(align)}`}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className={tableBodyClass}>
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={tableRowClass}>
                {row.getVisibleCells().map((cell) => {
                  const align = (cell.column.columnDef.meta as ColumnMeta | undefined)?.align;

                  return (
                    <td key={cell.id} className={`${tableCellClass} ${textAlignmentClass(align)}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-3">
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
            </span>
            <label className="flex items-center gap-1.5">
              Rows per page
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-2 py-1 text-sm"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
