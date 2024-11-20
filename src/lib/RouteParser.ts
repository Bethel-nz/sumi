export class RouteParser {
  static parseSegment(segment: string): string {
    return segment.startsWith('[') && segment.endsWith(']')
      ? `:${segment.slice(1, -1)}`
      : segment;
  }
}
