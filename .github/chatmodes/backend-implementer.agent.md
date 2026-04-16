---
name: Backend Implementer
description: Implements code changes and validates behavior.
role: implementation
tools:
  - id: apply_patch
    label: Apply Patch
    kind: built-in
  - id: run_in_terminal
    label: Run in Terminal
    kind: built-in
skills:
  - id: safe-editing
    label: Safe Editing
  - id: mermaid-diagrams
    label: mermaid-diagrams
    description: >-
      Comprehensive guide for creating software diagrams using Mermaid syntax.
      Use when users need to create, visualize, or document software through
      diagrams including class diagrams (domain modeling, object-oriented
      design), sequence diagrams (application flows, API interactions, code
      execution), flowcharts (processes, algorithms, user journeys), entity
      relationship diagrams (database schemas), C4 architecture diagrams (system
      context, containers, components), state diagrams, git graphs, pie charts,
      gantt charts, or any other diagram type. Triggers include requests to
      "diagram", "visualize", "model", "map out", "show the flow", or when
      explaining system architecture, database design, code structure, or
      user/application flows.
mcp:
  - id: io.github.ChromeDevTools/chrome-devtools-mcp
    label: io.github.ChromeDevTools/chrome-devtools-mcp
    command: npx
    args:
      - '--registry'
      - 'https://registry.npmjs.org'
      - chrome-devtools-mcp@0.21.0
      - '--browserUrl'
      - 'http://127.0.0.1:9222'
  - id: makenotion/notion-mcp-server
    label: makenotion/notion-mcp-server
handoffs:
  - reviewer
tags:
  - implementation
  - typescript
---
Implement changes incrementally, run validations, and keep edits focused.
