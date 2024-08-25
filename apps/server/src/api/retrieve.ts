import { Router } from "express";
import path from "path";

import { invokeRetrievalAgent } from "@repo/agents";

const router = Router();
const { PROJECTS_PATH = "/data" } = process.env;

router.post("/", async (req, res) => {
  try {
    console.log(req.body);
    const query = (req.body?.query || "") as string;
    const projectName = req.body?.project as string;

    console.log("Query:", query);
    console.log("Project:", projectName);

    if (!query || !projectName) {
      return res
        .status(400)
        .json({ error: "Query and project name are required" });
    }

    const projectPath = path.join(PROJECTS_PATH, projectName);
    const result = await invokeRetrievalAgent(query, projectPath);
    const documents = result.documents || [];

    console.log("Documents found", documents.length);

    res.json(
      documents.map((doc) => ({
        contents: [doc.pageContent],
        title: doc.metadata?.filePath || "",
        description: doc.metadata?.filePath || "",
        project: projectName,
      }))
    );
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "An error occurred while processing the request" });
  }
});

export default router;
