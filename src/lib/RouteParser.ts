export class RouteParser {
  static parseSegment(segment: string): string {
    console.log(segment);
    return segment.startsWith('[') && segment.endsWith(']')
      ? `:${segment.slice(1, -1)}`
      : segment;
  }
}
