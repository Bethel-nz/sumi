export class ErrorHandler {
    static handleError(error, context) {
        console.error(`Error in ${context}:`, error);
    }
}
