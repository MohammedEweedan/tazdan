export function auditViolations(audit, workspace, exceptions, now = Date.now()) {
  if (!audit?.metadata || audit.error || !audit.vulnerabilities) throw new Error('Dependency audit did not complete');
  const records = audit.vulnerabilities;
  const roots = (name, seen = new Set()) => {
    if (seen.has(name)) return [];
    seen.add(name);
    const v = records[name];
    if (!v) return [{ name, url: '', severity: 'high' }];
    return v.via.flatMap(item => typeof item === 'string' ? roots(item, new Set(seen)) : [item]);
  };
  const failures = [];
  const accepted = new Set();
  for (const v of Object.values(records)) {
    if (!['high', 'critical'].includes(v.severity)) continue;
    const causes = roots(v.name);
    if (!causes.length) { failures.push(`${v.name}: unresolved audit dependency`); continue; }
    for (const cause of causes) {
      if (!['high', 'critical'].includes(cause.severity) && v.severity !== 'critical') continue;
      const waiver = exceptions.find(e => e.workspaces.includes(workspace) && e.package === cause.name && cause.url.endsWith('/' + e.advisory) &&
        e.owner?.length >= 3 && e.reason?.length >= 40 && Date.parse(e.expiresAt) > now && e.scope === 'build-only');
      if (v.severity === 'critical' || cause.severity === 'critical' || !waiver) failures.push(`${v.name}: ${cause.url || cause.name}`);
      else accepted.add(`${cause.name}: ${waiver.advisory} (${waiver.expiresAt})`);
    }
  }
  return { failures: [...new Set(failures)], exceptions: [...accepted] };
}
