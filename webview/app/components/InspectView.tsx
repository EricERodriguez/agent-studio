import React, { useState } from "react";
import { useStudioStore, selectors } from "../store/useStudioStore";
import { useI18n } from "../i18n";
import { roleColor } from "../utils/roleColor";

type CapKind = "tool" | "skill" | "mcp";

export function InspectView(): React.JSX.Element {
  const { tx } = useI18n();
  const agent = useStudioStore(selectors.selectedAgent);
  const agents = useStudioStore((s) => s.agents);
  const workflows = useStudioStore((s) => s.workflows);
  const capabilityGraph = useStudioStore((s) => s.capabilityGraph);
  const selectAgent = useStudioStore((s) => s.selectAgent);
  const setCenterView = useStudioStore((s) => s.setCenterView);
  const setGraphMode = useStudioStore((s) => s.setGraphMode);
  const selectWorkflow = useStudioStore((s) => s.selectWorkflow);

  const [selectedCap, setSelectedCap] = useState<{ id: string; kind: CapKind } | null>(null);

  if (!agent) {
    return (
      <div className="inspect-view">
        <p className="field-hint">
          {tx("Select an agent to inspect.", "Selecciona un agent para inspeccionar.")}
        </p>
      </div>
    );
  }

  const usersFor = (id: string, kind: CapKind): string[] => {
    const usage =
      kind === "tool"
        ? capabilityGraph.usage.tools
        : kind === "skill"
          ? capabilityGraph.usage.skills
          : capabilityGraph.usage.mcpServers;
    return usage[id] || [];
  };

  const openEditor = (): void => setCenterView("editor");

  const handoffsOut = agent.handoffs
    .map((handoff) => agents.find((candidate) => candidate.id === handoff.agent))
    .filter((candidate): candidate is (typeof agents)[number] => Boolean(candidate));

  const handoffsIn = agents.filter((candidate) =>
    candidate.handoffs.some((handoff) => handoff.agent === agent.id),
  );

  const usedInWorkflows = workflows.filter((workflow) =>
    workflow.nodes.some((node) => node.agentId === agent.id),
  );

  const capDetailUsers = selectedCap ? usersFor(selectedCap.id, selectedCap.kind) : [];
  const capDetailLabel = selectedCap
    ? selectedCap.kind === "tool"
      ? selectedCap.id
      : `${selectedCap.kind}: ${selectedCap.id}`
    : "";

  return (
    <div className="inspect-view">
      <div className="inspect-header">
        <span className="inspect-avatar" style={{ borderColor: roleColor(agent.role) }}>
          {agent.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="inspect-header-text">
          <div className="inspect-header-row">
            <span className="inspect-name">{agent.name}</span>
            <span className="choose-card-scope">
              {agent.sourceScope === "global" ? tx("Global", "Global") : tx("Repo", "Repo")}
            </span>
          </div>
          <div className="inspect-file">.github/agents/{agent.id}.agent.md</div>
        </div>
        <button onClick={openEditor}>{tx("Edit", "Editar")}</button>
      </div>

      <p className="inspect-description">
        {agent.description || tx("No description", "Sin descripción")}
      </p>

      <div className="inspect-grid">
        <div>
          <div className="inspect-section-heading">
            {tx("Capability layer", "Capa de capacidades")}
          </div>
          {agent.capabilities.tools.length +
            agent.capabilities.skills.length +
            agent.capabilities.mcpServers.length ===
          0 ? (
            <p className="field-hint">
              {tx("No capabilities configured.", "Sin capacidades configuradas.")}
            </p>
          ) : (
            <div className="inspect-cap-groups">
              <div>
                <div className="inspect-cap-label">{tx("Tools", "Tools")}</div>
                <div className="chip-row">
                  {agent.capabilities.tools.map((tool) => (
                    <button
                      key={tool.id}
                      className={
                        selectedCap?.id === tool.id && selectedCap.kind === "tool"
                          ? "inspect-cap-chip active"
                          : "inspect-cap-chip"
                      }
                      onClick={() =>
                        setSelectedCap(
                          selectedCap?.id === tool.id && selectedCap.kind === "tool"
                            ? null
                            : { id: tool.id, kind: "tool" },
                        )
                      }
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="inspect-cap-label">{tx("Skills", "Skills")}</div>
                <div className="chip-row">
                  {agent.capabilities.skills.map((skill) => (
                    <button
                      key={skill.id}
                      className={
                        selectedCap?.id === skill.id && selectedCap.kind === "skill"
                          ? "inspect-cap-chip active"
                          : "inspect-cap-chip"
                      }
                      onClick={() =>
                        setSelectedCap(
                          selectedCap?.id === skill.id && selectedCap.kind === "skill"
                            ? null
                            : { id: skill.id, kind: "skill" },
                        )
                      }
                    >
                      {skill.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="inspect-cap-label">{tx("MCP servers", "Servidores MCP")}</div>
                <div className="chip-row">
                  {agent.capabilities.mcpServers.map((server) => (
                    <button
                      key={server.id}
                      className={
                        selectedCap?.id === server.id && selectedCap.kind === "mcp"
                          ? "inspect-cap-chip active"
                          : "inspect-cap-chip"
                      }
                      onClick={() =>
                        setSelectedCap(
                          selectedCap?.id === server.id && selectedCap.kind === "mcp"
                            ? null
                            : { id: server.id, kind: "mcp" },
                        )
                      }
                    >
                      {server.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="inspect-side-panel">
          {selectedCap ? (
            <div>
              <div className="inspect-cap-detail-label">{capDetailLabel}</div>
              <div className="inspect-cap-detail-count">
                {tx(
                  `Used by ${capDetailUsers.length} agent${capDetailUsers.length === 1 ? "" : "s"}`,
                  `Usada por ${capDetailUsers.length} agent${capDetailUsers.length === 1 ? "" : "s"}`,
                )}
              </div>
              <div className="inspect-row-list">
                {capDetailUsers.map((id) => {
                  const userAgent = agents.find((candidate) => candidate.id === id);
                  return (
                    <button
                      key={id}
                      className="inspect-row"
                      onClick={() => selectAgent(id)}
                    >
                      <span
                        className="agent-rail-dot"
                        style={{ background: roleColor(userAgent?.role) }}
                      />
                      {userAgent?.name ?? id}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="inspect-section-heading">
                {tx("Delegates to", "Delega a")}
              </div>
              <div className="inspect-row-list">
                {handoffsOut.length === 0 ? (
                  <span className="field-hint">
                    {tx("No handoffs configured.", "Sin handoffs configurados.")}
                  </span>
                ) : (
                  handoffsOut.map((target) => (
                    <button
                      key={target.id}
                      className="inspect-row"
                      onClick={() => selectAgent(target.id)}
                    >
                      <span className="inspect-row-arrow">⇄</span>
                      {target.name}
                      <span className="inspect-row-role">· {target.role}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="inspect-section-heading">
                {tx("Delegated from", "Recibe de")}
              </div>
              <div className="inspect-row-list">
                {handoffsIn.length === 0 ? (
                  <span className="field-hint">
                    {tx("No handoffs configured.", "Sin handoffs configurados.")}
                  </span>
                ) : (
                  handoffsIn.map((source) => (
                    <button
                      key={source.id}
                      className="inspect-row"
                      onClick={() => selectAgent(source.id)}
                    >
                      <span className="inspect-row-arrow dim">⇄</span>
                      {source.name}
                      <span className="inspect-row-role">· {source.role}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="inspect-section-heading">
                {tx("Used in workflows", "Usado en workflows")}
              </div>
              <div className="inspect-row-list">
                {usedInWorkflows.length === 0 ? (
                  <span className="field-hint">
                    {tx("Not used in any workflow.", "No se usa en ningún workflow.")}
                  </span>
                ) : (
                  usedInWorkflows.map((workflow) => (
                    <button
                      key={workflow.id}
                      className="inspect-row"
                      onClick={() => {
                        selectWorkflow(workflow.id);
                        setGraphMode("workflow");
                        setCenterView("graph");
                      }}
                    >
                      <span className="inspect-row-arrow dim">⛓</span>
                      {workflow.name}
                      <span className="inspect-row-role">
                        ·{" "}
                        {workflow.nodes.find((node) => node.agentId === agent.id)?.isEntry
                          ? tx("entry point", "punto de entrada")
                          : tx("step", "paso")}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
