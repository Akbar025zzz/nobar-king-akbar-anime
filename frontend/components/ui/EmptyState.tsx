import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div
      className={`panel flex flex-col items-center justify-center rounded-3xl text-center ${
        compact ? "gap-2 px-6 py-10" : "gap-3 px-6 py-16"
      }`}
    >
      {icon ? <div className="mb-1 text-accent-400">{icon}</div> : null}
      <h3 className="text-base font-semibold text-fog-100">{title}</h3>
      {description ? <p className="max-w-md text-sm leading-relaxed text-fog-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
