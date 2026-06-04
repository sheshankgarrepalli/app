import { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  accent?: 'accent' | 'success' | 'destructive' | 'warning' | 'info' | 'purple' | 'orange' | 'teal';
  emphasis?: boolean;
  sublabel?: string;
}

const ACCENT_COLORS: Record<NonNullable<MetricCardProps['accent']>, string> = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  destructive: 'var(--destructive)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  purple: 'var(--purple)',
  orange: 'var(--orange)',
  teal: '#0F766E',
};

const TEXT_COLORS: Record<NonNullable<MetricCardProps['accent']>, string> = {
  accent: 'var(--accent)',
  success: 'var(--success)',
  destructive: 'var(--destructive)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  purple: 'var(--purple)',
  orange: 'var(--orange)',
  teal: '#0F766E',
};

export default function MetricCard({ label, value, accent, emphasis, sublabel }: MetricCardProps) {
  const valueColor = accent ? TEXT_COLORS[accent] : undefined;
  const borderStyle = emphasis && accent ? { borderLeft: `4px solid ${ACCENT_COLORS[accent]}` } : undefined;

  return (
    <div className="kpi-card" style={borderStyle}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </div>
      {sublabel && <div className="kpi-sublabel">{sublabel}</div>}
    </div>
  );
}
