#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Roadmap Pipeline — Multi-Harness Installer
# Targets: OpenCode, Claude Code, OpenAI Codex CLI
# ==============================================================================
# Single source of truth:
#   references/roles/<role>.md  -> frontmatter (role/description/tier/access) + prompt body
#   commands/<name>.md          -> slash command templates ($ARGUMENTS)
# This script only translates them into each harness's native format.
#
# Usage:
#   bash .agents/skills/roadmap-pipeline/scripts/install-harnesses.sh [options]
#
# Options:
#   --global                 Install in the user's home (default)
#   --project <path>         Install inside a repository (default: current dir)
#   --harness <name>         opencode | claude | codex | all   (default: auto)
#   -h, --help               Show this help
#
# Model tiering (override with env vars, or let `roadmap-pipeline init` pass the
# workspace profile's `tiers`):
#   Primary:   empty  -> the harness/model default (no `model:` line is written)
#   Explicit:  OPENCODE_MODEL_DEEP / OPENCODE_MODEL_FAST = <provider/model>
#   Claude:    CLAUDE_MODEL_DEEP / CLAUDE_MODEL_FAST
#
#   OPENCODE_MODEL_DEEP=<provider/model>
#   OPENCODE_MODEL_FAST=<provider/model>
#   CLAUDE_MODEL_DEEP=opus
#   CLAUDE_MODEL_FAST=sonnet
# ==============================================================================

SKILL_SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_ROOT_DIR="$(cd "${SKILL_SRC_DIR}/.." && pwd)"
DDD_SKILL_SRC_DIR="${SKILLS_ROOT_DIR}/ddd-architecture"
ROLES_DIR="${SKILL_SRC_DIR}/references/roles"
COMMANDS_DIR="${SKILL_SRC_DIR}/commands"
ROLES=(flow-auditor roadmap-planner roadmap-implementer roadmap-reviewer)
COMMANDS=(roadmap)

MODE="--global"
TARGET_PROJECT="$(pwd)"
HARNESS="auto"

OPENCODE_MODEL_DEEP="${OPENCODE_MODEL_DEEP:-}"
OPENCODE_MODEL_FAST="${OPENCODE_MODEL_FAST:-}"
CLAUDE_MODEL_DEEP="${CLAUDE_MODEL_DEEP:-}"
CLAUDE_MODEL_FAST="${CLAUDE_MODEL_FAST:-}"

usage() {
  cat <<'EOF'
Usage: install-harnesses.sh [options]

  --global                 Install in the user's home (default)
  --project <path>         Install inside a repository (default: current dir)
  --harness <name>         opencode | claude | codex | all   (default: auto)
  -h, --help               Show this help

Model tiering (override with env vars):
  OPENCODE_MODEL_DEEP / OPENCODE_MODEL_FAST
    empty -> harness default (no `model:` line is written)
    or    -> <provider/model>
  CLAUDE_MODEL_DEEP / CLAUDE_MODEL_FAST
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --global) MODE="--global"; shift ;;
    --project) MODE="--project"; TARGET_PROJECT="${2:-$(pwd)}"; shift 2 ;;
    --harness) HARNESS="${2:-auto}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

case "${HARNESS}" in
  auto|opencode|claude|codex|all) ;;
  *) echo "Invalid --harness: ${HARNESS}" >&2; exit 1 ;;
esac

if [[ "${MODE}" == "--global" ]]; then
  OPENCODE_BASE="${HOME}/.config/opencode"
  CLAUDE_BASE="${HOME}/.claude"
  CODEX_BASE="${HOME}/.codex"
else
  TARGET_PROJECT="$(cd "${TARGET_PROJECT}" && pwd)"
  OPENCODE_BASE="${TARGET_PROJECT}/.opencode"
  CLAUDE_BASE="${TARGET_PROJECT}/.claude"
  CODEX_BASE="${TARGET_PROJECT}/.codex"
fi

want() {
  local target="$1"
  [[ "${HARNESS}" == "all" || "${HARNESS}" == "${target}" ]] && return 0
  [[ "${HARNESS}" != "auto" ]] && return 1
  case "${target}" in
    opencode) return 0 ;;
    claude) [[ -d "${CLAUDE_BASE}" ]] ;;
    codex) [[ -d "${CODEX_BASE}" ]] ;;
    *) return 1 ;;
  esac
}

# ------------------------------------------------------------------------------
# Frontmatter helpers
# ------------------------------------------------------------------------------
frontmatter_value() { # <file> <key>
  awk -v key="$2" '
    NR == 1 && $0 != "---" { exit }
    /^---[[:space:]]*$/ { block++; next }
    block == 1 && index($0, key ":") == 1 {
      sub("^" key ":[[:space:]]*", "")
      print
      exit
    }
  ' "$1"
}

role_body() { # <file>
  awk 'BEGIN { block = 0 } /^---[[:space:]]*$/ { block++; next } block >= 2 { print }' "$1"
}

opencode_permissions() { # <access>
  case "$1" in
    readonly)
      cat <<'YAML'
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
  - action: webfetch
    resource: "*"
    effect: deny
  - action: websearch
    resource: "*"
    effect: deny
YAML
      ;;
    plan)
      cat <<'YAML'
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: edit
    resource: "docs/pipeline/**"
    effect: allow
  - action: shell
    resource: "*"
    effect: deny
  - action: webfetch
    resource: "*"
    effect: deny
  - action: websearch
    resource: "*"
    effect: deny
YAML
      ;;
    review)
      cat <<'YAML'
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: edit
    resource: "docs/pipeline/**"
    effect: allow
  - action: webfetch
    resource: "*"
    effect: deny
  - action: websearch
    resource: "*"
    effect: deny
YAML
      ;;
    write)
      cat <<'YAML'
permissions:
  - action: webfetch
    resource: "*"
    effect: deny
  - action: websearch
    resource: "*"
    effect: deny
YAML
      ;;
    *)
      echo "Unknown access level: $1" >&2
      return 1
      ;;
  esac
}

opencode_model() { # <tier>
  case "$1" in
    deep) echo "${OPENCODE_MODEL_DEEP}" ;;
    fast) echo "${OPENCODE_MODEL_FAST}" ;;
    *) echo "Unknown tier: $1" >&2; return 1 ;;
  esac
}

claude_model() { # <tier>
  case "$1" in
    deep) echo "${CLAUDE_MODEL_DEEP}" ;;
    fast) echo "${CLAUDE_MODEL_FAST}" ;;
    *) echo "Unknown tier: $1" >&2; return 1 ;;
  esac
}

claude_tools() { # <access>
  case "$1" in
    readonly) echo "Read, Grep, Glob" ;;
    plan) echo "Read, Grep, Glob, Write, Edit" ;;
    review) echo "Read, Grep, Glob, Write, Edit, Bash" ;;
    write) echo "Read, Grep, Glob, Write, Edit, Bash" ;;
    *) echo "Unknown access level: $1" >&2; return 1 ;;
  esac
}

codex_effort() { # <tier>
  case "$1" in
    deep) echo "high" ;;
    fast) echo "medium" ;;
    *) echo "Unknown tier: $1" >&2; return 1 ;;
  esac
}

backup_dir() { # <base>
  local dest="${1}/.install-backups/$(date +%Y%m%d-%H%M%S)"
  mkdir -p "${dest}"
  if [[ -d "${1}/agents" ]]; then cp -R "${1}/agents" "${dest}/" 2>/dev/null || true; fi
  if [[ -d "${1}/commands" ]]; then cp -R "${1}/commands" "${dest}/" 2>/dev/null || true; fi
  echo "${dest}"
}

link_skills() { # <base>
  mkdir -p "${1}/skills"
  ln -sfn "${SKILL_SRC_DIR}" "${1}/skills/roadmap-pipeline"
  if [[ -d "${DDD_SKILL_SRC_DIR}" ]]; then
    ln -sfn "${DDD_SKILL_SRC_DIR}" "${1}/skills/ddd-architecture"
  fi
}

install_commands() { # <base>
  mkdir -p "${1}/commands"
  local cmd
  for cmd in "${COMMANDS[@]}"; do
    cp -f "${COMMANDS_DIR}/${cmd}.md" "${1}/commands/${cmd}.md"
  done
}

# ------------------------------------------------------------------------------
# 1. OpenCode
# ------------------------------------------------------------------------------
install_opencode() {
  mkdir -p "${OPENCODE_BASE}/agents"
  link_skills "${OPENCODE_BASE}"
  local backup
  backup="$(backup_dir "${OPENCODE_BASE}")"

  local role file description tier access model
  for role in "${ROLES[@]}"; do
    file="${ROLES_DIR}/${role}.md"
    description="$(frontmatter_value "${file}" description)"
    tier="$(frontmatter_value "${file}" tier)"
    access="$(frontmatter_value "${file}" access)"
    model="$(opencode_model "${tier}")"

    {
      echo "---"
      echo "description: ${description}"
      echo "mode: subagent"
      if [[ -n "${model}" ]]; then echo "model: ${model}"; fi
      opencode_permissions "${access}"
      echo "---"
      role_body "${file}"
    } > "${OPENCODE_BASE}/agents/${role}.md"
  done

  install_commands "${OPENCODE_BASE}"
  echo "✅ OpenCode  -> ${OPENCODE_BASE} (backup: ${backup})"
}

# ------------------------------------------------------------------------------
# 2. Claude Code
# ------------------------------------------------------------------------------
install_claude() {
  mkdir -p "${CLAUDE_BASE}/agents"
  link_skills "${CLAUDE_BASE}"
  local backup
  backup="$(backup_dir "${CLAUDE_BASE}")"

  local role file description tier access model tools
  for role in "${ROLES[@]}"; do
    file="${ROLES_DIR}/${role}.md"
    description="$(frontmatter_value "${file}" description)"
    tier="$(frontmatter_value "${file}" tier)"
    access="$(frontmatter_value "${file}" access)"
    model="$(claude_model "${tier}")"
    tools="$(claude_tools "${access}")"

    {
      echo "---"
      echo "name: ${role}"
      echo "description: ${description}"
      echo "tools: ${tools}"
      if [[ -n "${model}" ]]; then echo "model: ${model}"; fi
      echo "skills:"
      echo "  - roadmap-pipeline"
      if [[ -d "${DDD_SKILL_SRC_DIR}" ]]; then echo "  - ddd-architecture"; fi
      echo "---"
      role_body "${file}"
    } > "${CLAUDE_BASE}/agents/${role}.md"
  done

  install_commands "${CLAUDE_BASE}"
  echo "✅ Claude Code -> ${CLAUDE_BASE} (backup: ${backup})"
}

# ------------------------------------------------------------------------------
# 3. OpenAI Codex CLI
# ------------------------------------------------------------------------------
install_codex() {
  mkdir -p "${CODEX_BASE}/agents"
  link_skills "${CODEX_BASE}"

  local role file description tier effort
  for role in "${ROLES[@]}"; do
    file="${ROLES_DIR}/${role}.md"
    description="$(frontmatter_value "${file}" description)"
    tier="$(frontmatter_value "${file}" tier)"
    effort="$(codex_effort "${tier}")"

    {
      echo "name = \"${role}\""
      echo "description = \"${description}\""
      echo "model_reasoning_effort = \"${effort}\""
      echo 'developer_instructions = """'
      role_body "${file}"
      echo '"""'
    } > "${CODEX_BASE}/agents/${role}.toml"
  done

  echo "✅ Codex CLI -> ${CODEX_BASE}"
}

echo "📦 Roadmap Pipeline (${MODE}${TARGET_PROJECT:+ · ${TARGET_PROJECT}})"
want opencode && install_opencode
want claude && install_claude
want codex && install_codex
echo "🎉 Done. Use /roadmap <intent|status|audit|debt|plan|next|review|close|loop|resume>."