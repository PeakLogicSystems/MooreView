'use strict';

const { parseProgram, collectProgramTagRefs } = require('../engine/parser');
const { defaultMetaForId } = require('../parc/mqttOptaProgram');
const { applyDefaultLabel } = require('../tags/tagLabels');

/** Add memory/I/O tags referenced by ST source if missing (no overwrite). */
function ensureProgramTags(tagStore, source) {
  const src = String(source || '');
  const { ast, errors: parseErrs } = parseProgram(src);
  if (!ast || parseErrs.length) {
    return { added: [], errors: parseErrs, count: tagStore.count() };
  }
  const refs = collectProgramTagRefs(ast);
  const added = [];
  const labeled = [];
  for (const id of refs) {
    const existing = tagStore.get(id);
    if (existing) {
      if (!String(existing.label || '').trim()) {
        const withLabel = applyDefaultLabel(existing);
        if (withLabel.label && withLabel.label !== existing.label) {
          tagStore.upsert(withLabel);
          labeled.push(id);
        }
      }
      continue;
    }
    tagStore.upsert(defaultMetaForId(id));
    added.push(id);
  }
  return { added, labeled, errors: [], count: tagStore.count() };
}

module.exports = {
  ensureProgramTags,
};
