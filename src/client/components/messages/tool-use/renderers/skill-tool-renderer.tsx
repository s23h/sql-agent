import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { ToolResultContentBlock } from '@claude-agent-kit/messages';
import type { ClaudeMessageContext } from '../../types';
import { BaseToolRenderer } from './base-tool-renderer';
import { isNonEmptyRecord, type ToolInput } from './utils';

export class SkillToolRenderer extends BaseToolRenderer {
  constructor() {
    super('Skill');
  }

  header(_context: ClaudeMessageContext, input: ToolInput): ReactNode {
    // Extract skill name from input
    const skillName = isNonEmptyRecord(input)
      ? String(input.skill ?? input.name ?? 'skill')
      : 'skill';

    return (
      <span className="inline-flex items-center gap-2">
        <Sparkles className="size-4 text-emerald-500" />
        <span className="font-medium">Skill</span>
        <span className="text-muted-foreground">{skillName}</span>
      </span>
    );
  }

  // Hide everything - no body, no input, no output
  body(
    _context: ClaudeMessageContext,
    _input: ToolInput,
    _result: ToolResultContentBlock | undefined,
  ): ReactNode {
    return null;
  }

  // Override to hide input parameters
  protected renderInput(): ReactNode | undefined {
    return undefined;
  }

  // Override to hide output/result
  protected renderOutput(): ReactNode | undefined {
    return undefined;
  }
}
