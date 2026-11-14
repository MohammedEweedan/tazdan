import dotenv from 'dotenv';
dotenv.config();
import { readLaunchEvidence } from '../src/services/ops/launchReadiness.service';

const report = readLaunchEvidence(process.env.LAUNCH_EVIDENCE_PATH, process.env.RELEASE_SHA);
const problems = [...report.problems];
if (!process.env.OPERATING_ENTITY_ID || process.env.OPERATING_ENTITY_ID !== report.evidence?.scope.legalEntityId) {
  problems.push('OPERATING_ENTITY_ID must match the approved scope legalEntityId');
}
console.log(JSON.stringify({ ready: problems.length === 0, releaseSha: process.env.RELEASE_SHA ?? null, problems, scope: report.evidence?.scope ?? null }, null, 2));
process.exitCode = problems.length === 0 ? 0 : 1;
