import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: Deno.env.get("GITHUB_TOKEN"),
});

const owner = "rojvv";
const repo = "config-tracker";
const branch = "main";
export async function commit(path: string, content: string) {
  content = new TextEncoder().encode(content).toBase64();

  let delay = 100;

  for (;;) {
    try {
      let sha: string | undefined;

      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        });

        if (!Array.isArray(data) && data.type === "file") {
          sha = data.sha;
        }
      } catch (err: any) {
        if (err.status !== 404) throw err;
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `Update ${path}`,
        content,
        branch,
        ...(sha && { sha }),
      });

      return; // success
      // deno-lint-ignore no-explicit-any
    } catch (err: any) {
      if (err.status !== 409) throw err;

      // Back off to avoid hammering GitHub.
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 5000);
    }
  }
}
