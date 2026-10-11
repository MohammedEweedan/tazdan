import dotenv from 'dotenv';
dotenv.config();
import { readLaunchEvidence } from '../src/services/ops/launchReadiness.service';

const report = readLaunchEvidence(process.env.LAUNCH_EVIDENCE_PATH, process.env.RELEASE_SHA);
console.log(JSON.stringify({ ready: report.ok, releaseSha: process.env.RELEASE_SHA ?? null, problems: report.problems, scope: report.evidence?.scope ?? null }, null, 2));
process.exitCode = report.ok ? 0 : 1;
