import React from 'react'

interface TableProps {
  children: React.ReactNode
  className?: string
}

const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse">
        {children}
      </table>
    </div>
  )
}

interface TableHeaderProps {
  children: React.ReactNode
  className?: string
}

const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => {
  return (
    <thead className={`bg-neutral-50 ${className}`}>
      {children}
    </thead>
  )
}

interface TableBodyProps {
  children: React.ReactNode
  className?: string
}

const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => {
  return (
    <tbody className={className}>
      {children}
    </tbody>
  )
}

interface TableRowProps {
  children: React.ReactNode
  className?: string
}

const TableRow: React.FC<TableRowProps> = ({ children, className = '' }) => {
  return (
    <tr className={`border-b border-neutral-200 hover:bg-neutral-50 ${className}`}>
      {children}
    </tr>
  )
}

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
  className?: string
}

const TableHead: React.FC<TableHeadProps> = ({ children, className = '', ...props }) => {
  return (
    <th className={`px-4 py-3 text-left text-sm font-medium text-neutral-600 ${className}`} {...props}>
      {children}
    </th>
  )
}

interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode
  className?: string
}

const TableCell: React.FC<TableCellProps> = ({ children, className = '', ...props }) => {
  return (
    <td className={`px-4 py-3 text-sm text-neutral-900 ${className}`} {...props}>
      {children}
    </td>
  )
}

// Compound component exports
export { TableHeader as Header }
export { TableBody as Body }
export { TableRow as Row }
export { TableHead as Head }
export { TableCell as Cell }

export default Table
