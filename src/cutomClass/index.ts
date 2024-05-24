class CustomError extends Error {
    public statusCode: number;
    public messages: string;
  
    constructor(messages: string[], statusCode: number) {
    super(messages.join(', '));
      this.statusCode = statusCode;
      this.messages = JSON.stringify(messages);
      Object.setPrototypeOf(this, CustomError.prototype);
    }
  }

  export default CustomError