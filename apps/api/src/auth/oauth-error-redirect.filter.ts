import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class OAuthErrorRedirectFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();

    if (response.headersSent) {
      return;
    }

    const frontendBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:5173';
    const payload = exception.getResponse();
    const message = extractErrorMessage(payload) || 'OAuth login failed.';
    const redirectUrl = `${frontendBaseUrl}/?authError=${encodeURIComponent(message)}`;

    response.redirect(redirectUrl);
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message) && message.length > 0 && typeof message[0] === 'string') {
      return message[0];
    }
  }

  return null;
}
