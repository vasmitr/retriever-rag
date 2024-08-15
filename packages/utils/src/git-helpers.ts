import simpleGit, { SimpleGit, StatusResult } from "simple-git";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { QdrantClient } from "@qdrant/js-client-rest";

const collectionName = "git-state"; // TODO: support multiple projects

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
});

interface GitState {
  lastCommitHash?: string;
  lastFileHash?: string;
  lastUpdateTimestamp?: number;
}

interface ChangeDetectionResult {
  hasChanged: boolean;
  changedFiles: string[];
  currentCommitHash: string;
  currentFileHash: string;
  status: StatusResult;
}

async function getFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash("md5").update(content).digest("hex");
}

async function getChangedFilesHash(
  directory: string,
  changedFiles: string[]
): Promise<string> {
  const hashes = await Promise.all(
    changedFiles.map(async (file) => {
      const fullPath = path.join(directory, file);
      return await getFileHash(fullPath);
    })
  );
  const combinedHash = hashes.join("");
  return crypto.createHash("md5").update(combinedHash).digest("hex");
}

async function getGitChanges(
  directory: string
): Promise<[string[], string, StatusResult, string]> {
  const git: SimpleGit = simpleGit(directory);

  try {
    const status: StatusResult = await git.status();
    const currentCommitHash = await git.revparse(["HEAD"]);

    const changedFiles = [
      ...status.modified,
      ...status.not_added,
      ...status.created,
      ...status.renamed.map((file) => file.to),
      ...status.deleted,
    ];

    const uniqueChangedFiles = [...new Set(changedFiles)];
    const currentFileHash = await getChangedFilesHash(
      directory,
      uniqueChangedFiles
    );

    return [uniqueChangedFiles, currentCommitHash, status, currentFileHash];
  } catch (error) {
    console.error("Error getting Git status:", error);
    return [[], "", {} as StatusResult, ""];
  }
}

async function loadLastState(): Promise<GitState> {
  try {
    const result = await qdrantClient.search(collectionName, {
      with_payload: true,
      with_vector: false,
      vector: [1],
      limit: 1,
    });
    if (result.length === 0) {
      return {};
    }

    const point = result[0];

    return point.payload || {};
  } catch (error) {
    return { lastCommitHash: "", lastFileHash: "", lastUpdateTimestamp: 0 };
  }
}

async function saveState(state: GitState): Promise<void> {
  // await fs.writeFile(stateFile, JSON.stringify(state, null, 2));

  await qdrantClient.recreateCollection(collectionName, {
    vectors: { size: 1, distance: "Dot" },
  });

  await qdrantClient.upsert(collectionName, {
    wait: true,
    points: [
      {
        id: 1,
        vector: [1],
        payload: state as unknown as Record<string, unknown>,
      },
    ],
  });
}

export async function detectChanges(
  directory: string
): Promise<ChangeDetectionResult> {
  const [changedFiles, currentCommitHash, status, currentFileHash] =
    await getGitChanges(directory);
  const lastState = await loadLastState();

  const hasChanged =
    currentCommitHash !== lastState.lastCommitHash ||
    currentFileHash !== lastState.lastFileHash;

  if (hasChanged) {
    const newState: GitState = {
      lastCommitHash: currentCommitHash,
      lastFileHash: currentFileHash,
      lastUpdateTimestamp: Date.now(),
    };
    await saveState(newState);
  }

  return {
    hasChanged,
    changedFiles,
    currentCommitHash,
    currentFileHash,
    status,
  };
}
