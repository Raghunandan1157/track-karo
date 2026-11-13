// Recovery stage configuration (UI-only; resets on reload).
import { $, toast } from '../ui.js';
import { STAGES, groupLabel } from '../recovery/data.js';
import { clear, el } from '../recovery/dom.js';

const OWNER_ROLES = ['Recovery officer', 'Recovery manager', 'Legal officer', 'Branch manager', 'Admin'];

let config = STAGES.map((s) => ({ ...s, active: true }));

function render() {
  const tbody = $('rec-stages-table');
  if (!tbody) return;
  clear(tbody);
  for (const s of config) {
    const owner = el('select', { 'aria-label': `Owner for stage ${s.no}` });
    for (const role of OWNER_ROLES) {
      const opt = new Option(role, role);
      if (role === s.owner) opt.selected = true;
      owner.appendChild(opt);
    }
    owner.addEventListener('change', () => {
      s.owner = owner.value;
      toast('Stage owner updated', `Stage ${s.no} · ${s.title}`, 'success');
    });

    const sla = el('input', {
      type: 'number', min: '1', max: '90', value: String(s.sla),
      'aria-label': `SLA days for stage ${s.no}`,
    });
    sla.addEventListener('change', () => {
      s.sla = Math.max(1, Math.min(90, Number(sla.value) || 1));
      sla.value = String(s.sla);
    });

    const active = el('input', {
      type: 'checkbox', 'aria-label': `Stage ${s.no} active`,
    });
    active.checked = s.active;
    active.addEventListener('change', () => {
      s.active = active.checked;
      updateSummary();
      toast(s.active ? 'Stage enabled' : 'Stage disabled', `Stage ${s.no} · ${s.title}`, s.active ? 'success' : 'info');
    });

    tbody.appendChild(el('tr', { class: `is-group-${s.group}` },
      el('td', { class: 'rec-stage-no' }, String(s.no)),
      el('td', {},
        el('strong', {}, s.title),
        el('span', { class: 'rec-cell-sub' }, s.evidence)),
      el('td', {},
        el('span', { class: 'rec-group-pill' },
          el('span', { class: `rec-group-dot is-${s.group}` }), groupLabel(s.group))),
      el('td', {}, owner),
      el('td', { class: 'rec-sla-cell' }, sla, el('span', { class: 'muted' }, ' days')),
      el('td', { class: 'rec-center' }, active)));
  }
  updateSummary();
}

function updateSummary() {
  const active = config.filter((s) => s.active).length;
  const node = $('rec-stages-summary');
  if (node) node.textContent = `${active} of 28 stages enabled · SLA total ${config.filter((s) => s.active).reduce((sum, s) => sum + s.sla, 0)} days`;
}

function init() {
  $('btn-rec-stages-reset')?.addEventListener('click', () => {
    config = STAGES.map((s) => ({ ...s, active: true }));
    render();
    toast('Stage configuration reset', 'Default owners and SLAs restored.', 'success');
  });
}

function show() {
  render();
}

export default { init, show };
