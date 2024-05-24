"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CustomError extends Error {
    constructor(messages, statusCode) {
        super(messages.join(', '));
        this.statusCode = statusCode;
        this.messages = JSON.stringify(messages);
        Object.setPrototypeOf(this, CustomError.prototype);
    }
}
exports.default = CustomError;
