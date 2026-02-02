import { WS_TOPICS } from "./constants";

export type WSTopic = (typeof WS_TOPICS)[keyof typeof WS_TOPICS];

export type WSMessage<T = unknown> = {
  topic: WSTopic;
  ts: string;
  requestId?: string;
  data: T;
};

export const makeMessage = <T>(topic: WSTopic, data: T, requestId?: string): WSMessage<T> => ({
  topic,
  ts: new Date().toISOString(),
  requestId,
  data,
});
