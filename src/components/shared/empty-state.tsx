import { Package } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  heading: string;
  subtext: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, heading, subtext, action }: EmptyStateProps) {
  return (
    <div className="py-16 flex flex-col items-center gap-4 text-center">
      <div className="w-16 h-16 rounded-full bg-bg-elevated flex items-center justify-center mb-2">
        {icon ?? (
          <Package className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <h3 className="text-lg font-semibold text-foreground">{heading}</h3>

      <p className="text-sm text-muted-foreground max-w-xs">{subtext}</p>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 transition-opacity text-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
