const assert = require("chai").assert;
const {getNewModVersion, releaseTypeFromInspectResults} = require("..")

describe("turbot CLI tests", function() {
    it("getNewModVersion - no current version", function(done) {
      const version = getNewModVersion("1.0.0", "1.0.0-blah", "minor")

    })
    it("releaseTypeFromInspectResults", function(done) {

    })
})