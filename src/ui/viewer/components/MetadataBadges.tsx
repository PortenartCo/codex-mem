import React from 'react';

interface MetadataBadgesProps {
  platform?: string;
  clientKind?: string;
  captureMode?: string;
  gitBranch?: string | null;
  agentRole?: string | null;
}

function formatLabel(value: string): string {
  return value.replace(/-/g, ' ');
}

function renderBadge(label: string, value: string) {
  return (
    <span
      key={`${label}:${value}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '999px',
        border: '1px solid var(--color-border, rgba(0, 0, 0, 0.08))',
        background: 'var(--color-bg-secondary, rgba(0, 0, 0, 0.03))',
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}
    >
      <span style={{ opacity: 0.55 }}>{label}</span>
      <span>{formatLabel(value)}</span>
    </span>
  );
}

export function MetadataBadges({
  platform,
  clientKind,
  captureMode,
  gitBranch,
  agentRole
}: MetadataBadgesProps) {
  const entries: Array<{ label: string; value: string }> = [];

  if (platform) entries.push({ label: 'platform', value: platform });
  if (clientKind) entries.push({ label: 'client', value: clientKind });
  if (captureMode) entries.push({ label: 'capture', value: captureMode });
  if (gitBranch) entries.push({ label: 'branch', value: gitBranch });
  if (agentRole) entries.push({ label: 'role', value: agentRole });

  if (entries.length === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
      {entries.map(entry => renderBadge(entry.label, entry.value))}
    </div>
  );
}
