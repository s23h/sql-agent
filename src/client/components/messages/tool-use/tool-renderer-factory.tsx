import type { ClaudeMessageContext } from '../types';
import { BaseToolRenderer } from './renderers/base-tool-renderer';
import { DefaultToolRenderer } from './renderers/default-tool-renderer';
import { TaskRenderer } from './renderers/task-tool-renderer';
import { TodoReadRenderer, TodoWriteRenderer } from './renderers/todo-tool-renderers';
import { WebFetchRenderer } from './renderers/webfetch-tool-renderer';
import { PlanExitRenderer } from './renderers/plan-exit-renderer';
import { SkillToolRenderer } from './renderers/skill-tool-renderer';
import {
  SqlQueryRenderer,
  PythonRenderer,
  SandboxCommandRenderer,
  SandboxWriteFileRenderer,
  SandboxReadFileRenderer,
  SandboxListFilesRenderer,
  SqlListTablesRenderer,
  SqlDescribeTableRenderer,
  PlaybookCreateRenderer,
  PlaybookUpdateRenderer,
  WorldlineCreateRenderer,
} from './renderers/sandbox-tool-renderers';

export function getToolRenderer(name: string, context: ClaudeMessageContext): BaseToolRenderer {
  switch (name) {
    // Claude Agent SDK tools
    case 'Task':
      return new TaskRenderer();
    case 'TodoRead':
      return new TodoReadRenderer();
    case 'TodoWrite':
      return new TodoWriteRenderer();
    case 'WebFetch':
      return new WebFetchRenderer(context);
    case 'ExitPlanMode':
      return new PlanExitRenderer();
    case 'Skill':
      return new SkillToolRenderer();
    // Sandbox MCP tools
    case 'mcp__sandbox__run_python':
      return new PythonRenderer();
    case 'mcp__sandbox__run_command':
      return new SandboxCommandRenderer();
    case 'mcp__sandbox__write_file':
      return new SandboxWriteFileRenderer();
    case 'mcp__sandbox__read_file':
      return new SandboxReadFileRenderer();
    case 'mcp__sandbox__list_files':
      return new SandboxListFilesRenderer();
    // SQL MCP tools
    case 'mcp__sql__query':
      return new SqlQueryRenderer();
    case 'mcp__sql__list_tables':
      return new SqlListTablesRenderer();
    case 'mcp__sql__describe_table':
      return new SqlDescribeTableRenderer();
    // Playbook MCP tools
    case 'mcp__playbooks__create_playbook':
      return new PlaybookCreateRenderer();
    case 'mcp__playbooks__update_playbook':
      return new PlaybookUpdateRenderer();
    // Worldline MCP tools
    case 'mcp__worldlines__create_worldline':
      return new WorldlineCreateRenderer();
    default:
      return new DefaultToolRenderer(name);
  }
}
