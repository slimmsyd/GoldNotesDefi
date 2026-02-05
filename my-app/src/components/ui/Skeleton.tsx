/**
 * Skeleton Component
 * GoldBack Design System - Phase 3 Polish
 *
 * Consistent loading state patterns
 */

interface SkeletonProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  width?: string;
}

const sizeClasses = {
  sm: 'h-4 w-16',
  md: 'h-6 w-24',
  lg: 'h-8 w-32',
  xl: 'h-12 w-48',
};

export function Skeleton({ size = 'md', className = '', width }: SkeletonProps) {
  return (
    <div
      className={`bg-gray-800 rounded animate-pulse ${sizeClasses[size]} ${className}`}
      style={width ? { width } : undefined}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-2xl p-6 ${className}`}>
      <div className="flex items-start gap-4">
        <Skeleton size="xl" className="w-12 h-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton size="md" width="60%" />
          <Skeleton size="sm" width="80%" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {[...Array(lines)].map((_, i) => (
        <Skeleton
          key={i}
          size="sm"
          className="h-4"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
}
