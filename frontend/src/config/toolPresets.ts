export interface ToolInfo {
  name: string;
  description: string;
  category: 'file' | 'search' | 'system' | 'web';
}

export interface ToolPreset {
  id: string;
  label: string;
  description: string;
  tools: string[] | null; // null = all tools (no restriction)
}

export const CLAUDE_CODE_TOOLS: ToolInfo[] = [
  // File Operations
  { name: 'Read', description: 'Read file contents', category: 'file' },
  { name: 'Write', description: 'Create or overwrite files', category: 'file' },
  { name: 'Edit', description: 'Edit existing files', category: 'file' },
  { name: 'NotebookEdit', description: 'Edit Jupyter notebooks', category: 'file' },

  // Search
  { name: 'Glob', description: 'Find files by pattern', category: 'search' },
  { name: 'Grep', description: 'Search file contents', category: 'search' },

  // System
  { name: 'Bash', description: 'Execute shell commands', category: 'system' },
  { name: 'Agent', description: 'Launch sub-agents', category: 'system' },

  // Web
  { name: 'WebFetch', description: 'Fetch web content', category: 'web' },
  { name: 'WebSearch', description: 'Search the web', category: 'web' },
];

export const TOOL_PRESETS: ToolPreset[] = [
  {
    id: 'full',
    label: 'Full Access',
    description: 'All tools available (no restrictions)',
    tools: null,
  },
  {
    id: 'read-only',
    label: 'Read Only',
    description: 'Can read and search but not modify files',
    tools: ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
  },
  {
    id: 'read-write',
    label: 'Read & Write',
    description: 'File operations and search, no shell access',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'NotebookEdit'],
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Select individual tools',
    tools: null, // Custom selection managed by component
  },
];

export function getPresetById(id: string): ToolPreset | undefined {
  return TOOL_PRESETS.find(preset => preset.id === id);
}

export function getToolsByCategory(category: string): ToolInfo[] {
  return CLAUDE_CODE_TOOLS.filter(tool => tool.category === category);
}

export function matchPreset(tools: string[] | undefined): string {
  // undefined means no restriction = full access
  if (tools === undefined) {
    return 'full';
  }

  // Check against each non-custom preset with a defined tool list
  for (const preset of TOOL_PRESETS) {
    if (preset.id === 'custom' || preset.tools === null) continue;

    const presetTools = [...preset.tools].sort();
    const inputTools = [...tools].sort();

    if (
      presetTools.length === inputTools.length &&
      presetTools.every((t, i) => t === inputTools[i])
    ) {
      return preset.id;
    }
  }

  return 'custom';
}
