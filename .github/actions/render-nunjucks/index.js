const _ = require("lodash");
const core = require("@actions/core");
const fs = require("fs-extra");
const nunjucks = require("nunjucks");

main();

async function main() {
  try {
    const inputFilePath = core.getInput("inputFilePath");
    const outputFilePath = core.getInput("outputFilePath");
    const renderDataFilePath = core.getInput("renderDataFilePath");

    //const inputFilePath = "template.md";
    //const outputFilePath = "zzz.md";
    //const renderDataFilePath = "data.json";

    const renderDataContent = await readJsonFile(renderDataFilePath);
    // TODO: What to do if releaseNotes key doesn't exist?
    // Sort by date in descending order to ensure the latest release note is
    // first
    const sortedReleaseNotes = _.sortBy(renderDataContent.releaseNotes, "date").reverse();

    // Format the date field and sort details
    const releaseNoteDataFormatted = sortedReleaseNotes.map(releaseNote => {
      // Dates come in as 2020-02-20T12:51:33.228Z, but for the markdown we
      // only want yyyy-mm-dd
      const formattedDate = releaseNote.date.split("T")[0];
      releaseNote.date = formattedDate;
      // Sort all details in ascending alphabetical order
      for (const type of ["Resource Type", "Control Type", "Policy Type", "Action Type"]) {
        releaseNote.details[type].added = _.sortBy(releaseNote.details[type].added, "Path");
        releaseNote.details[type].renamed = _.sortBy(releaseNote.details[type].renamed, "Path");
        releaseNote.details[type].removed = _.sortBy(releaseNote.details[type].removed, "Path");
      }
      return releaseNote;
    });

    const releaseNoteData = {
      releaseNotes: releaseNoteDataFormatted
    };

    const renderedText = renderFile(inputFilePath, releaseNoteData);
    await fs.writeFile(outputFilePath, renderedText);
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function readJsonFile(inputFilePath) {
  if (!fs.pathExistsSync(inputFilePath)) {
    throw Error(`Failed to read render JSON file: input file path ${inputFilePath} does not exist`);
  }

  const jsonData = await fs.readJson(inputFilePath);
  return jsonData;
}

function renderFile(inputFilePath, data) {
  if (!fs.pathExistsSync(inputFilePath)) {
    throw Error(`Failed to render file: input file path ${inputFilePath} does not exist`);
  }
  console.log(`Rendering ${inputFilePath} with data:`, data);
  // Load file
  const renderedText = nunjucks.render(inputFilePath, data);
  console.log("Rendered text:", renderedText);
  return renderedText;
}

module.exports = {
  readJsonFile,
  renderFile
};
