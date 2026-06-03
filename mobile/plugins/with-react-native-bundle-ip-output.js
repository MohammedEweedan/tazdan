const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const COPY_PODS_RESOURCES_PHASE_NAME = '[CP] Copy Pods Resources';
const GENERATE_SPECS_PHASE_NAME = '[CP-User] Generate Specs';
const IP_TXT_OUTPUT = '$(TARGET_BUILD_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/ip.txt';
const PODS_RESOURCES_TO_COPY_OUTPUT = '${PODS_ROOT}/resources-to-copy-${TARGETNAME}.txt';
const REACT_CODEGEN_OUTPUTS = [
  '${PODS_ROOT}/../build/generated/ios/react/renderer/components/rnsvg/States.cpp',
  '${PODS_ROOT}/../build/generated/ios/safeareacontextJSI-generated.cpp',
];

function unquote(value) {
  return typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
}

module.exports = function withReactNativeBundleIpOutput(config) {
  config = withXcodeProject(config, (config) => {
    const shellScriptPhases =
      config.modResults.hash.project.objects.PBXShellScriptBuildPhase || {};

    for (const phase of Object.values(shellScriptPhases)) {
      if (!phase || typeof phase !== 'object') {
        continue;
      }

      if (unquote(phase.name) !== BUNDLE_PHASE_NAME) {
        if (unquote(phase.name) === COPY_PODS_RESOURCES_PHASE_NAME) {
          ensureOutputPath(phase, PODS_RESOURCES_TO_COPY_OUTPUT);
        }

        continue;
      }

      ensureOutputPath(phase, IP_TXT_OUTPUT);
    }

    return config;
  });

  return withDangerousMod(config, [
    'ios',
    (config) => {
      patchPodsProject(config.modRequest.platformProjectRoot);
      return config;
    },
  ]);
};

function ensureOutputPath(phase, outputPath) {
  const outputPaths = phase.outputPaths || [];
  const hasOutput = outputPaths.some((path) => unquote(path) === outputPath);

  if (!hasOutput) {
    outputPaths.push(`"${outputPath}"`);
  }

  phase.outputPaths = outputPaths;
}

function patchPodsProject(iosProjectRoot) {
  const podsProjectPath = path.join(iosProjectRoot, 'Pods/Pods.xcodeproj/project.pbxproj');
  if (!fs.existsSync(podsProjectPath)) {
    return;
  }

  let contents = fs.readFileSync(podsProjectPath, 'utf8');
  const marker = 'name = "[CP-User] Generate Specs";';
  const markerIndex = contents.indexOf(marker);
  if (markerIndex === -1) {
    return;
  }

  const outputPathsIndex = contents.indexOf('outputPaths = (', markerIndex);
  const outputPathsEnd = contents.indexOf(');', outputPathsIndex);
  if (outputPathsIndex === -1 || outputPathsEnd === -1) {
    return;
  }

  const outputBlock = contents.slice(outputPathsIndex, outputPathsEnd);
  const missingOutputs = REACT_CODEGEN_OUTPUTS.filter(
    (outputPath) => !outputBlock.includes(`"${outputPath}"`),
  );

  if (missingOutputs.length === 0) {
    return;
  }

  const insertion = missingOutputs.map((outputPath) => `\n\t\t\t\t"${outputPath}",`).join('');
  contents = `${contents.slice(0, outputPathsEnd)}${insertion}${contents.slice(outputPathsEnd)}`;
  fs.writeFileSync(podsProjectPath, contents);
}
