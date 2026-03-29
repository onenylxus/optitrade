import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BaseWidget } from './base-widget';

interface TableWidgetProps extends React.ComponentProps<typeof BaseWidget> {
  headers: string[];
  rows: React.ReactNode[][];
}

export function TableWidget({ headers, rows, ...props }: TableWidgetProps) {
  return (
    <BaseWidget {...props}>
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header, i) => (
              <TableHead key={i} className="text-left px-4 first:pl-0 last:pr-0">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={Math.max(headers.length, 1)}
                className="px-4 py-4 text-center text-muted-foreground first:pl-0 last:pr-0"
              >
                No data
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <TableCell key={cellIndex} className="px-4 first:pl-0 last:pr-0">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </BaseWidget>
  );
}
