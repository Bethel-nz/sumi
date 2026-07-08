export class RouteParser {
    static parseSegment(segment) {
        if (segment.startsWith('[...') && segment.endsWith(']'))
            return '*';
        return segment.startsWith('[') && segment.endsWith(']')
            ? `:${segment.slice(1, -1)}`
            : segment;
    }
}
