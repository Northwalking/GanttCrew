import { test, expect } from '@playwright/test';
import { newTeam } from './helpers.mjs';

// The PM's assignment changes reach the people affected through the bell.
test('assigning and reassigning a task alerts the people affected', async ({ page }) => {
  const errors = await newTeam(page);
  const r = await page.evaluate(async () => {
    const ids = Object.keys(S.members).filter((k) => k !== ME.memberId);
    const [a, b] = ids;
    const t = arr('tasks').find((x) => x.assigneeId === a && x.status !== 'done');
    const base = { ...t };
    delete base.id;
    const nid = await save('tasks', null, { ...base, name: 'Tarea recién asignada', deps: [] });
    await save('tasks', t.id, { ...base, assigneeId: b });
    const stamped = !!S.tasks[nid].asg && S.tasks[t.id].asg.from === a;
    const asAlerts = (id) => {
      ME.owner = false;
      ME.memberId = id;
      return alerts()
        .filter((x) => x.sev === 'info')
        .map((x) => x.key.slice(0, 2) + ':' + x.name);
    };
    const pmSees = alerts().filter((x) => x.sev === 'info').length;
    return { stamped, pmSees, a: asAlerts(a), b: asAlerts(b), old: t.name };
  });
  expect(r.stamped).toBe(true);
  expect(r.pmSees).toBe(0);
  expect(r.a).toContain('as:Tarea recién asignada');
  expect(r.a).toContain('un:' + r.old);
  expect(r.b).toEqual(['as:' + r.old]);
  // seen as member b: the dialog lists it and a member's own save keeps the stamp
  await page.evaluate(() => openAlerts());
  await expect(page.locator('.alrow', { hasText: 'Reasignada a ti' })).toHaveCount(1);
  expect(errors).toEqual([]);
});
