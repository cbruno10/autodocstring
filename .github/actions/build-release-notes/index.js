const _ = require("lodash");
const core = require("@actions/core");
const csv = require("csvtojson");
const fs = require("fs-extra");
const jsYaml = require("js-yaml");
const semver = require("semver");
const { request } = require("@octokit/request");

main();

/*
version: 5.0.0-rc.202002025
date: 2020-02-25
notes:
  whatsNew:
    - "This is a release note"
    - "blah blah"
  bugFixes:
    - "blah blah"
    - "this is a fix"
details:
  resource:
    added:
      - uri: "tmod:..."
        path: "AWS > S3 > Bucket"
    removed:
      - uri: "tmod:..."
        path: "AWS > S3 > Bucket"
    renamed:
      - uri: "tmod:..."
        oldPath: "..."
        newPath: "..."
  policy:
  control:
  action:
*/

async function main() {
  try {
    // Get release note data, including labels and get release level
    let modsIssueNumbers = parseIssueNumbers(core.getInput("modsIssueNumbers"));
    let githubToken = core.getInput("githubToken");
    let repository = core.getInput("repository");
    let releaseNoteRepo = core.getInput("releaseNoteRepository");
    let productionRelease = core.getInput("productionRelease");

    /*
    modsIssueNumbers = ["6", "5"];
    repository = "cbruno10/turbot-mods";
    releaseNoteRepo = "turbotio/rn";
    */

    // Remove any duplicates to prevent duplicate release notes
    let uniqueModsIssueNumbers = [...new Set(modsIssueNumbers)];

    const rnIssueNums = await getReleaseNoteIssueNumbers(githubToken, uniqueModsIssueNumbers, repository);
    const releaseNoteData = await getReleaseNoteData(githubToken, rnIssueNums, releaseNoteRepo);

    // Get inspect results to view added/removed types
    const currentReleasedVersion = core.getInput("masterVersion");
    const latestVersion = core.getInput("workingVersion");

    const currentInspectResults = await fs.readFile(core.getInput("workingInspect"), "utf8");
    const masterInspectResults = await fs.readFile(core.getInput("masterInspect"), "utf8");

    //console.log("Current inspect results:", currentInspectResults);
    //console.log("Master inspect results:", masterInspectResults);

    // Parse both CSVs for easier handling
    const currentCsv = await parseCsv(currentInspectResults);
    const masterCsv = await parseCsv(masterInspectResults);

    // Get all added, removed, and renamed types and release level
    const inspectData = getInspectData(currentCsv, masterCsv);
    console.log(`Inspect data: ${inspectData}`);

    // Take higher release level between the types from issues and inspect results
    const releaseLevel = resolveReleaseLevel([releaseNoteData.level, inspectData.level]);
    console.log(`Release level: ${releaseLevel}`);

    const newVersion = getNewModVersion(currentReleasedVersion, latestVersion, releaseLevel, productionRelease);
    console.log("New mod version:", newVersion);

    const compiledReleaseNotes = {};
    compiledReleaseNotes[newVersion] = {
      date: new Date(),
      version: newVersion,
      details: inspectData,
      notes: releaseNoteData
    };

    const compiledReleaseNotesYaml = jsYaml.safeDump(compiledReleaseNotes);
    console.log("YAML:", compiledReleaseNotesYaml);

    core.setOutput("version", newVersion);
    core.setOutput("releaseNoteDataYaml", compiledReleaseNotesYaml);
  } catch (error) {
    core.setFailed(error.message);
  }
}

function releaseLevelFromIssues(releaseNoteData) {
  const levels = ["major", "minor", "patch"];
  for (const level of levels) {
    if (releaseNoteData.find(data => data.levels.includes(level))) {
      return level;
    }
  }

  // TODO: No match, what should this return?
  return "N/A";
}

function getInspectData(currentCsv, masterCsv) {
  //console.log("Current CSV:", currentCsv);
  //console.log("Master CSV:", masterCsv);

  const inspectTypes = ["Resource Type", "Control Type", "Action Type", "Policy Type"];

  const inspectDiffResults = {
    level: "patch",
    "Resource Type": {
      added: [],
      removed: [],
      renamed: []
    },
    "Control Type": {
      added: [],
      removed: [],
      renamed: []
    },
    "Action Type": {
      added: [],
      removed: [],
      renamed: []
    },
    "Policy Type": {
      added: [],
      removed: [],
      renamed: []
    }
  };

  for (const type of inspectTypes) {
    // Get current and master results for each type
    const currentResults = currentCsv.filter(line => line["Item Type"] === type);
    const masterResults = masterCsv.filter(line => line["Item Type"] === type);

    //console.log(`Type: ${type}`);
    //console.log("Current results:", currentResults);
    //console.log("Master results:", masterResults);

    const addedTypes = _.differenceBy(currentResults, masterResults, "Uri");
    const removedTypes = _.differenceBy(masterResults, currentResults, "Uri");
    const renamedTypes = _.compact(
      currentResults.map(currentItem => {
        const renamedMasterItem = masterResults.find(
          masterItem => currentItem.Uri === masterItem.Uri && currentItem.Path !== masterItem.Path
        );
        if (!renamedMasterItem) {
          return null;
        }
        let newCurrentItem = currentItem;
        newCurrentItem.OldPath = renamedMasterItem.Path;
        return newCurrentItem;
      })
    );

    // Get old paths for renamed types
    console.log("Added:", addedTypes);
    console.log("Removed:", removedTypes);
    console.log("Renamed:", renamedTypes);
    console.log("\n");

    // Add into inspectDiffResults
    inspectDiffResults[type].added = addedTypes;
    inspectDiffResults[type].removed = removedTypes;
    inspectDiffResults[type].renamed = renamedTypes;
  }

  console.log("Inspect diff results:", inspectDiffResults);

  // Determine level based off of types of changes
  let level = "patch";

  console.log(
    _.union(
      inspectDiffResults["Control Type"]["added"],
      inspectDiffResults["Policy Type"]["added"],
      inspectDiffResults["Resource Type"]["added"]
    )
  );

  // Any control, policy, or resource additions are features
  if (
    !_.isEmpty(
      _.union(
        inspectDiffResults["Control Type"]["added"],
        inspectDiffResults["Policy Type"]["added"],
        inspectDiffResults["Resource Type"]["added"]
      )
    )
  ) {
    console.log("Setting level to minor");
    level = "minor";
  }

  // Any control, policy, or resource removals are breaking changes
  if (
    !_.isEmpty(
      _.union(
        inspectDiffResults["Control Type"]["removed"],
        inspectDiffResults["Policy Type"]["removed"],
        inspectDiffResults["Resource Type"]["removed"]
      )
    )
  ) {
    console.log("Setting level to major");
    level = "major";
  }

  inspectDiffResults.level = level;

  return inspectDiffResults;
}

function resolveReleaseLevel(releaseLevels) {
  if (releaseLevels.includes("major")) return "major";
  if (releaseLevels.includes("minor")) return "minor";
  if (releaseLevels.includes("patch")) return "patch";
  // TODO: What should this return?
  return "N/A";
}

function getNewModVersion(currentReleasedVersion, latestVersion, releaseLevel, productionRelease) {
  // If there is a currently released version, recalculate latest version based on release level
  let version = currentReleasedVersion ? semver.inc(currentReleasedVersion, releaseLevel) : latestVersion;

  // If not prod, make it a prerelease
  if (productionRelease !== "true") {
    version += `-rc.${timestamp()}`;
  }

  return version;
}

async function parseCsv(csvString) {
  return csv({
    noheader: false,
    output: "json"
  }).fromString(csvString);
}

function timestamp() {
  const regex = /[-:. TZ]/gi;
  return new Date().toISOString().replace(regex, "");
}

function parseIssueNumbers(issueNumbersInput) {
  // Commits come in as '#1 #2 #3'
  const issueNumbersSplit = issueNumbersInput.split(" ");
  // Remove # before each issue number
  const issueNumbers = issueNumbersSplit.map(number => {
    return number.substring(1);
  });
  return issueNumbers;
}

async function getReleaseNoteIssueNumbers(githubToken, modsIssueNumbers, repository) {
  // Get body of each turbot-mods issue
  // Get turbotio/rn#num from each body
  try {
    const promises = modsIssueNumbers.map(async issueNum => {
      const issueContent = await request("GET /repos/:repo/issues/:issue_number", {
        headers: {
          authorization: `token ${githubToken}`
        },
        repo: repository,
        issue_number: issueNum
      });
      const issueData = issueContent.data;
      const body = issueData.body;
      // TODO: Fix this bad coding once format is finalized
      const bodySplit = body.split("\r");
      //console.log("Body split:", bodySplit);
      const rnIssueLine = bodySplit.find(line => line.startsWith("\nturbotio/rn#"));
      //console.log("RN issue line:", rnIssueLine);
      const hashIndex = rnIssueLine.indexOf("#");
      const rnIssueNum = rnIssueLine.substring(hashIndex + 1);

      return rnIssueNum;
    });

    const rnIssueNums = await Promise.all(promises);
    console.log("Release note issues:", rnIssueNums);
    return rnIssueNums;
  } catch (err) {
    console.log("Failed to get release note issue:", err);
  }
}

async function getReleaseNoteData(githubToken, rnIssueNumbers, releaseNoteRepo) {
  // Get body of each rn issue
  try {
    const rnPromises = rnIssueNumbers.map(async issueNum => {
      const issueContent = await request("GET /repos/:repo/issues/:issue_number", {
        headers: {
          authorization: `token ${githubToken}`
        },
        repo: releaseNoteRepo,
        issue_number: issueNum
      });
      const issueData = issueContent.data;

      // Get labels
      let labelNames = [];
      // Each field below should only be set once, but capture all for error
      // handling
      let sections = [];
      let levels = [];
      let positions = [];
      for (const label of issueData.labels) {
        labelNames.push(label.name);

        // # - Section
        // ^ - Level
        // ~ - Position
        if (label.name.startsWith("#")) {
          sections.push(label.name.split("#")[1].trim());
        }
        if (label.name.startsWith("~")) {
          positions.push(label.name.split("~")[1].trim());
        }
        if (label.name.startsWith("^")) {
          levels.push(label.name.split("^")[1].trim());
        }
      }

      // Get release note(s)
      const body = issueData.body;
      // Get all text below "**Release note**" in body
      // TODO: Fix this bad coding once format is finalized
      const bodySplit = body.split("**Release note**\r\n");
      const content = bodySplit.slice(-1)[0];
      //console.log('Content:', content);
      // Write all release note messages and other data into a structure
      const releaseNoteData = {
        labels: labelNames,
        sections: sections,
        levels: levels,
        positions: positions,
        content: content
      };

      return releaseNoteData;
    });

    const rnIssueNotes = await Promise.all(rnPromises);
    console.log("Release note issue data:", rnIssueNotes);

    const level = releaseLevelFromIssues(rnIssueNotes);
    console.log("Level from issue:", level);

    const releaseNoteSections = {
      "Bug fixes": {
        top: [],
        middle: [],
        bottom: []
      },
      Security: {
        top: [],
        middle: [],
        bottom: []
      },
      Warning: {
        top: [],
        middle: [],
        bottom: []
      },
      "What's new?": {
        top: [],
        middle: [],
        bottom: []
      }
    };

    // Build top/middle/bottom notes for each section
    // TODO: Handle multiple position and section labels
    for (const note of rnIssueNotes) {
      let position = "middle";
      // Override if top or bottom
      if (["top", "bottom"].includes(note.positions[0])) {
        position = note.positions[0];
      }

      const section = note.sections[0];

      releaseNoteSections[section][position].push(note.content);
    }

    console.log("Release note sections:", releaseNoteSections);
    const composedReleaseNotes = {
      level: level,
      "Bug fixes": [],
      Security: [],
      Warning: [],
      "What's new?": [],
      invalidNotes: []
    };

    // Push top/middle/bottom notes into each section
    for (const section in releaseNoteSections) {
      composedReleaseNotes[section] = [
        ...releaseNoteSections[section]["top"],
        ...releaseNoteSections[section]["middle"],
        ...releaseNoteSections[section]["bottom"]
      ];
    }

    return composedReleaseNotes;
  } catch (err) {
    console.log("Failed to get release note issue data:", err);
  }
}

module.exports = {
  getNewModVersion,
  releaseLevelFromIssues,
  getInspectData,
  resolveReleaseLevel,
  parseIssueNumbers,
  getReleaseNoteIssueNumbers,
  getReleaseNoteData
};
