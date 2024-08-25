import * as dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import { ChangesQueue } from "@repo/store/changes-queue";
import fs from "fs/promises";
import path from "path";
import { Store } from "@repo/store/store";
import { detectChanges } from "@repo/utils/git";
import { readDirectory } from "@repo/utils/fs";
import { QdrantClient } from "@qdrant/js-client-rest";

class FileProcessingWorker {
  private queue: ChangesQueue;
  private qdrantClient: QdrantClient;
  private store: Store;
  private isProcessing: boolean = false;
  private _basePath: string;

  constructor(qdrantUrl: string, basePath: string) {
    this.queue = new ChangesQueue(qdrantUrl);
    this.qdrantClient = new QdrantClient({ url: qdrantUrl });
    this.store = new Store();
    this._basePath = basePath;
    console.log(`Worker initialized with base path: ${this._basePath}`);
  }

  public async start(): Promise<void> {
    console.log("File processing worker started.");
    await this.processProjects();
    cron.schedule("*/1 * * * *", () => {
      this.processProjects().catch(console.error);
    });
  }

  private async processProjects(): Promise<void> {
    if (this.isProcessing) {
      console.log("Already processing projects. Skipping this run.");
      return;
    }

    this.isProcessing = true;
    console.log("Starting project processing...");

    try {
      const projects = await this.getProjects();
      console.log(
        `Found ${projects.length} valid projects: ${projects.join(", ")}`
      );
      for (const project of projects) {
        try {
          await this.processProject(project);
          // Add a small delay between processing projects
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error processing project ${project}:`, error);
        }
      }
      await this.listAllQueues();
    } catch (error) {
      console.error("Error during project processing:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async getProjects(): Promise<string[]> {
    console.log(`Scanning for projects in: ${this._basePath}`);
    const projects = await fs.readdir(this._basePath);
    console.log(`Found directories: ${projects.join(", ")}`);
    const validProjects = await Promise.all(
      projects.map(async (project) => {
        const projectPath = path.join(this._basePath, project);
        const isDirectory = (await fs.stat(projectPath)).isDirectory();
        const hasGit = await fs
          .access(path.join(projectPath, ".git"))
          .then(() => true)
          .catch(() => false);
        console.log(
          `Project ${project}: isDirectory=${isDirectory}, hasGit=${hasGit}`
        );
        return isDirectory && hasGit ? project : null;
      })
    );
    return validProjects.filter(Boolean) as string[];
  }

  private async processProject(projectId: string): Promise<void> {
    console.log(`Processing project: ${projectId}`);
    const projectPath = path.join(this._basePath, projectId);

    const queueSize = await this.queue.getQueueSize(projectId);
    console.log(`Current queue size for project ${projectId}: ${queueSize}`);

    if (queueSize === 0) {
      await this.queueAllFiles(projectId, projectPath);
    } else {
      await this.queueGitFiles(projectId, projectPath);
    }

    await this.processFiles(projectId, projectPath);
  }

  private async queueAllFiles(
    projectId: string,
    projectPath: string
  ): Promise<void> {
    console.log(`Loading all files for project: ${projectId}`);

    for await (const filePath of readDirectory(projectPath)) {
      const relativePath = path.relative(projectPath, filePath);
      const enqueued = await this.queue.enqueue(projectId, relativePath);
      console.log(`Enqueued ${relativePath}: ${enqueued}`);
    }
  }

  private async queueGitFiles(
    projectId: string,
    projectPath: string
  ): Promise<void> {
    console.log(`Loading git changes for project: ${projectId}`);
    const { hasChanged, changedFiles } = await detectChanges(projectPath);
    console.log(
      `Git changes detected: ${hasChanged}, files: ${changedFiles.join(", ")}`
    );
    if (!hasChanged) {
      return;
    }

    for (const file of changedFiles) {
      const enqueued = await this.queue.enqueue(projectId, file);
      console.log(`Enqueued changed file ${file}: ${enqueued}`);
    }
  }

  private async processFiles(
    projectId: string,
    projectPath: string
  ): Promise<void> {
    console.log(`Processing files for project: ${projectId}`);
    let filesProcessed = 0;

    while (true) {
      const filePath = await this.queue.dequeue(projectId);
      if (filePath === null) {
        break;
      }

      try {
        const fullPath = path.join(projectPath, filePath);
        const content = await this.readFile(fullPath);
        if (content === null || content === "") {
          console.log(`Skipping empty or non-existent file: ${filePath}`);
          continue;
        }

        await this.store.indexFile(projectId, {
          project: projectId,
          filePath,
          content,
        });
        filesProcessed++;
        console.log(`Indexed file: ${filePath}`);
      } catch (error) {
        console.error(
          `Error processing file ${filePath} in project ${projectId}:`,
          error
        );
      }
    }

    console.log(`Processed ${filesProcessed} files in project ${projectId}.`);
  }

  private async readFile(filePath: string): Promise<string | null> {
    console.log(`Reading file: ${filePath}`);

    try {
      await fs.access(filePath);
    } catch (error) {
      console.error(`File not accessible: ${filePath}`);
      return null;
    }

    return await fs.readFile(filePath, "utf-8");
  }

  private async listAllQueues(): Promise<void> {
    console.log("Listing all queues in Qdrant:");
    try {
      const collections = await this.qdrantClient.getCollections();
      const queueCollections = collections.collections.filter((collection) =>
        collection.name.startsWith("changes_queue_")
      );

      for (const collection of queueCollections) {
        const info = await this.qdrantClient.getCollection(collection.name);
        console.log(
          `Queue: ${collection.name}, Size: ${info.points_count || 0}`
        );
      }
    } catch (error) {
      console.error("Error listing queues:", error);
    }
  }
}

async function main() {
  const qdrantUrl = process.env.QDRANT_URL || "";
  const projectsPath = process.env.PROJECTS_PATH || "/data";

  console.log(`Starting worker with QDRANT_URL: ${qdrantUrl}`);
  console.log(`Projects path: ${projectsPath}`);

  const worker = new FileProcessingWorker(qdrantUrl, projectsPath);
  await worker.start();

  // Keep the process running
  process.stdin.resume();
}

main().catch(console.error);
