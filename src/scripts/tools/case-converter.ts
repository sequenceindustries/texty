import { convertCase, isCaseId, type CaseId } from '../../../shared/text/case';
import { track } from '../analytics';
import { editor } from '../editor';
import { result } from '../result';
import { scheduler } from '../ui';

const ed = editor('case-text');
const out = result('case-result');
const pick = document.querySelector<HTMLFieldSetElement>('[data-case-pick]')!;

const current = (): CaseId => {
  const v = pick.querySelector<HTMLInputElement>('input:checked')?.value ?? 'title';
  return isCaseId(v) ? v : 'title';
};

function render() {
  out.set(ed.value ? convertCase(ed.value, current()) : '');
}

ed.onInput(scheduler(render, () => ed.value.length));
pick.addEventListener('change', () => {
  render();
  track('tool_action', { action: current() });
});
render();
