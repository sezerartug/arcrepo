import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { jsonSafe } from '../application/json.js';

// Last line of defence for the JSON money rule: bigint never reaches JSON.stringify.
@Injectable()
export class JsonSafeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(jsonSafe));
  }
}
