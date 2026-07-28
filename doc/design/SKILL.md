---
name: design
description: Reverse-engineered odd.js knowledge base. Use to navigate product goals into owning SDKs, modules, plugins, configuration, interfaces, events, source evidence, features, and online solutions.
---

# odd.js Design Knowledge Base

<!-- TOC -->
## Contents

- [Start shallow, then go deep](#start-shallow-then-go-deep)
- [Evidence](#evidence)
- [Maintenance](#maintenance)
<!-- /TOC -->

English is canonical. Every reference has a sibling `*.zh.md` Chinese translation.

## Start shallow, then go deep

1. **Product intent:** open the clickable [product goal tree](references/architecture.md#target-tree). Each target remains visible even when it is not implemented.
2. **SDK ownership:** select [Common](references/common.md), [Player](references/player.md), [RTC](references/rtc.md), [IM](references/im.md), [NES](references/nes.md), or [Famicom](references/famicom.md). Each module page contains its interfaces and events.
3. **Implementation:** inside each SDK, follow module, plugin, configuration, interface, event, and source-map sections.
4. **Cross-cutting design:** read [architecture](references/architecture.md).

The navigation model is:

```text
product target → SDK → module/plugin → public API/event/config → source
```

## Evidence

Use this priority: `src/` implementation, `compile.sh`, `example/`, existing `doc/`, then product roadmap. Do not infer support from a declaration or old document without a reachable runtime path.

| Status | Meaning |
| --- | --- |
| **Verified** | Reachable implementation exists. |
| **Partial** | Useful implementation exists, but the named target/module is incomplete. |
| **Skeleton** | Structure exists without an end-to-end path. |
| **Planned** | No operative path was found. |
| **Risk** | A concrete defect or unsafe assumption is visible. |

## Maintenance

1. Trace product target → owning SDK facade → runtime module/plugin → browser/network boundary.
2. Update the English page first; mirror facts, links, tables, anchors, and status in `.zh.md`.
3. Keep incomplete targets visible and update their status instead of deleting them.
4. Validate local links, anchors, bilingual pairs, and `compile.sh` ownership.
