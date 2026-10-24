export const commandActions = ["on", "off", "set"] as const;

export type CommandAction = (typeof commandActions)[number];

export type DeviceCommand = {
  deviceId: string;
  action: CommandAction;
  value?: number;
};

export type DeviceTelemetry = {
  deviceId: string;
  ts: string;
  metrics: Record<string, number>;
};

export function commandTopic(deviceId: string): string {
  return `hackiot/devices/${deviceId}/command`;
}

export function telemetryTopic(deviceId: string): string {
  return `hackiot/devices/${deviceId}/telemetry`;
}
