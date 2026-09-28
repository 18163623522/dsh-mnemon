---
"dsh-mnemon": patch
---

Prepare Starter dependency resolution before importing its independent components, so Desktop and official WebUI can activate a newly installed or previously disabled bundle without restarting DSH. Preserve core/component toggles and existing plugin dependency routes.

Register Web RPC routes in Mnemon's own injected scope so the newly enabled WebUI is usable without restarting the existing Connection service.
