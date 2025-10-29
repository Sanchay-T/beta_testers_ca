const { expect } = require("chai");
const proxyquire = require("proxyquire").noCallThru();

describe("MetricsService", () => {
  let uploadedPayloads;
  let uploadShouldFail;
  let lastBuildArgs;

  class StubBuilder {
    async buildPayload(args) {
      lastBuildArgs = args;
      return {
        metrics_version: "vtest",
        meta: {
          export_trigger: args.trigger,
          queue_depth: args.queueDepth,
          upload_attempts: args.attempt,
        },
      };
    }
  }

  class StubQueue {
    constructor() {
      this.items = [];
    }

    getPending() {
      return [...this.items];
    }

    save(pending) {
      this.items = [...pending];
    }

    enqueue(payload) {
      this.items.push({ payload, attempts: 0 });
      return this.items.length;
    }

    peek() {
      return this.items[0] || null;
    }

    shift() {
      return this.items.shift() || null;
    }

    incrementAttempts() {
      if (!this.items.length) {
        return 0;
      }
      this.items[0].attempts += 1;
      if (this.items[0].payload.meta) {
        this.items[0].payload.meta.upload_attempts = this.items[0].attempts;
      }
      return this.items[0].attempts;
    }

    clear() {
      this.items = [];
    }
  }

  class StubUploader {
    async upload(payload) {
      uploadedPayloads.push(payload);
      if (uploadShouldFail) {
        return { success: false, error: "network-error" };
      }
      return { success: true, status: 200 };
    }
  }

  const MetricsService = proxyquire("../services/metrics/MetricsService", {
    "./MetricsPayloadBuilder": StubBuilder,
    "./MetricsUploader": StubUploader,
    "./MetricsQueue": StubQueue,
  });

  beforeEach(() => {
    uploadedPayloads = [];
    uploadShouldFail = false;
    lastBuildArgs = null;
  });

  it("uploads immediately when the endpoint succeeds", async () => {
    const service = new MetricsService({ userDataPath: "test-path" });
    const result = await service.exportAndUpload({ trigger: "manual" });

    expect(result).to.deep.equal({ success: true, uploaded: true });
    expect(uploadedPayloads).to.have.length(1);
    expect(uploadedPayloads[0].meta.export_trigger).to.equal("manual");
    expect(lastBuildArgs.queueDepth).to.equal(0);
  });

  it("queues payload when upload fails and flushes later", async () => {
    const service = new MetricsService({ userDataPath: "test-path" });
    uploadShouldFail = true;

    const result = await service.exportAndUpload({ trigger: "manual" });
    expect(result.queued).to.equal(true);
    expect(uploadedPayloads).to.have.length(1); // attempted once

    // Next upload succeeds
    uploadShouldFail = false;
    const flushed = await service.flushQueue();

    expect(flushed).to.equal(1);
    expect(service.queue.getPending()).to.have.length(0);
    expect(uploadedPayloads).to.have.length(2); // second attempt succeeded
  });
});
