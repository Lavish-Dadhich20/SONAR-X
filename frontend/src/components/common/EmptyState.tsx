import React from "react";
import { Radio, LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon: Icon = Radio,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border border-dashed border-sonar-border rounded-xl bg-sonar-card/30">
      <div className="relative w-16 h-16 rounded-full bg-sonar-card border border-sonar-border flex items-center justify-center mb-4 overflow-hidden">
        {/* Subtle sonar ping rings */}
        <div className="absolute inset-0 rounded-full border border-sonar-cyan/20 animate-ping opacity-30" />
        <Icon className="w-7 h-7 text-sonar-muted" />
      </div>
      <h3 className="text-base font-semibold text-white tracking-wide">{title}</h3>
      <p className="text-xs text-sonar-muted max-w-sm mt-1 mb-5 leading-relaxed">
        {description}
      </p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-md bg-sonar-cyan text-sonar-bg hover:bg-cyan-400 text-xs font-semibold tracking-wide transition shadow-sm"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
