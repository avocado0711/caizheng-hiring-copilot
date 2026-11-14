"use strict";

const { redactResumeForLlm } = require("../lib/evidence");

function safeFileName(fileName, candidateName) {
  return redactResumeForLlm(String(fileName || "resume"), candidateName)
    .replace(/\n+/g, " ")
    .slice(0, 240);
}

module.exports = { safeFileName };
