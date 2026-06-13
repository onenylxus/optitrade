export interface SlashCommand {
  command: string;
  description: string;
  prompt: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    command: '/analyze',
    description: 'Analyze a stock with technical indicators and fundamentals',
    prompt:
      'Please provide a detailed analysis of the stock including technical indicators, fundamentals, and market sentiment.',
  },
  {
    command: '/portfolio',
    description: 'Get portfolio performance summary',
    prompt:
      'Show me a summary of my portfolio performance, including gains/losses and recommendations.',
  },
  {
    command: '/news',
    description: 'Get latest market news',
    prompt: 'What are the latest market news and how might they affect my investments?',
  },
  {
    command: '/compare',
    description: 'Compare stocks across key metrics',
    prompt:
      'Compare the following stocks across key metrics and provide investment recommendations.',
  },
  {
    command: '/help',
    description: 'Show all available slash commands',
    prompt: '', // Special handling in component
  },
];

export function detectSlashCommand(input: string): SlashCommand | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^\/(\w+)$/);
  
  if (!match) return null;
  
  const commandText = `/${match[1]}`;
  return SLASH_COMMANDS.find((cmd) => cmd.command === commandText) || null;
}

export function getHelpMessage(): string {
  return `**Available Slash Commands:**\n\n${SLASH_COMMANDS.map(
    (cmd) => `• **${cmd.command}** - ${cmd.description}`
  ).join('\n')}\n\nType any command followed by space or Enter to use it.`;
}

export function expandSlashCommand(input: string): string | null {
  const command = detectSlashCommand(input);
  
  if (!command) return null;
  
  if (command.command === '/help') {
    return getHelpMessage();
  }
  
  return command.prompt;
}

export function getFilteredCommands(input: string): SlashCommand[] {
  const trimmed = input.trim();
  
  if (!trimmed.startsWith('/')) {
    return [];
  }
  
  if (trimmed === '/') {
    return SLASH_COMMANDS;
  }
  
  const searchTerm = trimmed.toLowerCase();
  return SLASH_COMMANDS.filter((cmd) => cmd.command.toLowerCase().startsWith(searchTerm));
}
