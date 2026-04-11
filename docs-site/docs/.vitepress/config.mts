import { defineConfig } from "vitepress";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const computedBase =
  process.env.DOCS_BASE ??
  (process.env.GITHUB_ACTIONS && repoName ? `/${repoName}/` : "/");

export default defineConfig({
  title: "Agent Studio",
  description: "Visual control plane for AI agents in VS Code.",
  lang: "en-US",
  srcDir: ".",
  cleanUrls: true,
  ignoreDeadLinks: true,
  lastUpdated: true,
  base: computedBase,
  head: [
    [
      "link",
      { rel: "icon", href: `${computedBase}mark.svg`, type: "image/svg+xml" },
    ],
    ["meta", { name: "theme-color", content: "#0a1020" }],
    ["meta", { property: "og:title", content: "Agent Studio" }],
    [
      "meta",
      {
        property: "og:description",
        content: "Design, inspect, and orchestrate AI agents in VS Code.",
      },
    ],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
  ],
  themeConfig: {
    logo: `${computedBase}mark.svg`,
    siteTitle: "Agent Studio",
    search: {
      provider: "local",
    },
    nav: [
      {
        text: "Product",
        items: [
          { text: "Home", link: "/" },
          { text: "Features", link: "/features" },
          { text: "Why Agent Studio", link: "/why-agent-studio" },
          { text: "Visual Dashboard", link: "/visual-dashboard" },
          { text: "Tools, Skills & MCP", link: "/visibility" },
          { text: "FAQ", link: "/faq" },
        ],
      },
      {
        text: "Docs",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Installation", link: "/installation" },
          { text: "Quick Start", link: "/quick-start" },
          { text: "Architecture", link: "/architecture" },
        ],
      },
      { text: "Roadmap", link: "/roadmap" },
      { text: "Contributing", link: "/contributing" },
      {
        text: "Marketplace",
        link: "https://marketplace.visualstudio.com/items?itemName=AgentstudioIA.agent-studio-ia",
      },
    ],
    sidebar: [
      {
        text: "Product",
        items: [
          { text: "Home", link: "/" },
          { text: "Features", link: "/features" },
          { text: "Why Agent Studio", link: "/why-agent-studio" },
          { text: "Visual Dashboard", link: "/visual-dashboard" },
          { text: "Agents, Tools & MCP Visibility", link: "/visibility" },
          { text: "Roadmap", link: "/roadmap" },
          { text: "FAQ", link: "/faq" },
        ],
      },
      {
        text: "Documentation",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Installation", link: "/installation" },
          { text: "Quick Start", link: "/quick-start" },
          { text: "Core Concepts", link: "/core-concepts" },
          { text: "Creating Agents", link: "/creating-agents" },
          { text: "Architecture", link: "/architecture" },
          { text: "Contributing", link: "/contributing" },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/EricERodriguez/agent-studio",
      },
    ],
    outline: {
      level: [2, 3],
    },
    footer: {
      message:
        "Built for developers who want agent infrastructure to feel visual, inspectable, and maintainable.",
      copyright: "Copyright © 2026 Agent Studio",
    },
    docFooter: {
      prev: "Previous page",
      next: "Next page",
    },
  },
});
