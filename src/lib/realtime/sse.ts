/**
 * A minimal `text/event-stream` parser (WHATWG HTML §9.2) over a fetch body. `EventSource` only
 * delivers named events you subscribed to by name; the API names each event after its domain event
 * type (`invoice.paid`, contract §6), and the client must see every one to invalidate the right
 * queries — so the stream is read with fetch and parsed here.
 */
export interface ServerSentEvent {
  event: string;
  data: string;
  id?: string;
}

export class SseParser {
  private buffer = "";
  private event = "";
  private data: string[] = [];
  private id: string | undefined;

  /** Feeds a chunk; returns the events it completed. */
  push(chunk: string): ServerSentEvent[] {
    this.buffer += chunk;
    const events: ServerSentEvent[] = [];
    let newline: number;
    while ((newline = this.buffer.search(/\r\n|\r|\n/)) >= 0) {
      const line = this.buffer.slice(0, newline);
      const length = this.buffer.startsWith("\r\n", newline) ? 2 : 1;
      this.buffer = this.buffer.slice(newline + length);
      if (line === "") {
        if (this.data.length > 0) {
          events.push({ event: this.event || "message", data: this.data.join("\n"), id: this.id });
        }
        this.event = "";
        this.data = [];
        continue;
      }
      if (line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? "" : line.slice(colon + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") this.event = value;
      else if (field === "data") this.data.push(value);
      else if (field === "id") this.id = value;
    }
    return events;
  }
}
