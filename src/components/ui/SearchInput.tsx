import { Search } from 'lucide-react'

interface SearchInputProps {
  placeholder: string
  className?: string
}

export function SearchInput({ placeholder, className = '' }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        role="searchbox"
        aria-label={placeholder}
        placeholder={placeholder}
        className="h-10 w-full rounded-(--radius-control) border border-slate-200 bg-slate-50 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white"
      />
    </div>
  )
}
