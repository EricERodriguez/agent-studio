# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

- Add multi-AI agent generation: export any agent to Claude Code (`.claude/agents`), OpenAI Codex (`AGENTS.md`), or Google Antigravity (`.antigravity/agents`) from one canonical definition.
- Add a "✨ All AIs" option to generate an agent for every supported provider in one step, available when creating an agent and via the new **Agent Studio: Export Agent for Claude, Codex or Antigravity** command.
- Discover globally installed Claude Code subagents from `~/.claude/agents/*.md` alongside repository and Agent Studio global agents (toggle via `agentStudio.includeClaudeAgents`); both repository and global agents are fully editable from Agent Builder.
- Show a `Repo`/`Global` scope badge on the dashboard's agent picker, search results, and Inspector panel, plus a scope filter in Capability Filters.
- Surface a visible warning (Inspector panel, Agents tree tooltip, console) when two agent files resolve to the same agent id instead of silently dropping one.
- Export global-scoped agents to the matching global location for Claude Code and Antigravity (`~/.claude/agents`, `~/.antigravity/agents`); Codex export is skipped for global agents with an explanation, since Codex has no global agents convention.

## [0.1.0] - 2026-04-11

- Initial public-ready package and repository layout
- Add activity bar, views, commands and dashboard webview
