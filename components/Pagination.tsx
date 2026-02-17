import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalCount,
  pageSize,
  onPageChange,
  className = '',
}) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className={`flex items-center justify-between gap-4 mt-6 ${className}`}>
      <button
        disabled={currentPage === 0}
        onClick={() => onPageChange(currentPage - 1)}
        className="min-w-[44px] min-h-[44px] px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-zinc-400 font-black text-xs uppercase tracking-wider hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        Prev
      </button>
      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">
        Page {currentPage + 1} of {totalPages}
        <span className="text-zinc-600 ml-2">({totalCount})</span>
      </span>
      <button
        disabled={currentPage >= totalPages - 1}
        onClick={() => onPageChange(currentPage + 1)}
        className="min-w-[44px] min-h-[44px] px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-zinc-400 font-black text-xs uppercase tracking-wider hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
