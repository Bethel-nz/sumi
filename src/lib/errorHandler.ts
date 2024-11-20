export class ErrorHandler {
  static handleError(error: Error, context: string): void {
    console.error(`Error in ${context}:`, error);
  }
}
