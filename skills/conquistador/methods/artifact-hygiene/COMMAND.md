# Artifact hygiene method

Use privately when a composed outcome creates or revises files, exports, rendered media, or generated
inventory.

Load recovered cleanup classification under `conquistador/references/artifact-hygiene/`
(KEEP/STALE/ORPHAN/LEGACY/EPHEMERAL rules). Never infer deletion authority from a quality finding.

- Identify the exact source artifact, selected variant, destination, owner, and reversible write.
- Preserve unrelated and historically valuable material. Never infer deletion, archive, rename, or
  cleanup authority from a quality finding.
- Distinguish source from generated output and record the safe regeneration path when one exists.
- Inspect the actual bytes or render before claiming success; a prompt, plan, or filename is not proof.
- Use atomic/recoverable writes where the host supports them and keep secrets or personal data out of
  public artifacts.

Return the artifact identity, observed state, proposed or applied scoped change, verification, recovery
path, and any action still requiring explicit human authority.
