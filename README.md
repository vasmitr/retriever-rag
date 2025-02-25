# Configurable retriever API

Use local LLM to retrieve project files related to your question.

This project uses an Electron UI to provide simple docker-compose configuration.
It will run few services: - API to retrieve the data - Worker to index project files - Qdrant to store file index and perform the vector search

It was ment to use toghether with [Continue](https://www.continue.dev/) VSCode plugin

## Requirements

- Install docker & docker-compose
- Download [Ollama](https://ollama.com/)
- Pull main LLM `ollama pull llama3.1:latest`
- Pull embeddings model `ollama pull nomic-embed-text:latest`
- Run `ollama serve`

## Usage

1. Run

```sh
npm turbo dev
```

2. Add your project directories into the list

3. Ask your question

##### Request

```
curl --location 'http://localhost:49152/api/retrieve' \
--header 'Content-Type: application/json' \
--data '{
    "query": "where is the user api",
    "project": "api-example"
}'
```

##### Response

<details>

```
[
    {
        "contents": [
            "### File: server.ts\n/* eslint-disable no-console */\nimport dotenv from 'dotenv';\nimport dotenvExpand from 'dotenv-expand';\nimport express from 'express';\nimport mongoose from 'mongoose';\nimport bodyParser from 'body-parser';\nimport passport from 'passport';\nimport cors from 'cors';\n\nimport users from './routes/api/users';\nimport catalog from './routes/api/catalog';\nimport orders from './routes/api/orders';\nimport admin from './routes/api/admin';\n\nconst env = dotenv.config();\ndotenvExpand(env);\n\nconst app = express();\n\n// Body parser middleware\napp.use(bodyParser.urlencoded({ extended: false }));\napp.use(bodyParser.json());\n\napp.use(cors());\n\n// DB settings\nconst db = process.env.MONGO_URI;\nmongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true })\n    .then(() => console.log('Mongo connected'))\n    .catch((err) => console.error(err));\n\n// Passport middleware\napp.use(passport.initialize());\n\n// Passport Config\nimport('./config/passport')\n    .then((passportConfig) => passportConfig.default(passport));\n\n// Use routes\napp.use('/api/users', users);\napp.use('/api/catalog', catalog);\napp.use('/api/orders', orders);\napp.use('/api/admin', admin);\n\nconst PORT = process.env.PORT || 5000;\n\napp.listen(PORT, () => console.log(`App is listen on ${PORT}`));\n"
        ],
        "title": "server.ts",
        "description": "server.ts",
        "project": "api-example"
    },
    ...
]
```

</details>

## Using with Continue as custom `@retrieve` command

<details>
~/.continue/config.ts

```
const RagContextProvider: CustomContextProvider = {
  title: "@retrieve",
  displayTitle: "retrieve",
  type: "normal",
  description: "Retrieve snippets",

  getContextItems: async (
    _query: string, // This is null for some reason
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> => {
    const dirs = await extras.ide.getWorkspaceDirs();

    const projectPath = dirs[0].split("/");
    const projectName = projectPath[projectPath.length - 1];

    // Remove command from the query
    const query = extras.fullInput.replace("retrieve ", "");

    const response = await fetch("http://localhost:49152/api/retrieve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        project: projectName,
      }),
    });

    const results = await response.json();

    if (!results || results.length === 0) {
      throw new Error("No results");
    }

    return results.map((result: Record<string, unknown>) => ({
      name: result.title,
      description: result.title,
      content: result.contents,
    }));
  },
};

export function modifyConfig(config: Config): Config {
  if (!config.contextProviders) {
    config.contextProviders = [];
  }
  config.contextProviders.push(RagContextProvider);
  return config;
}
```

</details>

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `desktop`: an Electron app
- `server`: an Api entrypoint
- `worker`: a Cron job that watches file changes
- `@repo/agents` Set of LangGraph agents to convert user question into searhc keywords
- `@repo/store` QDRANT interfaces
- `@repo/utils` Set of filesystem & git utils to interact with project files
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo
