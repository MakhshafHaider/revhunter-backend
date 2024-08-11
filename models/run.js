/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// models/run.js
class Run {
    constructor(id, name, campaign, user) {
      this.id = id;
      this.campaign = campaign;
      this.user = user;
      this.client = client;
      this.totalEnrichmentBatch = totalEnrichmentBatch;
      this.progress = progress;
      this.errors = errors;
      this.errorlog = errorlog;
    }
  
    static async create(runObj) {
      // Insert to DB and return a new Run instance
    }
  
    static async find(runObj) {
      // Find from DB and return a new Run instance
    }
  
    // Other data access methods
  }
  module.exports = Run;
  