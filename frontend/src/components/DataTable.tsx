import {
  columnFilteringFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  flexRender,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  type ColumnDef,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { useState } from "react";
import { Button, Card, Input } from "./ui";

const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric },
});

export type DataTableColumnDef<TData extends object> = ColumnDef<
  typeof dataTableFeatures,
  TData,
  unknown
>;

interface DataTableProps<TData extends object> {
  data: TData[];
  columns: DataTableColumnDef<TData>[];
  searchPlaceholder?: string;
  pageSize?: number;
}

// Adapted from HextaUI Basic Data Table on 21st.dev.
export function DataTable<TData extends object>({
  data,
  columns,
  searchPlaceholder = "Cari data",
  pageSize = 8,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: { sorting, globalFilter },
    initialState: { pagination: { pageIndex: 0, pageSize } },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);

  return (
    <div className="smart-table">
      <div className="smart-table-toolbar">
        <div className="search-input">
          <Search aria-hidden="true" />
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
        </div>
        <span>{filteredCount} data</span>
      </div>
      <Card className="data-table-wrap">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="sortable-heading"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown />
                        ) : (
                          <ChevronsUpDown />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getPaginatedRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredCount && (
          <div className="table-empty">Tidak ada data yang sesuai.</div>
        )}
      </Card>
      <div className="smart-table-pagination">
        <span>
          Halaman {table.state.pagination.pageIndex + 1} dari {pageCount}
        </span>
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Sebelumnya
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  );
}
