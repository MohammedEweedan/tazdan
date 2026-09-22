import fs from 'node:fs/promises';
import path from 'node:path';
import { GlobalFonts } from '@napi-rs/canvas';
import { Presentation, PresentationFile } from '@oai/artifact-tool';
import { finalizePresentation } from '/Users/moe/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations/container_tools/artifact_tool_utils.mjs';
const root='/Users/moe/Downloads/promrkts', tmp=path.join(root,'.artifacts/tazdan');
const skill='/Users/moe/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations';
const candidate=path.join(tmp,'candidate-ar.pptx'); const family='Cairo';
const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:path.join(root,'deliverables/tazdan-pitch-deck-ar.pptx'),pythonExecutable:'/Users/moe/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',integrityValidatorPath:path.join(skill,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...[7,9,10,11].flatMap(n=>['--require-native-table-slide',String(n)])],requiredNativeTableOwnerSlides:[7,9,10,11],fontPolicy:{basis:'user_request',families:[family],scriptFonts:{cs:family}},verifyArtifactToolImport:true,receiptPath:path.join(tmp,'deck-ar-final-validation.json')});console.log(result.finalPath);
