import { createServer, type IncomingMessage } from "node:http";
import { readFileSync } from "node:fs";
import type { DeviceCommand } from "@repo/shared-types";

type Topics = {
  command: string;
  telemetry: string;
};

const topics = JSON.parse(
  readFileSync(
    new URL(import.meta.resolve("@repo/shared-types/schemas/topics.json")),
    "utf8",
  ),
) as Topics;

const port = Number(process.env.PORT ?? 4000);
const hardwarePorts = (process.env.HARDWARE_PORTS ?? "")
  .split(",")
  .map((item) => item.trim())
  .filter((item) => item.length > 0);

function topicFor(pattern: string, deviceId: string): string {
  return pattern.replaceAll("{deviceId}", deviceId);
}

function parseCommand(payload: unknown): DeviceCommand | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const { deviceId, action, value } = record;

  if (typeof deviceId !== "string" || deviceId.length === 0) {
    return undefined;
  }
  if (action !== "on" && action !== "off" && action !== "set") {
    return undefined;
  }
  if (value !== undefined && typeof value !== "number") {
    return undefined;
  }

  return {
    deviceId,
    action,
    ...(typeof value === "number" ? { value } : {}),
  };
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.length === 0) {
    return undefined;
  }
  return JSON.parse(raw) as unknown;
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, hardwarePorts }));
    return;
  }

  if (req.method === "POST" && req.url === "/commands") {
    void readJson(req)
      .then((payload) => {
        const command = parseCommand(payload);
        if (!command) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "invalid command" }));
          return;
        }

        const topic = topicFor(topics.command, command.deviceId);
        console.log(
          `command ${command.action} for ${command.deviceId} on ${topic}`,
        );
        res.writeHead(202, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            accepted: true,
            topic,
            ports: hardwarePorts,
          }),
        );
      })
      .catch(() => {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid json" }));
      });
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, () => {
  console.log(`device-gateway listening on ${port}`);
  console.log(`telemetry topic ${topics.telemetry}`);
  if (hardwarePorts.length === 0) {
    console.log("no hardware ports configured; set HARDWARE_PORTS");
  }
});
