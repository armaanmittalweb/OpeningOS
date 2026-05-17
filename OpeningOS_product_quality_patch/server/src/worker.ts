import { claimNextImportJob, completeImportJob, failImportJob, runImportJob } from './importers.js';
import { claimNextAnalysisJob, completeAnalysisJob, failAnalysisJob, runAnalysisJob } from './engine.js';

const workerId = process.env.WORKER_ID || `worker-${process.pid}`;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function tick() {
  const importJob = await claimNextImportJob(workerId);
  if (importJob) {
    try { await completeImportJob(importJob.id, await runImportJob(importJob)); }
    catch (err) { await failImportJob(importJob.id, err); }
    return true;
  }
  const analysisJob = await claimNextAnalysisJob(workerId);
  if (analysisJob) {
    try { await completeAnalysisJob(analysisJob.id, await runAnalysisJob(analysisJob)); }
    catch (err) { await failAnalysisJob(analysisJob.id, err); }
    return true;
  }
  return false;
}

console.log(`[OpeningOS worker] started ${workerId}`);
for (;;) {
  const worked = await tick();
  await sleep(worked ? 100 : 2000);
}
