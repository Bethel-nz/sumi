export class RouteParser {
    static parseSegment(segment) {
        return segment.startsWith('[') && segment.endsWith(']')
            ? `:${segment.slice(1, -1)}`
            : segment;
    }
}
