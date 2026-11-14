"use strict";

const fs = require("node:fs");
const path = require("node:path");

function defaultState() {
  return {
    version: 1,
    activeJobId: null,
    jobs: [],
    candidates: [],
    knowledgeDocuments: [],
    knowledgeSeeded: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.state = this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) return defaultState();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return {
        ...defaultState(),
        ...parsed,
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
        candidates: Array.isArray(parsed.candidates) ? parsed.candidates : [],
        knowledgeDocuments: Array.isArray(parsed.knowledgeDocuments)
          ? parsed.knowledgeDocuments
          : [],
      };
    } catch (error) {
      const backupPath = `${this.filePath}.corrupt-${Date.now()}`;
      fs.copyFileSync(this.filePath, backupPath);
      return defaultState();
    }
  }

  save() {
    this.state.updatedAt = new Date().toISOString();
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), "utf8");
    fs.renameSync(tempPath, this.filePath);
  }

  getJob(jobId) {
    return this.state.jobs.find((job) => job.id === jobId) || null;
  }

  getCandidate(jobId, candidateId) {
    return this.state.candidates.find(
      (candidate) => candidate.id === candidateId && candidate.jobId === jobId,
    ) || null;
  }

  jobCandidates(jobId) {
    return this.state.candidates.filter((candidate) => candidate.jobId === jobId);
  }

  removeJob(jobId) {
    this.state.jobs = this.state.jobs.filter((job) => job.id !== jobId);
    this.state.candidates = this.state.candidates.filter((candidate) => candidate.jobId !== jobId);
    if (this.state.activeJobId === jobId) {
      this.state.activeJobId = this.state.jobs[0]?.id || null;
    }
    this.save();
  }

  removeCandidate(jobId, candidateId) {
    const before = this.state.candidates.length;
    this.state.candidates = this.state.candidates.filter(
      (candidate) => !(candidate.id === candidateId && candidate.jobId === jobId),
    );
    if (before === this.state.candidates.length) return false;
    this.save();
    return true;
  }
}

module.exports = { JsonStore, defaultState };
