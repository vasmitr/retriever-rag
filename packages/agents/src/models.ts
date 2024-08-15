import { ChatOllama } from "@langchain/ollama";

export const jsonOllamaModel = new ChatOllama({
  model: "llama3.1:latest",
  format: "json",
  temperature: 0,
  baseUrl: process.env.OLLAMA_URL,
});

export const ollamaModel = new ChatOllama({
  model: "llama3.1:latest",
  temperature: 0,
  baseUrl: process.env.OLLAMA_URL,
});
