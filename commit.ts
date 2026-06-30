import { Octokit } from "@octokit/rest";
import { delay } from "@std/async/delay";

const octokit = new Octokit({
  auth: Deno.env.get("GITHUB_TOKEN"),
});

const owner = "rojvv";
const repo = "config-tracker";
const branch = "main";
export async function commit(path: string, rawContent: string) {
  const content = new TextEncoder().encode(rawContent).toBase64();

  let delay_ = 100;

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

        if (Array.isArray(data) || data.type !== "file") {
          throw new Error(`${path} is not a file`);
        }

        sha = data.sha;

        const existingContent = new TextDecoder().decode(
          Uint8Array.fromBase64(data.content.replaceAll("\n", "")),
        );

        // Skip commit if it would not change anything
        if (existingContent === rawContent) {
          return {
            skipped: true,
            reason: "No changes",
          };
        }
        // deno-lint-ignore no-explicit-any
      } catch (err: any) {
        if (err.status !== 404) throw err;
        // File does not exist, so creating it is not an empty commit.
      }

      const result = await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `Update ${path} [skip deploy]`,
        content,
        branch,
        ...(sha && { sha }),
      });

      return {
        skipped: false,
        commit: result.data.commit.sha,
      };
      // deno-lint-ignore no-explicit-any
    } catch (err: any) {
      if (err.status !== 409) throw err;

      await delay(delay_);
      delay_ = Math.min(delay_ * 2, 5000);
    }
  }
}
