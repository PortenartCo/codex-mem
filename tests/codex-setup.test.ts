import { describe, expect, it } from 'bun:test';
import {
  buildManagedCodexBlock,
  extractAndRemoveTopLevelKey,
  parseTomlStringArray,
  removeTomlTable,
  stripManagedCodexBlock,
  upsertCodexConfig
} from '../plugin/scripts/codex-setup.js';

const runtimePaths = {
  installRoot: '/Users/test/.claude-mem/codex',
  nodePath: '/usr/local/bin/node',
  smartInstallPath: '/Users/test/.claude-mem/codex/scripts/smart-install.js',
  bunRunnerPath: '/Users/test/.claude-mem/codex/scripts/bun-runner.js',
  workerServicePath: '/Users/test/.claude-mem/codex/scripts/worker-service.cjs',
  mcpServerPath: '/Users/test/.claude-mem/codex/scripts/mcp-server.cjs',
  notifyScriptPath: '/Users/test/.claude-mem/codex/scripts/codex-notify.js'
};

describe('codex-setup config management', () => {
  it('creates a managed block for empty config', () => {
    const result = upsertCodexConfig('', runtimePaths);

    expect(result.forwardNotifyCommand).toBeNull();
    expect(result.content).toContain('notify = ["/usr/local/bin/node", "/Users/test/.claude-mem/codex/scripts/codex-notify.js"]');
    expect(result.content).toContain('[mcp_servers.codex_mem]');
    expect(result.content).toContain('args = ["/Users/test/.claude-mem/codex/scripts/mcp-server.cjs"]');
  });

  it('preserves unrelated config when inserting the managed block', () => {
    const existing = [
      'model = "gpt-5.4"',
      '',
      '[mcp_servers.filesystem]',
      'command = "npx"',
      'args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]',
      ''
    ].join('\n');

    const result = upsertCodexConfig(existing, runtimePaths);

    expect(result.content).toContain('model = "gpt-5.4"');
    expect(result.content).toContain('[mcp_servers.filesystem]');
    expect(result.content).toContain('[mcp_servers.codex_mem]');
  });

  it('replaces an existing codex_mem table and preserves a previous notify command', () => {
    const existing = [
      'notify = ["terminal-notifier", "-title", "Codex"]',
      '',
      '[mcp_servers.codex_mem]',
      'command = "node"',
      'args = ["/old/mcp-server.cjs"]',
      '',
      '[mcp_servers.filesystem]',
      'command = "npx"',
      'args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]',
      ''
    ].join('\n');

    const result = upsertCodexConfig(existing, runtimePaths);

    expect(result.forwardNotifyCommand).toEqual(['terminal-notifier', '-title', 'Codex']);
    expect(result.content).not.toContain('/old/mcp-server.cjs');
    expect(result.content).toContain('/Users/test/.claude-mem/codex/scripts/mcp-server.cjs');
    expect(result.content).toContain('[mcp_servers.filesystem]');
  });

  it('is idempotent when re-running setup on an already managed config', () => {
    const first = upsertCodexConfig('', runtimePaths);
    const second = upsertCodexConfig(first.content, runtimePaths);

    expect(second.forwardNotifyCommand).toBeNull();
    expect(second.content).toBe(first.content);
  });

  it('throws when an existing notify setting cannot be safely preserved', () => {
    expect(() =>
      upsertCodexConfig('notify = "not-an-array"\n', runtimePaths)
    ).toThrow('could not safely preserve');
  });

  it('allows replacing an unparseable notify setting with forceNotify', () => {
    const result = upsertCodexConfig('notify = "not-an-array"\n', runtimePaths, { forceNotify: true });

    expect(result.forwardNotifyCommand).toBeNull();
    expect(result.content).toContain('codex-notify.js');
  });
});

describe('codex-setup helpers', () => {
  it('parses multiline TOML string arrays', () => {
    const parsed = parseTomlStringArray(`
notify = [
  "terminal-notifier",
  "-title",
  "Codex",
]
`);

    expect(parsed).toEqual(['terminal-notifier', '-title', 'Codex']);
  });

  it('removes a top-level key assignment and returns the raw value', () => {
    const result = extractAndRemoveTopLevelKey([
      'notify = ["terminal-notifier", "-title", "Codex"]',
      'model = "gpt-5.4"',
      '',
      '[mcp_servers.filesystem]',
      'command = "npx"',
      ''
    ].join('\n'), 'notify');

    expect(result.rawValue).toBe('notify = ["terminal-notifier", "-title", "Codex"]');
    expect(result.content).toContain('model = "gpt-5.4"');
    expect(result.content).not.toContain('notify = ');
  });

  it('removes a named TOML table without touching others', () => {
    const result = removeTomlTable([
      '[mcp_servers.codex_mem]',
      'command = "node"',
      'args = ["/old/path"]',
      '',
      '[mcp_servers.filesystem]',
      'command = "npx"',
      ''
    ].join('\n'), 'mcp_servers.codex_mem');

    expect(result).not.toContain('[mcp_servers.codex_mem]');
    expect(result).toContain('[mcp_servers.filesystem]');
  });

  it('strips an older managed block before writing a new one', () => {
    const original = [
      'model = "gpt-5.4"',
      '',
      buildManagedCodexBlock(runtimePaths),
      ''
    ].join('\n');

    const stripped = stripManagedCodexBlock(original);

    expect(stripped).toBe('model = "gpt-5.4"');
  });
});
