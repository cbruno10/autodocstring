const core = require("@actions/core");
const fs = require("fs-extra");

main();

async function main() {
  try {
    const newVersion = core.getInput("version");
    const modFilePath = core.getInput("modFilePath");
    await updateModVersion(modFilePath, newVersion);
    console.log(`Successfully updated ${modFilePath} to version ${version}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function updateModVersion(modFilePath, version) {
  if (!fs.pathExistsSync(modFilePath)) {
    throw Error(`Failed to update mod version: mod path ${modFilePath} does not exist`);
  }

  console.log(`Updating ${modFilePath} to version ${version}`);
  // Load mod
  let modText = await fs.readFile(modFilePath, "utf8");
  // Update version
  modText = modText.replace(/version: ["0-9a-z.-]*/, `version: "${version}"`);
  // Save mode
  await fs.writeFile(modFilePath, modText);
}

module.exports = {
  updateModVersion
};
