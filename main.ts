import { Api, Client, DC, toJSON } from "@mtkruto/mtkruto";
import { join } from "@std/path/join";
import { delay } from "@std/async/delay";
import { commit } from "./commit.ts";

const dcList: DC[] = ["1", "2", "3", "4", "5", "1-test", "2-test", "3-test"];

Deno.cron("fetch configurations", "*/10 * * * *", async () => {
  await Promise.all(
    dcList.map(async (dc) => {
      try {
        Deno.mkdirSync(dc, { recursive: true });
        const client = new Client({ apiId: 1, initialDc: dc });
        await client.connect();
        console.log(`Connected to DC${dc}.`);
        try {
          const configObject = await client.invoke({
            _: "help.getConfig",
            hash: 0,
          });
          configObject.date = 0;
          configObject.expires = 0;
          const config = JSON.stringify(toJSON(configObject), null, 2);
          try {
            await commit(join(dc, "config.json"), `${config}\n`);
            console.log(`Wrote config.json for DC${dc}.`);
          } catch {
            console.error(`Failed to write config for DC${dc}.`);
          }
          const appConfigObject = await client.invoke({
            _: "help.getAppConfig",
            hash: 0,
          });
          if (Api.is("help.appConfig", appConfigObject)) {
            appConfigObject.hash = 0;
            if (Api.is("jsonObject", appConfigObject.config)) {
              appConfigObject.config.value = appConfigObject.config.value
                .filter((v) => v.key !== "ton_usd_rate");
            }
          }
          const appConfig = JSON.stringify(toJSON(appConfigObject), null, 2);
          try {
            await commit(join(dc, "app-config.json"), `${appConfig}\n`);
            console.log(`Wrote app-config.json for DC${dc}.`);
          } catch {
            console.error(`Failed to write config for DC${dc}.`);
          }
        } finally {
          await client.disconnect();
          console.log("disconnected", dc);
        }
      } catch (err) {
        console.error(`Failed to fetch config for DC${dc}:`, err);
      }
    }).map((v) => Promise.race([delay(5_000), v])),
  );
});

Deno.serve(() => Response.redirect("https://github.com/rojvv/config-tracker"));
