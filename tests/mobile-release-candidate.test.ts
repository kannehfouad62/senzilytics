import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("all native authorization and data requests identify their release contract", async () => {
  const [api, authService, challengeRoute, tokenRoute] = await Promise.all([
    readFile(new URL("../apps/mobile/src/api.ts", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../src/modules/mobile/mobile-auth.service.ts",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../src/app/api/mobile/auth/challenge/route.ts",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL("../src/app/api/mobile/auth/token/route.ts", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(api, /x-senzilytics-mobile-version/);
  assert.match(api, /x-senzilytics-mobile-platform/);
  assert.match(api, /x-senzilytics-mobile-api-version/);
  assert.match(authService, /assertMobileReleaseCompatibility\(request\)/);
  assert.match(challengeRoute, /assertMobileReleaseCompatibility\(request\)/);
  assert.match(tokenRoute, /assertMobileReleaseCompatibility\(request\)/);
});

test("the native release candidate revalidates on foreground and fails safely", async () => {
  const [app, releaseCandidate] = await Promise.all([
    readFile(new URL("../apps/mobile/App.tsx", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../apps/mobile/src/release-candidate.tsx",
        import.meta.url
      ),
      "utf8"
    ),
  ]);

  assert.match(app, /AppState\.addEventListener/);
  assert.match(app, /5 \* 60_000/);
  assert.match(app, /MobileUpdateRequiredScreen/);
  assert.match(app, /MobileDiagnosticsPanel/);
  assert.match(app, /MobileErrorBoundary/);
  assert.match(releaseCandidate, /credentials and tenant record[\s\S]*never displayed/i);
  assert.doesNotMatch(releaseCandidate, /error\.message|error\.stack/);
});

test("Expo configuration and runtime headers share one release version source", async () => {
  const [config, runtime] = await Promise.all([
    readFile(new URL("../apps/mobile/app.config.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../apps/mobile/src/release-metadata.ts", import.meta.url),
      "utf8"
    ),
  ]);

  assert.match(config, /release-metadata\.json/);
  assert.match(runtime, /release-metadata\.json/);
});

test("store submission metadata matches the native release candidate", async () => {
  const [
    releaseMetadataText,
    storeConfigText,
    mobilePackageText,
    appleWorksheet,
    googleWorksheet,
    playListing,
  ] = await Promise.all([
      readFile(
        new URL("../apps/mobile/release-metadata.json", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../apps/mobile/store.config.json", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../apps/mobile/package.json", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../apps/mobile/APPLE_STORE_SUBMISSION.md", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../apps/mobile/GOOGLE_PLAY_SUBMISSION.md", import.meta.url),
        "utf8"
      ),
      readFile(
        new URL("../apps/mobile/PLAY_STORE_LISTING.md", import.meta.url),
        "utf8"
      ),
  ]);
  const releaseMetadata = JSON.parse(releaseMetadataText) as {
    appVersion: string;
  };
  const storeConfig = JSON.parse(storeConfigText) as {
    apple: { version: string };
  };
  const mobilePackage = JSON.parse(mobilePackageText) as {
    scripts: { check: string };
  };
  const escapedVersion = releaseMetadata.appVersion.replaceAll(".", "\\.");
  const versionPattern = new RegExp(`Senzilytics ${escapedVersion}`);

  assert.equal(storeConfig.apple.version, releaseMetadata.appVersion);
  assert.match(mobilePackage.scripts.check, /expo-doctor --verbose/);
  assert.match(appleWorksheet, versionPattern);
  assert.match(googleWorksheet, versionPattern);
  assert.match(playListing, versionPattern);
});
