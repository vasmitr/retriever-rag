import { readdir, readFile as fsReadFile, stat } from "fs/promises";
// const _guard = (path) => path.replace('../', '')

const IGNORE = [
  /node_modules/,
  /^(\.|\S+\.lock$)/,
  /^(\.)/,
  /\.(png|jpg|jpeg|ico)$/,
];

export async function* readDirectory(path: string): AsyncGenerator<string> {
  // path = _guard(path)

  for await (const dirEntry of await readdir(path)) {
    const entryPath = `${path}/${dirEntry}`;
    if (IGNORE.some((ignore) => ignore.test(dirEntry))) {
      continue;
    }
    if ((await stat(entryPath)).isDirectory()) {
      yield* readDirectory(entryPath);
    } else {
      yield entryPath;
    }
  }
}

export const readThree = async (path: string): Promise<string[]> => {
  const filePaths: string[] = [];
  for await (const filePath of readDirectory(path)) {
    filePaths.push(filePath);
  }

  return filePaths;
};

export async function readFile(path: string): Promise<string> {
  // path = _guard(path)
  try {
    const content = (await fsReadFile(path)).toString();
    return content;
  } catch (error) {
    console.error(`Error reading file ${path}:`, error);
    return "";
  }
}
