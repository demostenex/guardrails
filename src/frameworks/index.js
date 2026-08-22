import { laravelProfile } from "./laravel-profile.js";

const availableProfiles = [laravelProfile];

export function resolveFrameworkProfiles(parsedFiles, config) {
  const frameworkConfig = config.frameworks ?? {};
  const explicitProfiles = new Set(frameworkConfig.enabled ?? []);
  const autoDetect = frameworkConfig.auto_detect ?? true;

  return availableProfiles.filter(
    (profile) =>
      explicitProfiles.has(profile.id) || (autoDetect && profile.detect(parsedFiles))
  );
}

export function isSuppressedByFramework(parsedFiles, config, candidate) {
  for (const profile of resolveFrameworkProfiles(parsedFiles, config)) {
    const suppression = profile.suppress(candidate);

    if (suppression) {
      return {
        framework: profile.id,
        ...suppression
      };
    }
  }

  return null;
}
