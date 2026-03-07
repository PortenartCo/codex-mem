import React from 'react';
import { UserPrompt } from '../types';
import { formatDate } from '../utils/formatters';
import { MetadataBadges } from './MetadataBadges';

interface PromptCardProps {
  prompt: UserPrompt;
}

export function PromptCard({ prompt }: PromptCardProps) {
  const date = formatDate(prompt.created_at_epoch);

  return (
    <div className="card prompt-card">
      <div className="card-header">
        <div className="card-header-left">
          <span className="card-type">Prompt</span>
          <span className="card-project">{prompt.project}</span>
        </div>
      </div>
      <MetadataBadges
        platform={prompt.platform}
        clientKind={prompt.client_kind}
        captureMode={prompt.capture_mode}
        gitBranch={prompt.git_branch}
        agentRole={prompt.agent_role}
      />
      <div className="card-content">
        {prompt.prompt_text}
      </div>
      <div className="card-meta">
        <span className="meta-date">#{prompt.id} • {date}</span>
      </div>
    </div>
  );
}
