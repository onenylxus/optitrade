# Slash Commands Feature

## Overview

The chatbot now supports slash commands - quick shortcuts for frequently-used prompts. Type a command starting with `/` to save time and ensure consistent prompt formatting.

## Available Commands

### `/analyze`
**Expands to:** "Please provide a detailed analysis of the stock including technical indicators, fundamentals, and market sentiment."

**Use case:** When you want a comprehensive stock analysis

**Example:**
1. Type `/analyze` in the chat input
2. Press Space or Enter
3. The command expands to the full prompt
4. Continue typing or send immediately

---

### `/portfolio`
**Expands to:** "Show me a summary of my portfolio performance, including gains/losses and recommendations."

**Use case:** Quick portfolio overview and performance check

---

### `/news`
**Expands to:** "What are the latest market news and how might they affect my investments?"

**Use case:** Stay updated on market-moving news

---

### `/compare`
**Expands to:** "Compare the following stocks across key metrics and provide investment recommendations."

**Use case:** Side-by-side stock comparison

**Tip:** After the command expands, add the stock symbols you want to compare

---

### `/help`
**Special command:** Displays a formatted list of all available slash commands

**Use case:** Discover available commands or remind yourself of shortcuts

---

## How to Use

### Method 1: Using the Dropdown Menu
1. Type `/` in the chat input
2. A dropdown menu appears showing all available commands with descriptions
3. Use **Arrow Up/Down** to navigate through commands
4. Press **Enter** or **Tab** to select a command
5. The command expands to its full prompt
6. Add additional context if needed and send

### Method 2: Direct Command Entry
1. Type a complete slash command (e.g., `/analyze`)
2. Press **Space** to expand and continue typing
3. Or press **Enter** to expand and send immediately

### Method 3: Click to Select
1. Type `/` to open the dropdown menu
2. Click on any command to select it
3. The command expands automatically

### Visual Feedback
When you type `/`, you'll see:
- **Dropdown menu** with all available commands
- **Command descriptions** to help you choose
- **Keyboard shortcuts** at the bottom of the menu
- **Highlighted selection** showing which command is active

The menu filters as you type more characters (e.g., `/ana` shows only `/analyze`).

## Features

- **Interactive Dropdown Menu:** Shows all available commands when you type `/`
- **Command Descriptions:** Each command displays a helpful description
- **Keyboard Navigation:** Use arrow keys, Tab, and Enter to navigate
- **Auto-filtering:** Menu filters as you type more characters
- **Click to Select:** Mouse support for selecting commands
- **Context-aware:** Works seamlessly with widget context tags
- **Non-intrusive:** Regular messages aren't affected
- **Extensible:** Easy to add new commands in the future

## Technical Details

### Implementation Files
- **Configuration:** `/apps/frontend/lib/slash-commands.ts`
- **Integration:** `/apps/frontend/components/home/chat-panel.tsx`

### Adding New Commands
To add a new slash command, edit `/apps/frontend/lib/slash-commands.ts`:

```typescript
{
  command: '/yourcommand',
  description: 'Brief description',
  prompt: 'The full prompt text that will be sent',
}
```

## Tips

1. **Just type `/`** to see all available commands in the dropdown menu
2. **Use arrow keys** to quickly navigate through commands
3. **Filter as you type** - Type `/ana` to narrow down to `/analyze`
4. **Combine with context** - Slash commands work with widget context tags
5. **Edit after expansion** - Commands expand with a trailing space for easy editing
6. **Press Escape** to close the dropdown menu without selecting
7. **Mouse or keyboard** - Use whichever input method you prefer

## Examples

### Example 1: Using the Dropdown Menu
```
User types: /
Dropdown appears: Shows all 5 commands with descriptions
User presses: Arrow Down (twice to select /portfolio)
User presses: Enter
Input becomes: "Show me a summary of my portfolio performance, including gains/losses and recommendations. "
User presses: Enter to send
```

### Example 2: Quick Analysis with Filtering
```
User types: /ana
Dropdown filters: Shows only /analyze
User presses: Enter
Input becomes: "Please provide a detailed analysis of the stock including technical indicators, fundamentals, and market sentiment. "
User adds: "for AAPL"
User presses: Enter
```

### Example 3: Immediate Send
```
User types: /news
User presses: Enter
Message sent: "What are the latest market news and how might they affect my investments?"
```

### Example 4: Stock Comparison
```
User types: /compare
User presses: Space
Input becomes: "Compare the following stocks across key metrics and provide investment recommendations. "
User adds: "AAPL vs MSFT vs GOOGL"
User presses: Enter
```

## Troubleshooting

**Q: My command isn't being recognized**
- Ensure you're typing the exact command (lowercase, no spaces)
- Check that you've typed the complete command before pressing Space/Enter
- Valid commands: `/analyze`, `/portfolio`, `/news`, `/compare`, `/help`

**Q: Can I create custom commands?**
- Currently, commands are predefined in the configuration
- To add custom commands, edit the source code as described in "Adding New Commands"

**Q: What if I want to send a message starting with "/"?**
- If your text doesn't match a defined command, it will be sent as-is
- Example: "/my custom text" will send normally if it's not a recognized command
