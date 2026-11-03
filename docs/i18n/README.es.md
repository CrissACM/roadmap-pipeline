# roadmap-pipeline — guía rápida (ES)

Pipeline de entrega autónoma para agentes de código: **estado en disco** y **gates que no se pueden saltar**.
Un kanban versionado en tu repo, un Plan Gate de 7 criterios, TDD Red→Green auditable y un reviewer en sesión
fresca que re-ejecuta los gates y clasifica con `0B/0M`.

```bash
bunx roadmap-pipeline init --profile bun-nestjs-ddd
/roadmap intent seguimiento de pedidos en vivo
/roadmap next ORD-01
```

## Requisitos

Bun ≥ 1.3, macOS o Linux, un repositorio git.

## Los 10 modos de `/roadmap`

| Modo             | Función                                                                                                                                                |
| :--------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intent <desc>`  | El único modo que pregunta: lee el código, devuelve el pedido, hace **una** pregunta y registra quién/por qué + Given/When/Then + non-goals como card. |
| `audit [flujo…]` | Auditores read-only en paralelo; consolida hallazgos en cards con ID estable y un board por workstream.                                                |
| `debt`           | Cosecha marcadores `shortcut:` en cards del backlog.                                                                                                   |
| `plan <ID…>`     | Planner deep + Plan Gate.                                                                                                                              |
| `next [ID…]`     | Ciclo completo: plan → gate → implementación TDD → review fresca → cierre de dos commits.                                                              |
| `review <ID…>`   | Reviewer fresco sobre el working tree + árbol de decisión.                                                                                             |
| `close <ID…>`    | Cierre de dos commits, solo con `APPROVE (0B/0M)` ya escrito en el fragmento.                                                                          |
| `loop [max]`     | Repite `next` hasta vaciar backlog, alcanzar el máximo, ensuciar el árbol o bloquear una card.                                                         |
| `resume`         | Arranque en frío: recupera la fase exacta desde disco.                                                                                                 |
| `status`         | Reporte read-only de board, fragmento activo y siguiente acción.                                                                                       |

## El Plan Gate (7 criterios)

1. Intención presente (`## 0`: quién/por qué, Given/When/Then, non-goals).
2. Rutas exactas de archivos en las capas del perfil.
3. Contratos y tipos cerrados, con errores tipados.
4. Estrategia Red→Green caso por caso.
5. Cero decisiones arquitectónicas abiertas.
6. Diseño mínimo necesario (línea `Design ladder:`; sin dependencias ni abstracciones sin segundo consumidor).
7. Fragmento ≤300 líneas y todos los enlaces de anexos resuelven.

## Perfiles

Todo lo específico del stack vive en `docs/pipeline/profile.md` (bloque `json pipeline-profile`):
`moduleRoot`, `layers`, `contracts`, `specs`, `gates`, `graph` y `tiers` de modelo. El protocolo no nombra
ningún framework. Perfiles incluidos: `generic` y `bun-nestjs-ddd`.

## Guards

```bash
bun run roadmap:check   # presupuesto de fragmento, enlaces, shortcut:, perfil y presupuesto de la skill
bun run roadmap:debt    # tabla de deuda declarada
```

## Diferencias con otras skills

- Ante **Superpowers**: esto es infraestructura de proceso (kanban en disco, roles con permisos, gates
  verificados por tests), no condicionamiento de conducta.
- Ante **Ponytail**: su escalera de reuso, el ledger de `shortcut:` y la lista de "nunca recortar" están
  integrados en planner, implementer y checklist `0B/0M`.
- Ante **claude-mem**: la memoria automática entre sesiones se rechaza explícitamente en el reviewer; perdería
  la independencia que da sentido al gate.

## Licencia

MIT © crissacm
