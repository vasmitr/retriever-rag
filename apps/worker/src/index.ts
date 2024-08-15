import * as dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import { ChangesQueue } from "@repo/store/changes-queue";

class FileProcessingWorker {
  private queue: ChangesQueue;
  private isProcessing: boolean = false;
  private _basePath: string;

  constructor(qdrantUrl: string, basePath = "./") {
    this.queue = new ChangesQueue(qdrantUrl);
    this._basePath = basePath;
  }

  public async start(): Promise<void> {
    // Support starting on project directory
    console.log(this.queue);

    this.processFiles();
    cron.schedule("*/10 * * * *", () => {
      this.processFiles();
    });
  }

  private async processFiles(): Promise<void> {
    if (this.isProcessing) {
      console.log("Already processing files. Skipping this run.");
      return;
    }

    this.isProcessing = true;
    console.log("Starting file processing...");
  }
}

async function main() {
  const qdrantUrl = process.env.QDRANT_URL || "";

  const worker = new FileProcessingWorker(qdrantUrl, process.env.PROJECT_PATH);
  await worker.start();

  // Keep the process running
  process.stdin.resume();
}

main().catch(console.error);
