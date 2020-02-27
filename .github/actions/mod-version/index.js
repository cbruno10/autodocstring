const core = require("@actions/core");
const semver = require("semver");
const csv = require("csvtojson");
const fs = require("fs-extra");

main();

async function main() {
  try {
    const currentReleasedVersion = core.getInput("masterVersion");
    const latestVersion = core.getInput("workingVersion");
    const modFilePath = core.getInput("modFilePath");
    const currentInspectResults = await fs.readFile(
      core.getInput("workingInspect"),
      "utf8"
    );
    const masterInspectResults = await fs.readFile(
      core.getInput("masterInspect"),
      "utf8"
    );

    const releaseType = await releaseTypeFromInspectResults(
      currentInspectResults,
      masterInspectResults
    );
    console.log(`Release type: ${releaseType}`);
    const version = getNewModVersion(
      currentReleasedVersion,
      latestVersion,
      releaseType
    );
    // now update the version in the mod file
    await updateModVersion(modFilePath, version);
    core.setOutput("version", version);
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function releaseTypeFromInspectResults(
  currentInspectResults,
  masterInspectResults
) {
  const current = (await parseCsv(currentInspectResults)).map(
    i => `${i["Item Type"]} > ${i.Path}`
  );
  const lastRelease = (await parseCsv(masterInspectResults)).map(
    i => `${i["Item Type"]} > ${i.Path}`
  );
  const newTypes = current.filter(i => !lastRelease.includes(i));
  const deletedTypes = lastRelease.filter(i => !current.includes(i));
  console.log(`newTypes ${newTypes}`);
  console.log(`deletedTypes ${deletedTypes}`);
  return newTypes.length + deletedTypes.length === 0 ? "patch" : "minor";
}

function getNewModVersion(currentReleasedVersion, latestVersion, releaseType) {
  // if there is a currently released version, recalculate latest version based on release type
  const version = currentReleasedVersion
    ? semver.inc(currentReleasedVersion, releaseType)
    : latestVersion;

  // now make a prerelease
  return `${version}-rc.${timestamp()}`;
}

async function updateModVersion(modFilePath, version) {
  if (!fs.pathExistsSync(modFilePath)) {
    throw Error(
      `Failed to update mod version: mod path ${modFilePath} does not exist`
    );
  }

  // load mod
  let modText = await fs.readFile(modFilePath, "utf8");
  // update version
  modText = modText.replace(/version: ["0-9a-z.-]*/, `version: "${version}"`);
  // save mode
  await fs.writeFile(modFilePath, modText);
}

async function parseCsv(csvString) {
  return csv({
    noheader: false,
    output: "json"
  }).fromString(csvString);
}

function timestamp() {
  const regex = /[-:\. TZ]/gi;
  return new Date().toISOString().replace(regex, "");
}

module.exports = { getNewModVersion, releaseTypeFromInspectResults };
